import crypto from 'crypto';

// Encryption configuration
interface EncryptionConfig {
  algorithm: string;
  keyDerivation: string;
  ivLength: number;
  saltLength: number;
  tagLength: number;
  iterations: number;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  ivLength: 16,
  saltLength: 32,
  tagLength: 16,
  iterations: 100000
};

// Encrypted data structure
interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  tag: string;
  algorithm: string;
}

// PII field types for different encryption strategies
export enum PIIFieldType {
  SSN = 'SSN',
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  ADDRESS = 'ADDRESS',
  NAME = 'NAME',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
  INCOME = 'INCOME',
  EMPLOYMENT = 'EMPLOYMENT'
}

// Master key management
class KeyManager {
  private static instance: KeyManager;
  private masterKey: string;
  private derivedKeys: Map<string, Buffer> = new Map();

  private constructor() {
    // In production, load from secure key management service (AWS KMS, HashiCorp Vault, etc.)
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_MASTER_KEY environment variable is required in production');
      }
      console.warn('WARNING: Using generated master key for development. Set ENCRYPTION_MASTER_KEY environment variable!');
      this.masterKey = this.generateMasterKey();
    } else {
      this.masterKey = process.env.ENCRYPTION_MASTER_KEY;
    }
  }

  public static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  private generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Derive key for specific purpose using HKDF
  public deriveKey(purpose: string, salt: Buffer): Buffer {
    const cacheKey = `${purpose}:${salt.toString('hex')}`;
    
    if (this.derivedKeys.has(cacheKey)) {
      return this.derivedKeys.get(cacheKey)!;
    }

    const masterKeyBuffer = Buffer.from(this.masterKey, 'hex');
    const derivedKey = Buffer.from(crypto.hkdfSync('sha256', masterKeyBuffer, salt, Buffer.from(purpose), 32));
    
    this.derivedKeys.set(cacheKey, derivedKey);
    return derivedKey;
  }

  // Rotate master key (for production key rotation) - security-enhanced
  public rotateMasterKey(newMasterKey: string): void {
    if (!newMasterKey || newMasterKey.length < 32) {
      throw new Error('New master key must be at least 32 characters long');
    }
    
    // Clear derived keys cache for security
    this.derivedKeys.clear();
    
    // Update to new key
    this.masterKey = newMasterKey;
    
    // Optional: Log key rotation for audit (without exposing key)
    console.info('Master encryption key rotated successfully');
  }
}

// Main encryption utility class
export class DataEncryption {
  private keyManager: KeyManager;
  private config: EncryptionConfig;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.keyManager = KeyManager.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Encrypt sensitive data
  public encrypt(plaintext: string, purpose: string = 'default'): EncryptedData {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Derive encryption key
      const key = this.keyManager.deriveKey(purpose, salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for GCM mode
      let tag = Buffer.alloc(0);
      if (this.config.algorithm.includes('gcm')) {
        tag = (cipher as any).getAuthTag();
      }
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.config.algorithm
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Decrypt sensitive data
  public decrypt(encryptedData: EncryptedData, purpose: string = 'default'): string {
    try {
      const { encrypted, iv, salt, tag, algorithm } = encryptedData;
      
      // Validate algorithm
      if (algorithm !== this.config.algorithm) {
        throw new Error('Algorithm mismatch');
      }
      
      // Convert hex strings back to buffers
      const saltBuffer = Buffer.from(salt, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      const tagBuffer = Buffer.from(tag, 'hex');
      
      // Derive the same key
      const key = this.keyManager.deriveKey(purpose, saltBuffer);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
      
      // Set authentication tag for GCM mode
      if (algorithm.includes('gcm') && tagBuffer.length > 0) {
        (decipher as any).setAuthTag(tagBuffer);
      }
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate hash for searchable encryption (deterministic)
  public generateSearchHash(plaintext: string, purpose: string = 'search'): string {
    const salt = crypto.createHash('sha256').update(purpose).digest();
    const key = this.keyManager.deriveKey(purpose, salt);
    
    return crypto.createHmac('sha256', key)
                 .update(plaintext.toLowerCase().trim())
                 .digest('hex');
  }

  // Format-preserving encryption for specific field types
  public encryptPII(value: string, fieldType: PIIFieldType): { encrypted: EncryptedData; searchHash?: string } {
    const purpose = `pii:${fieldType.toLowerCase()}`;
    const encrypted = this.encrypt(value, purpose);
    
    // Generate search hash for searchable fields
    const searchableFields = [PIIFieldType.EMAIL, PIIFieldType.PHONE];
    const searchHash = searchableFields.includes(fieldType) 
      ? this.generateSearchHash(value, purpose) 
      : undefined;
    
    return { encrypted, searchHash };
  }

  // Decrypt PII with field type validation
  public decryptPII(encryptedData: EncryptedData, fieldType: PIIFieldType): string {
    const purpose = `pii:${fieldType.toLowerCase()}`;
    return this.decrypt(encryptedData, purpose);
  }

  // Mask sensitive data for display (partial encryption/masking)
  public maskForDisplay(value: string, fieldType: PIIFieldType): string {
    switch (fieldType) {
      case PIIFieldType.SSN:
        return value.length >= 4 ? `***-**-${value.slice(-4)}` : '***';
      case PIIFieldType.CREDIT_CARD:
        return value.length >= 4 ? `****-****-****-${value.slice(-4)}` : '****';
      case PIIFieldType.EMAIL:
        const [local, domain] = value.split('@');
        return local.length > 2 ? `${local.slice(0, 2)}***@${domain}` : '***@***';
      case PIIFieldType.PHONE:
        return value.length >= 4 ? `***-***-${value.slice(-4)}` : '***';
      case PIIFieldType.BANK_ACCOUNT:
        return value.length >= 4 ? `******${value.slice(-4)}` : '***';
      default:
        return '***';
    }
  }
}

// Database field encryption helper
export class DatabaseFieldEncryption {
  private encryption: DataEncryption;

  constructor() {
    this.encryption = new DataEncryption();
  }

  // Encrypt an object with specified field mappings
  public encryptObject(obj: any, fieldMappings: Record<string, PIIFieldType>): any {
    const encrypted = { ...obj };
    
    for (const [field, fieldType] of Object.entries(fieldMappings)) {
      if (obj[field]) {
        const { encrypted: encryptedData, searchHash } = this.encryption.encryptPII(obj[field], fieldType);
        encrypted[`${field}_encrypted`] = JSON.stringify(encryptedData);
        
        if (searchHash) {
          encrypted[`${field}_hash`] = searchHash;
        }
        
        // Remove original field for security
        delete encrypted[field];
      }
    }
    
    return encrypted;
  }

  // Decrypt an object with specified field mappings
  public decryptObject(obj: any, fieldMappings: Record<string, PIIFieldType>): any {
    const decrypted = { ...obj };
    
    for (const [field, fieldType] of Object.entries(fieldMappings)) {
      const encryptedField = `${field}_encrypted`;
      
      if (obj[encryptedField]) {
        try {
          const encryptedData = JSON.parse(obj[encryptedField]);
          decrypted[field] = this.encryption.decryptPII(encryptedData, fieldType);
          
          // Remove encrypted fields from result
          delete decrypted[encryptedField];
          delete decrypted[`${field}_hash`];
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, 'Field decryption failed');
          // Keep encrypted data if decryption fails
        }
      }
    }
    
    return decrypted;
  }

  // Create a masked version for display
  public maskObject(obj: any, fieldMappings: Record<string, PIIFieldType>): any {
    const masked = { ...obj };
    
    for (const [field, fieldType] of Object.entries(fieldMappings)) {
      if (obj[field]) {
        masked[field] = this.encryption.maskForDisplay(obj[field], fieldType);
      }
    }
    
    return masked;
  }
}

// Utility for application-specific encryption
export class ApplicationEncryption extends DatabaseFieldEncryption {
  // User PII fields mapping
  public static readonly USER_PII_FIELDS = {
    ssn: PIIFieldType.SSN,
    email: PIIFieldType.EMAIL,
    phone: PIIFieldType.PHONE
  };

  // Application PII fields mapping
  public static readonly APPLICATION_PII_FIELDS = {
    applicant_ssn: PIIFieldType.SSN,
    applicant_email: PIIFieldType.EMAIL,
    applicant_phone: PIIFieldType.PHONE,
    annual_income: PIIFieldType.INCOME,
    employer_name: PIIFieldType.EMPLOYMENT,
    bank_account_number: PIIFieldType.BANK_ACCOUNT
  };

  // Encrypt user data
  public encryptUser(userData: any): any {
    return this.encryptObject(userData, ApplicationEncryption.USER_PII_FIELDS);
  }

  // Decrypt user data
  public decryptUser(encryptedUserData: any): any {
    return this.decryptObject(encryptedUserData, ApplicationEncryption.USER_PII_FIELDS);
  }

  // Encrypt application data
  public encryptApplication(applicationData: any): any {
    return this.encryptObject(applicationData, ApplicationEncryption.APPLICATION_PII_FIELDS);
  }

  // Decrypt application data
  public decryptApplication(encryptedApplicationData: any): any {
    return this.decryptObject(encryptedApplicationData, ApplicationEncryption.APPLICATION_PII_FIELDS);
  }

  // Create masked versions for audit logs
  public maskUserForAudit(userData: any): any {
    return this.maskObject(userData, ApplicationEncryption.USER_PII_FIELDS);
  }

  public maskApplicationForAudit(applicationData: any): any {
    return this.maskObject(applicationData, ApplicationEncryption.APPLICATION_PII_FIELDS);
  }
}

// Export instances and utilities
export const dataEncryption = new DataEncryption();
export const dbFieldEncryption = new DatabaseFieldEncryption();
export const appEncryption = new ApplicationEncryption();

// Middleware for automatic encryption/decryption
export const encryptionMiddleware = {
  // Encrypt request body before processing
  encryptRequest: (fieldMappings: Record<string, PIIFieldType>) => {
    return (req: any, res: any, next: any) => {
      if (req.body) {
        req.body = dbFieldEncryption.encryptObject(req.body, fieldMappings);
      }
      next();
    };
  },

  // Decrypt response data before sending
  decryptResponse: (fieldMappings: Record<string, PIIFieldType>) => {
    return (req: any, res: any, next: any) => {
      const originalJson = res.json;
      
      res.json = function(data: any) {
        if (data && typeof data === 'object') {
          if (Array.isArray(data)) {
            data = data.map(item => dbFieldEncryption.decryptObject(item, fieldMappings));
          } else {
            data = dbFieldEncryption.decryptObject(data, fieldMappings);
          }
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    };
  }
};

export default DataEncryption;