import { Request, Response } from 'express';
import { query } from './db.js';
import crypto from 'crypto';

export interface SessionData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo: Record<string, any>;
  isActive: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  expirationHours?: number;
}

// Hash token for secure storage
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate a secure session token
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new session in the database
export async function createSession(options: CreateSessionOptions): Promise<{ sessionId: string; token: string }> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expirationHours = options.expirationHours || 2; // Default 2 hours for better security
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO user_sessions 
     (user_id, token_hash, expires_at, last_activity, ip_address, user_agent, device_info, is_active) 
     VALUES ($1, $2, $3, NOW(), $4, $5, $6, true) 
     RETURNING id`,
    [
      options.userId,
      tokenHash,
      expiresAt,
      options.ipAddress,
      options.userAgent,
      JSON.stringify(options.deviceInfo || {})
    ]
  );

  return {
    sessionId: result.rows[0].id,
    token
  };
}

// Validate session by token
export async function validateSession(token: string): Promise<SessionData | null> {
  const tokenHash = hashToken(token);
  
  const result = await query(
    `SELECT id, user_id, token_hash, expires_at, last_activity, ip_address, 
            user_agent, device_info, is_active 
     FROM user_sessions 
     WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  
  // Check for inactivity timeout (30 minutes)
  const lastActivity = new Date(row.last_activity);
  const inactivityTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  const timeSinceActivity = Date.now() - lastActivity.getTime();
  
  if (timeSinceActivity > inactivityTimeout) {
    // Invalidate session due to inactivity
    await invalidateSession(row.id);
    return null;
  }
  
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at),
    lastActivity: new Date(row.last_activity),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: row.device_info || {},
    isActive: row.is_active
  };
}

// Update session activity
export async function updateSessionActivity(sessionId: string): Promise<void> {
  await query(
    'UPDATE user_sessions SET last_activity = NOW(), updated_at = NOW() WHERE id = $1',
    [sessionId]
  );
}

// Extend session expiration
export async function extendSession(sessionId: string, additionalHours: number = 1): Promise<void> {
  await query(
    `UPDATE user_sessions 
     SET expires_at = expires_at + INTERVAL '${additionalHours} hours',
         last_activity = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );
}

// Invalidate a specific session
export async function invalidateSession(sessionId: string, reason: string = 'manual'): Promise<void> {
  await query(
    `UPDATE user_sessions 
     SET is_active = false, logout_reason = $2, updated_at = NOW() 
     WHERE id = $1`,
    [sessionId, reason]
  );
}

// Invalidate all sessions for a user
export async function invalidateUserSessions(userId: string, reason: string = 'revoked'): Promise<void> {
  await query(
    `UPDATE user_sessions 
     SET is_active = false, logout_reason = $2, updated_at = NOW() 
     WHERE user_id = $1 AND is_active = true`,
    [userId, reason]
  );
}

// Get active sessions for a user
export async function getUserActiveSessions(userId: string): Promise<SessionData[]> {
  const result = await query(
    `SELECT id, user_id, token_hash, expires_at, last_activity, ip_address,
            user_agent, device_info, is_active
     FROM user_sessions 
     WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
     ORDER BY last_activity DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at),
    lastActivity: new Date(row.last_activity),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: row.device_info || {},
    isActive: row.is_active
  }));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `UPDATE user_sessions 
     SET is_active = false, logout_reason = 'expired', updated_at = NOW()
     WHERE expires_at <= NOW() AND is_active = true 
     RETURNING id`
  );
  
  return result.rows.length;
}

// Session timeout based on inactivity
export async function timeoutInactiveSessions(timeoutMinutes: number = 30): Promise<number> {
  const result = await query(
    `UPDATE user_sessions 
     SET is_active = false, logout_reason = 'timeout', updated_at = NOW()
     WHERE last_activity < NOW() - INTERVAL '${timeoutMinutes} minutes' 
     AND is_active = true 
     RETURNING id`
  );
  
  return result.rows.length;
}

// Get session info with user details
export async function getSessionWithUser(sessionId: string): Promise<any> {
  const result = await query(
    `SELECT 
       s.id as session_id, s.expires_at, s.last_activity, s.ip_address, s.user_agent,
       u.id as user_id, u.email, u.first_name, u.last_name, u.role, u.organization_id
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.is_active = true`,
    [sessionId]
  );

  return result.rows[0] || null;
}

// Middleware to extract device information
export function extractDeviceInfo(req: Request): Record<string, any> {
  const userAgent = req.headers['user-agent'] || '';
  const deviceInfo: Record<string, any> = {
    userAgent,
    timestamp: new Date().toISOString()
  };

  // Extract basic device information from user agent
  if (userAgent.includes('Mobile')) {
    deviceInfo.deviceType = 'mobile';
  } else if (userAgent.includes('Tablet')) {
    deviceInfo.deviceType = 'tablet';
  } else {
    deviceInfo.deviceType = 'desktop';
  }

  // Extract browser information
  if (userAgent.includes('Chrome')) {
    deviceInfo.browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    deviceInfo.browser = 'Firefox';
  } else if (userAgent.includes('Safari')) {
    deviceInfo.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    deviceInfo.browser = 'Edge';
  }

  return deviceInfo;
}

// Get client IP address
export function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

// Session health check - returns active session count and expired sessions
export async function getSessionHealth(): Promise<{ activeSessions: number; expiredSessions: number }> {
  const activeResult = await query(
    'SELECT COUNT(*) as count FROM user_sessions WHERE is_active = true AND expires_at > NOW()'
  );
  
  const expiredResult = await query(
    'SELECT COUNT(*) as count FROM user_sessions WHERE expires_at <= NOW() AND is_active = true'
  );

  return {
    activeSessions: parseInt(activeResult.rows[0].count),
    expiredSessions: parseInt(expiredResult.rows[0].count)
  };
}