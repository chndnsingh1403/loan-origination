import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Error types
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  DUPLICATE_ERROR = 'DUPLICATE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

// Custom error class
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly correlationId: string;
  public readonly userMessage: string;
  public readonly details?: any;

  constructor(
    type: ErrorType,
    message: string,
    userMessage: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.userMessage = userMessage;
    this.correlationId = uuidv4();
    this.details = details;
    
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this);
  }
}

// Predefined error factories
export class ErrorFactory {
  static validation(message: string, details?: any): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      message,
      'The provided data is invalid. Please check your input.',
      400,
      true,
      details
    );
  }

  static authentication(message: string = 'Authentication failed'): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      message,
      'Authentication required. Please log in and try again.',
      401,
      true
    );
  }

  static authorization(message: string = 'Insufficient permissions'): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      message,
      'You do not have permission to perform this action.',
      403,
      true
    );
  }

  static notFound(resource: string = 'Resource'): AppError {
    return new AppError(
      ErrorType.NOT_FOUND_ERROR,
      `${resource} not found`,
      'The requested resource could not be found.',
      404,
      true
    );
  }

  static duplicate(resource: string = 'Resource'): AppError {
    return new AppError(
      ErrorType.DUPLICATE_ERROR,
      `${resource} already exists`,
      'A resource with the same information already exists.',
      409,
      true
    );
  }

  static rateLimit(): AppError {
    return new AppError(
      ErrorType.RATE_LIMIT_ERROR,
      'Rate limit exceeded',
      'Too many requests. Please wait before trying again.',
      429,
      true
    );
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(
      ErrorType.INTERNAL_ERROR,
      message,
      'An internal error occurred. Please try again later.',
      500,
      false
    );
  }

  static externalService(service: string, message: string = 'Service unavailable'): AppError {
    return new AppError(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      `${service}: ${message}`,
      'An external service is currently unavailable. Please try again later.',
      503,
      true
    );
  }

  static database(message: string = 'Database operation failed'): AppError {
    return new AppError(
      ErrorType.DATABASE_ERROR,
      message,
      'A database error occurred. Please try again later.',
      500,
      false
    );
  }
}

// Logger interface
interface Logger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Simple console logger (replace with proper logger in production)
const defaultLogger: Logger = {
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, meta ? JSON.stringify(meta) : '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
};

// Error handling configuration
interface ErrorHandlerConfig {
  logger: Logger;
  showStackTrace: boolean;
  showDetails: boolean;
  correlationIdHeader: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Error handler class
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private logger: Logger;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      logger: defaultLogger,
      showStackTrace: process.env.NODE_ENV === 'development',
      showDetails: process.env.NODE_ENV === 'development',
      correlationIdHeader: 'X-Correlation-ID',
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
      ...config
    };
    this.logger = this.config.logger;
  }

  // Handle known operational errors
  private handleOperationalError(error: AppError, req: Request): any {
    const errorResponse = {
      error: {
        type: error.type,
        message: error.userMessage,
        correlationId: error.correlationId,
        timestamp: new Date().toISOString(),
        ...(this.config.showDetails && error.details && { details: error.details })
      }
    };

    // Log the error with context (IP masked for privacy)
    this.logger.error(`Operational Error: ${error.message}`, {
      type: error.type,
      correlationId: error.correlationId,
      statusCode: error.statusCode,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: this.maskIP(req.ip),
      userId: (req as any).user?.id,
      ...(this.config.showStackTrace && { stack: error.stack }),
      ...(error.details && { details: this.sanitizeDetails(error.details) })
    });

    return errorResponse;
  }

  // Handle unexpected errors
  private handleUnexpectedError(error: Error, req: Request): any {
    const correlationId = uuidv4();
    
    const errorResponse = {
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: 'An unexpected error occurred. Please try again later.',
        correlationId,
        timestamp: new Date().toISOString(),
        ...(this.config.showStackTrace && { 
          originalMessage: error.message,
          stack: error.stack 
        })
      }
    };

    // Log the unexpected error
    this.logger.error(`Unexpected Error: ${error.message}`, {
      correlationId,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: this.maskIP(req.ip),
      userId: (req as any).user?.id,
      stack: error.stack,
      originalError: error.name
    });

    return errorResponse;
  }

  // Main error handling middleware
  handleError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Set correlation ID header for tracking
    const correlationId = error instanceof AppError ? error.correlationId : uuidv4();
    res.setHeader(this.config.correlationIdHeader, correlationId);

    // Determine if this is an operational error
    const isOperational = error instanceof AppError && error.isOperational;
    
    let statusCode: number;
    let errorResponse: any;

    if (isOperational) {
      // Handle known operational errors
      const appError = error as AppError;
      statusCode = appError.statusCode;
      errorResponse = this.handleOperationalError(appError, req);
    } else {
      // Handle unexpected errors
      statusCode = 500;
      errorResponse = this.handleUnexpectedError(error, req);
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
  };

  // 404 handler for unmatched routes
  handleNotFound = (req: Request, res: Response): void => {
    const error = ErrorFactory.notFound('Endpoint');
    res.setHeader(this.config.correlationIdHeader, error.correlationId);
    
    this.logger.warn(`404 Not Found: ${req.method} ${req.url}`, {
      correlationId: error.correlationId,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: this.maskIP(req.ip),
      userId: (req as any).user?.id
    });

    res.status(404).json({
      error: {
        type: ErrorType.NOT_FOUND_ERROR,
        message: `Endpoint ${req.method} ${req.url} not found`,
        correlationId: error.correlationId,
        timestamp: new Date().toISOString()
      }
    });
  };

  // Async error wrapper
  static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Utility methods for privacy and security
  private maskIP(ip: string | undefined): string {
    if (!ip) return 'unknown';
    
    // Mask last octet of IPv4 or last 4 segments of IPv6 for privacy
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    } else if (ip.includes(':')) {
      // IPv6 - mask last 4 segments
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return parts.slice(0, -4).join(':') + ':xxxx:xxxx:xxxx:xxxx';
      }
    }
    
    return 'masked';
  }

  private sanitizeDetails(details: any): any {
    if (!details || typeof details !== 'object') return details;
    
    const sanitized = { ...details };
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization', 
      'ssn', 'social', 'credit', 'account', 'routing',
      'email', 'phone', 'address'
    ];
    
    // Recursively sanitize object
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };
    
    return sanitizeObject(sanitized);
  }
}

// Database error handler
export const handleDatabaseError = (error: any): AppError => {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // unique_violation
      return ErrorFactory.duplicate('Record');
    case '23503': // foreign_key_violation
      return ErrorFactory.validation('Invalid reference to related data');
    case '23502': // not_null_violation
      return ErrorFactory.validation('Required field is missing');
    case '23514': // check_violation
      return ErrorFactory.validation('Data violates database constraints');
    case '42P01': // undefined_table
      return ErrorFactory.database('Table does not exist');
    case '42703': // undefined_column
      return ErrorFactory.database('Column does not exist');
    default:
      return ErrorFactory.database(`Database operation failed: ${error.message}`);
  }
};

// Express error handler setup
export const setupErrorHandling = (logger?: Logger) => {
  const errorHandler = new ErrorHandler({ logger });
  
  return {
    errorHandler: errorHandler.handleError,
    notFoundHandler: errorHandler.handleNotFound,
    asyncHandler: ErrorHandler.asyncHandler
  };
};

// Export commonly used patterns
export const asyncHandler = ErrorHandler.asyncHandler;
export const errorHandler = new ErrorHandler();

export default ErrorHandler;