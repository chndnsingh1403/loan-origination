import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Security configuration
export interface SecurityConfig {
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
  };
  slowDown: {
    windowMs: number;
    delayAfter: number;
    delayMs: number;
  };
  helmet: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
  };
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.CORS_ORIGIN || '').split(',').filter(Boolean)
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },
  slowDown: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per 15 minutes without delay
    delayMs: 500 // Add 500ms delay per request after delayAfter
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  }
};

// Input sanitization utilities
export class InputSanitizer {
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    // Remove any HTML/script tags
    let sanitized = purify.sanitize(input, { ALLOWED_TAGS: [] });
    
    // Escape special characters
    sanitized = validator.escape(sanitized);
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  static sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeString(email);
    return validator.isEmail(sanitized) ? validator.normalizeEmail(sanitized) || '' : '';
  }

  static sanitizeNumeric(input: any): number | null {
    const str = String(input).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  static sanitizeAlphanumeric(input: string): string {
    return this.sanitizeString(input).replace(/[^a-zA-Z0-9\s]/g, '');
  }

  static sanitizeObject(obj: any, schema: Record<string, string>): any {
    const sanitized: any = {};
    
    for (const [key, type] of Object.entries(schema)) {
      if (obj[key] !== undefined) {
        switch (type) {
          case 'string':
            sanitized[key] = this.sanitizeString(obj[key]);
            break;
          case 'email':
            sanitized[key] = this.sanitizeEmail(obj[key]);
            break;
          case 'number':
            sanitized[key] = this.sanitizeNumeric(obj[key]);
            break;
          case 'alphanumeric':
            sanitized[key] = this.sanitizeAlphanumeric(obj[key]);
            break;
          default:
            sanitized[key] = this.sanitizeString(obj[key]);
        }
      }
    }
    
    return sanitized;
  }
}

// Input validation utilities
export class InputValidator {
  static validateString(value: string, minLength = 0, maxLength = 1000): boolean {
    return typeof value === 'string' && 
           value.length >= minLength && 
           value.length <= maxLength;
  }

  static validateEmail(email: string): boolean {
    return validator.isEmail(email);
  }

  static validateUUID(uuid: string): boolean {
    return validator.isUUID(uuid);
  }

  static validateNumeric(value: any, min?: number, max?: number): boolean {
    const num = Number(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  }

  static validateRequired(value: any): boolean {
    return value !== undefined && value !== null && value !== '';
  }

  static validateSchema(obj: any, schema: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      
      // Check required fields
      if (rules.required && !this.validateRequired(value)) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is not required and not provided
      if (!rules.required && !this.validateRequired(value)) {
        continue;
      }
      
      // Type-specific validation
      switch (rules.type) {
        case 'string':
          if (!this.validateString(value, rules.minLength, rules.maxLength)) {
            errors.push(`${field} must be a valid string (${rules.minLength}-${rules.maxLength} characters)`);
          }
          break;
        case 'email':
          if (!this.validateEmail(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          break;
        case 'uuid':
          if (!this.validateUUID(value)) {
            errors.push(`${field} must be a valid UUID`);
          }
          break;
        case 'number':
          if (!this.validateNumeric(value, rules.min, rules.max)) {
            errors.push(`${field} must be a valid number${rules.min !== undefined ? ` (min: ${rules.min})` : ''}${rules.max !== undefined ? ` (max: ${rules.max})` : ''}`);
          }
          break;
      }
      
      // Custom validation
      if (rules.custom && typeof rules.custom === 'function') {
        const customResult = rules.custom(value);
        if (customResult !== true) {
          errors.push(`${field}: ${customResult}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

// Security middleware factory
export class SecurityMiddleware {
  private config: SecurityConfig;
  
  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...defaultSecurityConfig, ...config };
  }
  
  // CORS middleware
  cors() {
    return cors(this.config.cors);
  }
  
  // Helmet security headers
  helmet() {
    return helmet(this.config.helmet);
  }
  
  // Rate limiting middleware
  rateLimit() {
    return rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: { error: this.config.rateLimit.message },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip successful requests to static resources
      skip: (req) => {
        return req.url?.includes('/static/') || req.url?.includes('/assets/');
      }
    });
  }
  
  // Slow down middleware for additional protection
  slowDown() {
    return slowDown({
      windowMs: this.config.slowDown.windowMs,
      delayAfter: this.config.slowDown.delayAfter,
      delayMs: this.config.slowDown.delayMs
    });
  }
  
  // Request sanitization middleware
  sanitizeInputs(schema?: Record<string, string>) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize body
        if (req.body && typeof req.body === 'object') {
          if (schema) {
            req.body = InputSanitizer.sanitizeObject(req.body, schema);
          } else {
            // Generic sanitization for string fields
            for (const [key, value] of Object.entries(req.body)) {
              if (typeof value === 'string') {
                req.body[key] = InputSanitizer.sanitizeString(value);
              }
            }
          }
        }
        
        // Sanitize query parameters
        if (req.query) {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
              req.query[key] = InputSanitizer.sanitizeString(value);
            }
          }
        }
        
        next();
      } catch (error) {
        res.status(400).json({ error: 'Invalid input format' });
      }
    };
  }
  
  // Input validation middleware
  validateInputs(schema: Record<string, any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { valid, errors } = InputValidator.validateSchema(req.body, schema);
      
      if (!valid) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors
        });
      }
      
      next();
    };
  }
  
  // Security headers middleware
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Remove sensitive headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      next();
    };
  }
  
  // Complete security middleware stack
  getAllMiddleware() {
    return [
      this.helmet(),
      this.securityHeaders(),
      this.cors(),
      this.rateLimit(),
      this.slowDown()
    ];
  }
}

// Export pre-configured instance
export const security = new SecurityMiddleware();

// Validation schemas for common use cases
export const ValidationSchemas = {
  login: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, minLength: 8, maxLength: 128 }
  },
  
  createUser: {
    email: { type: 'email', required: true },
    first_name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    last_name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    role: { type: 'string', required: true, custom: (value: string) => {
      const validRoles = ['admin', 'tenant_admin', 'broker', 'underwriter', 'processor'];
      return validRoles.includes(value) ? true : 'Invalid role';
    }}
  },
  
  createLoanProduct: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    type: { type: 'string', required: true },
    min_amount: { type: 'number', required: true, min: 0 },
    max_amount: { type: 'number', required: true, min: 0 },
    interest_rate: { type: 'number', required: true, min: 0, max: 100 }
  },
  
  updateProfile: {
    first_name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    last_name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
    email: { type: 'email', required: false }
  }
};

export default SecurityMiddleware;