import crypto from 'crypto';
import { z } from 'zod';

// Environment types
type Environment = 'development' | 'staging' | 'production';

// Configuration schema for validation
const ConfigSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  APP_NAME: z.string().default('Originate-BFF'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  DATABASE_HOST: z.string().min(1, 'Database host is required'),
  DATABASE_PORT: z.coerce.number().min(1).max(65535).default(5432),
  DATABASE_NAME: z.string().min(1, 'Database name is required'),
  DATABASE_USER: z.string().min(1, 'Database user is required'),
  DATABASE_PASSWORD: z.string().min(1, 'Database password is required'),
  DATABASE_SSL: z.string().transform((val) => val !== 'false' && val !== '0').default('true'),
  DATABASE_POOL_MIN: z.coerce.number().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().min(1).default(10),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRE: z.string().default('24h'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_SKIP_SUCCESS: z.coerce.boolean().default(true),
  
  // CORS
  CORS_ORIGIN: z.string().or(z.array(z.string())).default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  LOG_FILE_PATH: z.string().optional(),
  
  // Monitoring
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(90),
  
  // External Services
  REDIS_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private sensitiveKeys: Set<string>;

  private constructor() {
    this.sensitiveKeys = new Set([
      'DATABASE_PASSWORD',
      'JWT_SECRET',
      'SESSION_SECRET',
      'ENCRYPTION_KEY',
      'SMTP_PASSWORD',
    ]);
    this.config = this.loadAndValidateConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadAndValidateConfig(): Config {
    try {
      // Load environment variables
      const envVars = { ...process.env };

      // Validate required environment
      const nodeEnv = (envVars.NODE_ENV || 'development') as Environment;
      if (!['development', 'staging', 'production'].includes(nodeEnv)) {
        throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be development, staging, or production`);
      }

      // Auto-generate secrets for development if missing
      if (nodeEnv === 'development') {
        // Set development defaults
        envVars.DATABASE_URL = envVars.DATABASE_URL || 'postgresql://appuser:apppass@postgres:5432/originate';
        envVars.DATABASE_HOST = envVars.DATABASE_HOST || 'postgres';
        envVars.DATABASE_NAME = envVars.DATABASE_NAME || 'originate';
        envVars.DATABASE_USER = envVars.DATABASE_USER || 'appuser';
        envVars.DATABASE_PASSWORD = envVars.DATABASE_PASSWORD || 'apppass';
        envVars.DATABASE_SSL = envVars.DATABASE_SSL || 'false'; // Disable SSL for local development
        
        if (!envVars.JWT_SECRET) {
          envVars.JWT_SECRET = this.generateSecret(32);
          console.warn('Generated JWT_SECRET for development. Use ENCRYPTION_MASTER_KEY env var in production.');
        }
        if (!envVars.SESSION_SECRET) {
          envVars.SESSION_SECRET = this.generateSecret(32);
          console.warn('Generated SESSION_SECRET for development. Set environment variable in production.');
        }
        if (!envVars.ENCRYPTION_KEY) {
          envVars.ENCRYPTION_KEY = this.generateSecret(32);
          console.warn('Generated ENCRYPTION_KEY for development. Set environment variable in production.');
        }
      } else {
        // Ensure required secrets are provided in staging/production
        const requiredSecrets = ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'];
        const missingSecrets = requiredSecrets.filter(key => !envVars[key]);
        
        if (missingSecrets.length > 0) {
          throw new Error(`Missing required secrets in ${nodeEnv}: ${missingSecrets.join(', ')}`);
        }
      }

      // Validate configuration
      const result = ConfigSchema.safeParse(envVars);
      
      if (!result.success) {
        const errors = result.error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        throw new Error(`Configuration validation failed: ${errors}`);
      }

      // Additional production validations
      if (nodeEnv === 'production') {
        this.validateProductionConfig(result.data);
      }

      return result.data;
    } catch (error) {
      console.error('Configuration loading failed:', error instanceof Error ? error.message : 'Unknown configuration error');
      process.exit(1);
    }
  }

  private validateProductionConfig(config: Config): void {
    const errors: string[] = [];

    // Check for insecure defaults in production
    if (config.CORS_ORIGIN === '*') {
      errors.push('CORS_ORIGIN cannot be wildcard (*) in production');
    }

    if (config.DATABASE_SSL === false) {
      errors.push('DATABASE_SSL must be enabled in production');
    }

    if (config.BCRYPT_ROUNDS < 12) {
      errors.push('BCRYPT_ROUNDS must be at least 12 in production');
    }

    // Check for development secrets in production
    const devSecrets = [
      'dev-secret',
      'development',
      'password',
      '123456',
      'secret',
    ];

    const secretFields = ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'];
    for (const field of secretFields) {
      const value = (config as any)[field]?.toLowerCase() || '';
      if (devSecrets.some(devSecret => value.includes(devSecret))) {
        errors.push(`${field} appears to contain development placeholder in production`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Production configuration errors: ${errors.join(', ')}`);
    }
  }

  private generateSecret(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Get configuration value
  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  // Get all configuration (sensitive data masked for logging)
  public getConfig(maskSensitive: boolean = true): Config {
    if (!maskSensitive) {
      return { ...this.config };
    }

    const masked = { ...this.config };
    for (const key of this.sensitiveKeys) {
      if (key in masked) {
        (masked as any)[key] = '***MASKED***';
      }
    }
    return masked;
  }

  // Get environment type
  public getEnvironment(): Environment {
    return this.config.NODE_ENV;
  }

  // Check if running in specific environment
  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isStaging(): boolean {
    return this.config.NODE_ENV === 'staging';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  // Get database configuration
  public getDatabaseConfig() {
    return {
      host: this.config.DATABASE_HOST,
      port: this.config.DATABASE_PORT,
      database: this.config.DATABASE_NAME,
      user: this.config.DATABASE_USER,
      password: this.config.DATABASE_PASSWORD,
      ssl: this.config.DATABASE_SSL,
      min: this.config.DATABASE_POOL_MIN,
      max: this.config.DATABASE_POOL_MAX,
    };
  }

  // Get security configuration
  public getSecurityConfig() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      jwtExpire: this.config.JWT_EXPIRE,
      sessionSecret: this.config.SESSION_SECRET,
      encryptionKey: this.config.ENCRYPTION_KEY,
      bcryptRounds: this.config.BCRYPT_ROUNDS,
      rateLimitWindow: this.config.RATE_LIMIT_WINDOW_MS,
      rateLimitMax: this.config.RATE_LIMIT_MAX_REQUESTS,
      corsOrigin: this.config.CORS_ORIGIN,
      corsCredentials: this.config.CORS_CREDENTIALS,
    };
  }

  // Get logging configuration
  public getLoggingConfig() {
    return {
      level: this.config.LOG_LEVEL,
      format: this.config.LOG_FORMAT,
      filePath: this.config.LOG_FILE_PATH,
    };
  }

  // Configuration health check
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const config = this.getConfig(true); // masked config
      const environment = this.getEnvironment();
      
      // Check required configurations are present
      const requiredChecks = {
        database: !!this.config.DATABASE_URL,
        security: !!this.config.JWT_SECRET && !!this.config.SESSION_SECRET,
        encryption: !!this.config.ENCRYPTION_KEY,
      };

      const allChecksPass = Object.values(requiredChecks).every(Boolean);

      return {
        status: allChecksPass ? 'healthy' : 'degraded',
        details: {
          environment,
          checks: requiredChecks,
          configurationKeys: Object.keys(config).length,
          lastReloaded: new Date().toISOString(),
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      };
    }
  }

  // Reload configuration (useful for testing)
  public reload(): void {
    this.config = this.loadAndValidateConfig();
  }
}

// Environment configuration utilities
export class EnvironmentUtils {
  // Check if specific feature should be enabled
  public static isFeatureEnabled(featureName: string): boolean {
    const envVar = `FEATURE_${featureName.toUpperCase()}_ENABLED`;
    return process.env[envVar] === 'true';
  }

  // Get environment-specific timeout values
  public static getTimeout(operation: string): number {
    const config = ConfigManager.getInstance();
    const baseTimeout = config.get('HEALTH_CHECK_TIMEOUT');
    
    // Adjust timeouts based on environment
    const multiplier = config.isDevelopment() ? 2 : 1;
    
    switch (operation) {
      case 'database': return baseTimeout * multiplier;
      case 'external_api': return baseTimeout * 1.5 * multiplier;
      case 'file_upload': return baseTimeout * 3 * multiplier;
      default: return baseTimeout * multiplier;
    }
  }

  // Validate environment prerequisites
  public static validateEnvironment(): void {
    const config = ConfigManager.getInstance();
    
    if (config.isProduction()) {
      // Production-specific validations
      if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
        throw new Error('NODE_ENV must be explicitly set to production');
      }
      
      if (process.env.npm_config_production !== 'true') {
        console.warn('Warning: npm production flag not set');
      }
    }
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();
export default config;