import { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// Audit event types
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  
  // Authorization events
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  
  // Data operations
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  BULK_UPDATE = 'BULK_UPDATE',
  BULK_DELETE = 'BULK_DELETE',
  
  // Administrative actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  
  // System events
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MULTIPLE_LOGIN_ATTEMPTS = 'MULTIPLE_LOGIN_ATTEMPTS',
  
  // Business events
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED'
}

// Risk levels
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Audit log entry structure
export interface AuditLogEntry {
  id: string;
  event_type: AuditEventType;
  user_id?: string;
  session_id?: string;
  resource_type?: string;
  resource_id?: string;
  action: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
  risk_level: RiskLevel;
  organization_id?: string;
  correlation_id?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PENDING';
  error_message?: string;
}

// Sensitive fields to redact from logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'ssn',
  'social_security_number',
  'credit_card',
  'bank_account',
  'routing_number',
  'pin',
  'authorization_code'
];

// Audit logger class
export class AuditLogger {
  private static instance: AuditLogger;

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Sanitize sensitive data
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Extract client information with privacy protection
  private extractClientInfo(req: Request) {
    return {
      ip_address: this.maskIP(req.ip || req.connection.remoteAddress || 'unknown'),
      user_agent: req.get('User-Agent') || 'unknown',
      correlation_id: req.get('X-Correlation-ID') || uuidv4()
    };
  }

  // Mask IP address for privacy compliance
  private maskIP(ip: string): string {
    if (!ip || ip === 'unknown') return 'unknown';
    
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

  // Log audit event
  public async log(entry: Partial<AuditLogEntry>): Promise<void> {
    try {
      const logEntry: AuditLogEntry = {
        id: uuidv4(),
        event_type: entry.event_type!,
        user_id: entry.user_id,
        session_id: entry.session_id,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        action: entry.action || entry.event_type!,
        details: this.sanitizeData(entry.details || {}),
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        timestamp: new Date(),
        risk_level: entry.risk_level || RiskLevel.LOW,
        organization_id: entry.organization_id,
        correlation_id: entry.correlation_id,
        outcome: entry.outcome || 'SUCCESS',
        error_message: entry.error_message
      };

      // Store in database
      await query(
        `INSERT INTO audit_logs 
         (id, event_type, user_id, session_id, resource_type, resource_id, action, 
          details, ip_address, user_agent, timestamp, risk_level, organization_id, 
          correlation_id, outcome, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          logEntry.id,
          logEntry.event_type,
          logEntry.user_id,
          logEntry.session_id,
          logEntry.resource_type,
          logEntry.resource_id,
          logEntry.action,
          JSON.stringify(logEntry.details),
          logEntry.ip_address,
          logEntry.user_agent,
          logEntry.timestamp,
          logEntry.risk_level,
          logEntry.organization_id,
          logEntry.correlation_id,
          logEntry.outcome,
          logEntry.error_message
        ]
      );

      // Also log to console for immediate visibility
      console.log(`[AUDIT] ${logEntry.event_type}: ${logEntry.action}`, {
        user_id: logEntry.user_id,
        resource: `${logEntry.resource_type}:${logEntry.resource_id}`,
        outcome: logEntry.outcome,
        risk_level: logEntry.risk_level,
        correlation_id: logEntry.correlation_id
      });

    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }

  // Convenience methods for common audit events

  public async logLogin(req: Request, userId: string, outcome: 'SUCCESS' | 'FAILURE', errorMessage?: string): Promise<void> {
    const clientInfo = this.extractClientInfo(req);
    await this.log({
      event_type: outcome === 'SUCCESS' ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILED,
      user_id: userId,
      action: 'User login attempt',
      details: { email: req.body.email },
      risk_level: outcome === 'FAILURE' ? RiskLevel.MEDIUM : RiskLevel.LOW,
      outcome,
      error_message: errorMessage,
      ...clientInfo
    });
  }

  public async logLogout(req: Request, userId: string): Promise<void> {
    const clientInfo = this.extractClientInfo(req);
    await this.log({
      event_type: AuditEventType.LOGOUT,
      user_id: userId,
      session_id: (req as any).session?.id,
      action: 'User logout',
      ...clientInfo
    });
  }

  public async logDataOperation(
    req: Request, 
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    resourceType: string,
    resourceId: string,
    details?: any
  ): Promise<void> {
    const clientInfo = this.extractClientInfo(req);
    const user = (req as any).user;
    
    await this.log({
      event_type: AuditEventType[operation],
      user_id: user?.id,
      session_id: (req as any).session?.id,
      resource_type: resourceType,
      resource_id: resourceId,
      action: `${operation.toLowerCase()} ${resourceType}`,
      details: details || {},
      organization_id: user?.organization_id,
      risk_level: operation === 'DELETE' ? RiskLevel.HIGH : RiskLevel.LOW,
      ...clientInfo
    });
  }

  public async logSecurityEvent(
    req: Request, 
    eventType: AuditEventType, 
    details: any, 
    riskLevel: RiskLevel = RiskLevel.HIGH
  ): Promise<void> {
    const clientInfo = this.extractClientInfo(req);
    const user = (req as any).user;

    await this.log({
      event_type: eventType,
      user_id: user?.id,
      session_id: (req as any).session?.id,
      action: 'Security event detected',
      details,
      risk_level: riskLevel,
      organization_id: user?.organization_id,
      ...clientInfo
    });
  }

  public async logAdminAction(
    req: Request,
    action: string,
    targetUserId?: string,
    details?: any
  ): Promise<void> {
    const clientInfo = this.extractClientInfo(req);
    const user = (req as any).user;

    await this.log({
      event_type: AuditEventType.USER_UPDATED, // Generic admin action
      user_id: user?.id,
      session_id: (req as any).session?.id,
      resource_type: 'user',
      resource_id: targetUserId,
      action,
      details: details || {},
      risk_level: RiskLevel.MEDIUM,
      organization_id: user?.organization_id,
      ...clientInfo
    });
  }
}

// Audit middleware factory
export class AuditMiddleware {
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = AuditLogger.getInstance();
  }

  // Middleware to automatically log API requests
  logApiAccess = (options?: {
    excludePaths?: string[];
    includeBody?: boolean;
    includeQuery?: boolean;
  }) => {
    const { excludePaths = ['/health', '/metrics'], includeBody = false, includeQuery = true } = options || {};

    return (req: Request, res: Response, next: NextFunction) => {
      // Skip logging for excluded paths
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      const startTime = Date.now();
      const user = (req as any).user;

      // Capture response
      const originalSend = res.send;
      let responseBody: any;

      res.send = function(data: any) {
        responseBody = data;
        return originalSend.call(this, data);
      };

      // Log after response
      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        const clientInfo = this.auditLogger['extractClientInfo'](req);

        const details: any = {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          duration_ms: duration
        };

        if (includeQuery && Object.keys(req.query).length > 0) {
          details.query = req.query;
        }

        if (includeBody && req.body && Object.keys(req.body).length > 0) {
          details.body = this.auditLogger['sanitizeData'](req.body);
        }

        await this.auditLogger.log({
          event_type: AuditEventType.READ, // Default to READ for API access
          user_id: user?.id,
          session_id: (req as any).session?.id,
          action: `${req.method} ${req.path}`,
          details,
          outcome: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
          organization_id: user?.organization_id,
          risk_level: RiskLevel.LOW,
          ...clientInfo
        });
      });

      next();
    };
  };

  // Middleware for specific resource operations
  logResourceOperation = (resourceType: string, operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE') => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const resourceId = req.params.id || 'unknown';
      
      try {
        await this.auditLogger.logDataOperation(req, operation, resourceType, resourceId, {
          method: req.method,
          path: req.path
        });
      } catch (error) {
        console.error('Audit logging failed:', error);
      }

      next();
    };
  };
}

// Database schema for audit logs
export const AUDIT_LOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id),
    session_id UUID,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    risk_level VARCHAR(20) DEFAULT 'LOW',
    organization_id UUID REFERENCES organizations(id),
    correlation_id UUID,
    outcome VARCHAR(20) DEFAULT 'SUCCESS',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
`;

// Export instances
export const auditLogger = AuditLogger.getInstance();
export const auditMiddleware = new AuditMiddleware();

export default AuditLogger;