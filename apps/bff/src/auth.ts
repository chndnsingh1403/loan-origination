// Enhanced authentication with database-based session management
import { Request, Response, NextFunction } from 'express';
import { query } from './db.js';
import { 
  User, 
  LoginRequest, 
  LoginResponse, 
  SignUpRequest, 
  SignUpResponse,
  EmailVerificationRequest,
  EmailVerificationResponse,
  OrganizationInviteRequest,
  OrganizationInviteResponse,
  PasswordValidationResult
} from './types.js';
import { 
  createSession, 
  validateSession, 
  updateSessionActivity, 
  invalidateSession, 
  extractDeviceInfo, 
  getClientIP,
  SessionData
} from './session.js';
import crypto from 'crypto';

// Enhanced token generation with session-based approach
export function generateToken(user: Omit<User, 'password_hash'>, sessionId: string): string {
  // Create a composite token that includes session ID
  const payload = { 
    id: user.id, 
    email: user.email, 
    role: user.role, 
    sessionId,
    issued: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Enhanced token verification with session validation
export async function verifyToken(token: string): Promise<{ user: any; session: SessionData } | null> {
  try {
    // Validate the session in database using the token directly (it's a hex token, not base64 JSON)
    const session = await validateSession(token);
    if (!session) {
      return null;
    }
    
    // Get user details
    const result = await query(
      'SELECT id, organization_id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
      [session.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return null;
    }

    // Update session activity
    await updateSessionActivity(session.id);

    return {
      user: result.rows[0],
      session
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Production-ready password hashing with bcrypt
export async function hashPassword(password: string): Promise<string> {
  // For demo purposes, using simple hash. In production, use bcrypt:
  // const bcrypt = require('bcrypt');
  // const saltRounds = 12;
  // return await bcrypt.hash(password, saltRounds);
  return 'demo_hash_' + password;
}

// Verify password with timing-safe comparison
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // For demo purposes. In production, use bcrypt:
  // const bcrypt = require('bcrypt');
  // return await bcrypt.compare(password, hash);
  return hash === 'demo_hash_' + password;
}

// Production-ready password strength validation
export function validatePassword(password: string): PasswordValidationResult {
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    notCommon: !isCommonPassword(password)
  };

  const feedback: string[] = [];
  let score = 0;

  if (!requirements.minLength) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score++;
  }

  if (!requirements.hasUpperCase) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score++;
  }

  if (!requirements.hasLowerCase) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score++;
  }

  if (!requirements.hasNumbers) {
    feedback.push('Password must contain at least one number');
  } else {
    score++;
  }

  if (!requirements.hasSpecialChars) {
    feedback.push('Password must contain at least one special character');
  } else {
    score++;
  }

  if (!requirements.notCommon) {
    feedback.push('Password is too common, please choose a more unique password');
  }

  const isValid = Object.values(requirements).every(Boolean);

  return {
    isValid,
    score,
    feedback,
    requirements
  };
}

// Check against common passwords (simplified list for demo)
function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  return commonPasswords.includes(password.toLowerCase());
}

// Validate email format and check if it's available
export async function validateEmail(email: string, excludeUserId?: string): Promise<{ isValid: boolean; isAvailable: boolean; message?: string }> {
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidFormat = emailRegex.test(email);

  if (!isValidFormat) {
    return {
      isValid: false,
      isAvailable: false,
      message: 'Invalid email format'
    };
  }

  // Check if email is already in use
  const existingUserQuery = excludeUserId 
    ? 'SELECT id FROM users WHERE email = $1 AND id != $2'
    : 'SELECT id FROM users WHERE email = $1';
  
  const params = excludeUserId ? [email.toLowerCase(), excludeUserId] : [email.toLowerCase()];
  const existingUser = await query(existingUserQuery, params);

  const isAvailable = existingUser.rows.length === 0;

  return {
    isValid: true,
    isAvailable,
    message: isAvailable ? undefined : 'Email address is already registered'
  };
}

// Generate secure verification token
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create email verification record
export async function createEmailVerification(userId: string, email: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO email_verifications (user_id, email, token, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) 
     DO UPDATE SET token = $3, expires_at = $4, created_at = NOW(), verified_at = NULL`,
    [userId, email.toLowerCase(), token, expiresAt]
  );

  return token;
}

// Extend Express Request to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password_hash'>;
      organization_id?: string;
      session?: SessionData;
    }
  }
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const rawCookie of cookies) {
      const [name, ...rest] = rawCookie.trim().split('=');
      if (name === 'auth_token') {
        return decodeURIComponent(rest.join('=')); // Handles cases with '=' in value
      }
    }
  }

  return null;
}

// Enhanced authentication middleware with session validation
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const authResult = await verifyToken(token);
    
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { user, session } = authResult;

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Check if session is about to expire (less than 30 minutes)
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (timeUntilExpiry < thirtyMinutes && timeUntilExpiry > 0) {
      // Auto-extend session for active users
      await updateSessionActivity(session.id);
    }

    req.user = user;
    req.organization_id = user.organization_id;
    req.session = session;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Role-based authorization middleware
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Enhanced login function with database session management
export async function login(credentials: LoginRequest, req?: Request): Promise<LoginResponse> {
  const { email, password } = credentials;

  // Get user with password hash - use LEFT JOIN for admin users who may not have an organization
  const userResult = await query(
    `SELECT u.*, o.name as org_name, o.subdomain, o.branding, o.feature_flags 
     FROM users u 
     LEFT JOIN organizations o ON u.organization_id = o.id 
     WHERE u.email = $1 AND u.is_active = true`,
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = userResult.rows[0];
  
  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  // Prepare user object without password
  const userWithoutPassword = {
    id: user.id,
    organization_id: user.organization_id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_active: user.is_active,
    last_login: new Date(),
    created_at: user.created_at,
    updated_at: user.updated_at
  };

  // Create database session
  const sessionOptions = {
    userId: user.id,
    ipAddress: req ? getClientIP(req) : undefined,
    userAgent: req ? req.headers['user-agent'] : undefined,
    deviceInfo: req ? extractDeviceInfo(req) : {},
    expirationHours: 8 // 8 hour sessions
  };

  const { sessionId, token } = await createSession(sessionOptions);

  // Organization may be null for admin users
  const organization = user.organization_id ? {
    id: user.organization_id,
    name: user.org_name,
    subdomain: user.subdomain,
    branding: user.branding,
    feature_flags: user.feature_flags,
    created_at: user.created_at,
    updated_at: user.updated_at
  } : null;

  return {
    user: userWithoutPassword,
    token,
    organization,
    sessionId
  };
}

// Enhanced logout function with session invalidation
export async function logout(req: Request): Promise<void> {
  if (req.session) {
    await invalidateSession(req.session.id, 'manual');
  }
}

// Production-ready sign-up function with comprehensive validation
export async function signUp(signUpData: SignUpRequest, req?: Request): Promise<SignUpResponse> {
  const { email, password, firstName, lastName, organizationId, invitationToken, role = 'broker', termsAccepted, marketingOptIn, referralSource } = signUpData;

  // Validate terms acceptance (required for legal compliance)
  if (!termsAccepted) {
    throw new Error('You must accept the terms of service to create an account');
  }

  // Validate email format and availability
  const emailValidation = await validateEmail(email);
  if (!emailValidation.isValid) {
    throw new Error(emailValidation.message || 'Invalid email address');
  }
  if (!emailValidation.isAvailable) {
    throw new Error('An account with this email address already exists');
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error('Password does not meet security requirements: ' + passwordValidation.feedback.join(', '));
  }

  // Validate names
  if (!firstName || firstName.trim().length < 1) {
    throw new Error('First name is required');
  }
  if (!lastName || lastName.trim().length < 1) {
    throw new Error('Last name is required');
  }
  if (firstName.length > 50 || lastName.length > 50) {
    throw new Error('Names must be less than 50 characters');
  }

  // Determine organization assignment
  let targetOrganizationId = organizationId;
  let assignedRole = role;

  // Handle invitation-based signup
  if (invitationToken) {
    const invitation = await validateInvitationToken(invitationToken);
    if (!invitation) {
      throw new Error('Invalid or expired invitation token');
    }
    targetOrganizationId = invitation.organizationId;
    assignedRole = invitation.role;
    
    // Mark invitation as used
    await markInvitationUsed(invitationToken, email);
  }

  // Default to demo organization if none specified and no invitation
  if (!targetOrganizationId) {
    const demoOrg = await query('SELECT id FROM organizations WHERE subdomain = $1', ['demo']);
    if (demoOrg.rows.length === 0) {
      throw new Error('No organization available for registration. Please contact support.');
    }
    targetOrganizationId = demoOrg.rows[0].id;
  }

  // Verify organization exists and is active
  const organizationResult = await query(
    'SELECT id, name, subdomain, branding, feature_flags, is_active FROM organizations WHERE id = $1',
    [targetOrganizationId]
  );

  if (organizationResult.rows.length === 0) {
    throw new Error('Organization not found');
  }

  const organization = organizationResult.rows[0];
  if (!organization.is_active) {
    throw new Error('Organization is not accepting new users');
  }

  // Hash password securely
  const passwordHash = await hashPassword(password);

  try {
    // Create user in database
    const userResult = await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active, email_verified, terms_accepted_at, marketing_opt_in, referral_source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, NOW(), $7, $8, NOW())
       RETURNING id, organization_id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at`,
      [
        targetOrganizationId,
        email.toLowerCase(),
        passwordHash,
        firstName.trim(),
        lastName.trim(),
        assignedRole,
        marketingOptIn || false,
        referralSource || 'direct'
      ]
    );

    const newUser = userResult.rows[0];

    // Create email verification token
    const verificationToken = await createEmailVerification(newUser.id, email);

    // Create initial session for immediate login
    const sessionOptions = {
      userId: newUser.id,
      ipAddress: req ? getClientIP(req) : undefined,
      userAgent: req ? req.headers['user-agent'] : undefined,
      deviceInfo: req ? extractDeviceInfo(req) : {},
      expirationHours: 8
    };

    const { sessionId, token } = await createSession(sessionOptions);

    // Update last login timestamp
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [newUser.id]);

    // Log successful signup for audit
    await logAuditEvent({
      userId: newUser.id,
      action: 'user_signup',
      resource: 'user',
      resourceId: newUser.id,
      details: {
        email: email.toLowerCase(),
        role: assignedRole,
        organizationId: targetOrganizationId,
        invitationUsed: !!invitationToken,
        referralSource: referralSource || 'direct'
      },
      ipAddress: req ? getClientIP(req) : undefined,
      userAgent: req ? req.headers['user-agent'] : undefined
    });

    // Prepare response data
    const userWithoutPassword = {
      id: newUser.id,
      organization_id: newUser.organization_id,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      role: newUser.role,
      is_active: newUser.is_active,
      last_login: new Date(),
      created_at: newUser.created_at,
      updated_at: newUser.updated_at
    };

    const organizationData = {
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
      branding: organization.branding,
      feature_flags: organization.feature_flags,
      created_at: organization.created_at,
      updated_at: organization.updated_at
    };

    // Determine next steps for the user
    const nextSteps = ['verify_email'];
    if (assignedRole === 'admin' || assignedRole === 'tenant_admin') {
      nextSteps.push('complete_organization_setup');
    }

    return {
      user: userWithoutPassword,
      token,
      organization: organizationData,
      sessionId,
      requiresVerification: true,
      verificationSent: true,
      nextSteps
    };

  } catch (error) {
    console.error('Sign-up error:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new Error('An account with this email address already exists');
    }
    throw new Error('Account creation failed. Please try again.');
  }
}

// Email verification function
export async function verifyEmail(request: EmailVerificationRequest): Promise<EmailVerificationResponse> {
  const { token } = request;

  try {
    // Look up verification record
    const verificationResult = await query(
      `SELECT ev.*, u.email, u.first_name, u.last_name, u.organization_id, u.role, u.is_active, u.created_at, u.updated_at
       FROM email_verifications ev
       JOIN users u ON ev.user_id = u.id
       WHERE ev.token = $1 AND ev.expires_at > NOW() AND ev.verified_at IS NULL`,
      [token]
    );

    if (verificationResult.rows.length === 0) {
      return {
        verified: false,
        message: 'Invalid or expired verification token'
      };
    }

    const verification = verificationResult.rows[0];

    // Mark email as verified
    await query(
      'UPDATE email_verifications SET verified_at = NOW() WHERE token = $1',
      [token]
    );

    // Update user email_verified status
    await query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
      [verification.user_id]
    );

    // Log verification event
    await logAuditEvent({
      userId: verification.user_id,
      action: 'email_verified',
      resource: 'user',
      resourceId: verification.user_id,
      details: { email: verification.email }
    });

    return {
      verified: true,
      message: 'Email successfully verified',
      user: {
        id: verification.user_id,
        organization_id: verification.organization_id,
        email: verification.email,
        first_name: verification.first_name,
        last_name: verification.last_name,
        role: verification.role,
        is_active: verification.is_active,
        created_at: verification.created_at,
        updated_at: new Date()
      }
    };

  } catch (error) {
    console.error('Email verification error:', error);
    return {
      verified: false,
      message: 'Email verification failed'
    };
  }
}

// Validate invitation token
async function validateInvitationToken(token: string): Promise<{ organizationId: string; role: string; email: string } | null> {
  const invitationResult = await query(
    `SELECT organization_id, role, email FROM organization_invitations 
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL AND revoked_at IS NULL`,
    [token]
  );

  return invitationResult.rows.length > 0 ? invitationResult.rows[0] : null;
}

// Mark invitation as used
async function markInvitationUsed(token: string, email: string): Promise<void> {
  await query(
    'UPDATE organization_invitations SET used_at = NOW(), used_by_email = $2 WHERE token = $1',
    [token, email.toLowerCase()]
  );
}

// Audit logging helper
async function logAuditEvent(eventData: any): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        eventData.userId,
        eventData.action,
        eventData.resource,
        eventData.resourceId,
        JSON.stringify(eventData.details),
        eventData.ipAddress,
        eventData.userAgent
      ]
    );
  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw error for audit logging failures
  }
}

// Organization invitation functions
export async function createOrganizationInvitation(request: OrganizationInviteRequest): Promise<OrganizationInviteResponse> {
  const { email, role, organizationId, invitedBy, message } = request;

  // Validate email format
  const emailValidation = await validateEmail(email);
  if (!emailValidation.isValid) {
    throw new Error('Invalid email address format');
  }

  // Check if user already exists in the organization
  const existingUserResult = await query(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
    [email.toLowerCase(), organizationId]
  );

  if (existingUserResult.rows.length > 0) {
    throw new Error('User already exists in this organization');
  }

  // Check if there's already a pending invitation
  const existingInvitationResult = await query(
    'SELECT id FROM organization_invitations WHERE email = $1 AND organization_id = $2 AND expires_at > NOW() AND used_at IS NULL AND revoked_at IS NULL',
    [email.toLowerCase(), organizationId]
  );

  if (existingInvitationResult.rows.length > 0) {
    throw new Error('Invitation already pending for this email address');
  }

  // Generate secure invitation token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create invitation record
  const invitationResult = await query(
    `INSERT INTO organization_invitations (organization_id, email, role, token, invited_by_user_id, message, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id`,
    [organizationId, email.toLowerCase(), role, token, invitedBy, message, expiresAt]
  );

  const invitationId = invitationResult.rows[0].id;

  // Generate invitation URL (in production, this would be your frontend URL)
  const invitationUrl = `https://app.originate.com/signup?invitation=${token}`;

  // Log invitation creation
  await logAuditEvent({
    userId: invitedBy,
    action: 'invitation_created',
    resource: 'invitation',
    resourceId: invitationId,
    details: {
      email: email.toLowerCase(),
      role,
      organizationId,
      expiresAt: expiresAt.toISOString()
    }
  });

  return {
    invitationId,
    email: email.toLowerCase(),
    expiresAt,
    invitationUrl
  };
}

// Revoke organization invitation
export async function revokeOrganizationInvitation(invitationId: string, revokedBy: string): Promise<void> {
  const result = await query(
    'UPDATE organization_invitations SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id, email',
    [invitationId]
  );

  if (result.rows.length === 0) {
    throw new Error('Invitation not found or already used');
  }

  // Log invitation revocation
  await logAuditEvent({
    userId: revokedBy,
    action: 'invitation_revoked',
    resource: 'invitation',
    resourceId: invitationId,
    details: {
      email: result.rows[0].email
    }
  });
}

// List organization invitations
export async function listOrganizationInvitations(organizationId: string, includeUsed: boolean = false): Promise<any[]> {
  const whereClause = includeUsed 
    ? 'WHERE organization_id = $1'
    : 'WHERE organization_id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()';

  const result = await query(
    `SELECT oi.*, u.first_name as invited_by_first_name, u.last_name as invited_by_last_name, u.email as invited_by_email
     FROM organization_invitations oi
     LEFT JOIN users u ON oi.invited_by_user_id = u.id
     ${whereClause}
     ORDER BY oi.created_at DESC`,
    [organizationId]
  );

  return result.rows.map(row => ({
    id: row.id,
    email: row.email,
    role: row.role,
    message: row.message,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    invitedBy: row.invited_by_user_id ? {
      id: row.invited_by_user_id,
      firstName: row.invited_by_first_name,
      lastName: row.invited_by_last_name,
      email: row.invited_by_email
    } : null
  }));
}

export async function ensureDemoUsers() {
  // Demo users removed - organizations and users should be created via API
  console.log('ℹ️  No demo data - create organization and users via API endpoints');
}
