import express, { Request, Response } from 'express'
import cors from 'cors'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import * as Minio from 'minio'

// Import configuration management
import config, { EnvironmentUtils } from './config/environment.js'

// Import documentation setup
// import { setupSwagger } from './docs/swagger.js' // Temporarily disabled

// Import health monitoring
import { setupHealthEndpoints, requestTimingMiddleware } from './monitoring/healthEndpoints.js'

// Import request tracing
import { setupTracingEndpoints, requestTracingMiddleware } from './monitoring/tracingEndpoints.js'

// Import our auth, db, and types
import { authenticate, authorize, login, logout, signUp, verifyEmail, ensureDemoUsers, hashPassword } from './auth.js'
import { query } from './db.js'
import { cleanupExpiredSessions, timeoutInactiveSessions, extendSession } from './session.js'
import type { User, Lead, Application, ApplicationTemplate, PaginatedResponse, LoginRequest, LoginResponse, SignUpRequest, SignUpResponse, EmailVerificationRequest } from './types.js'

// Validate environment before starting
EnvironmentUtils.validateEnvironment()

const app = express()
const isProduction = process.env.NODE_ENV === 'production'
const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
}

// Configure CORS with security-first approach
const corsOrigin = config.get('CORS_ORIGIN');
const allowedOrigins = typeof corsOrigin === 'string' 
  ? corsOrigin.split(',').map((o: string) => o.trim())
  : corsOrigin;
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.get('CORS_CREDENTIALS'),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Body:`, JSON.stringify(req.body).substring(0, 200));
  next();
});

// Add request tracing middleware for comprehensive monitoring
app.use(requestTracingMiddleware)

// Add request timing middleware for performance monitoring
app.use(requestTimingMiddleware)

// Setup API documentation
// setupSwagger(app) // Temporarily disabled

// Setup health monitoring endpoints
setupHealthEndpoints(app)

// Setup request tracing endpoints
setupTracingEndpoints(app)

// =============== AUTHENTICATION ENDPOINTS ===============

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User authentication with database session management
 *     description: |
 *       Authenticates a user with email/password and creates a secure database-backed session.
 *       
 *       **Security Features:**
 *       - Password hashing with bcrypt (configurable rounds)
 *       - Session tokens stored securely in database
 *       - Rate limiting to prevent brute force attacks
 *       - Input validation and sanitization
 *       - Audit logging for security events
 *       
 *       **Session Management:**
 *       - Sessions automatically expire based on configuration
 *       - Inactive sessions are cleaned up periodically
 *       - Session extension on activity
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             broker:
 *               summary: Broker Login
 *               value:
 *                 email: "broker@originate.com"
 *                 password: "SecurePass123!"
 *             admin:
 *               summary: Admin Login
 *               value:
 *                 email: "admin@originate.com"
 *                 password: "AdminPass123!"
 *     responses:
 *       200:
 *         description: Authentication successful
 *         headers:
 *           X-Correlation-ID:
 *             $ref: '#/components/headers/X-Correlation-ID'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             examples:
 *               success:
 *                 summary: Successful Authentication
 *                 value:
 *                   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   sessionId: "123e4567-e89b-12d3-a456-426614174000"
 *                   user:
 *                     id: 1
 *                     email: "broker@originate.com"
 *                     name: "John Broker"
 *                     role: "broker"
 *                   expiresAt: "2024-01-15T18:30:00.000Z"
 *       400:
 *         description: Invalid request - missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "VALIDATION_ERROR"
 *               message: "Email and password required"
 *               correlationId: "123e4567-e89b-12d3-a456-426614174000"
 *       401:
 *         description: Authentication failed - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "AUTHENTICATION_FAILED"
 *               message: "Invalid email or password"
 *               correlationId: "123e4567-e89b-12d3-a456-426614174000"
 *       429:
 *         description: Too many authentication attempts
 *         headers:
 *           X-Rate-Limit-Remaining:
 *             $ref: '#/components/headers/X-Rate-Limit-Remaining'
 *           X-Rate-Limit-Reset:
 *             $ref: '#/components/headers/X-Rate-Limit-Reset'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     security: []
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const credentials: LoginRequest = req.body
    
    if (!credentials.email || !credentials.password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const response = await login(credentials, req)
    res.cookie('auth_token', response.token, authCookieOptions)
    res.json(response)
  } catch (error) {
    console.error('Login error:', error)
    if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(401).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
})

app.get('/api/auth/me', authenticate, (req: Request, res: Response) => {
  res.json({ 
    user: req.user,
    session: {
      id: req.session?.id,
      expiresAt: req.session?.expiresAt,
      lastActivity: req.session?.lastActivity
    }
  })
})

app.post('/api/auth/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await logout(req)
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
})

// Session management endpoints
app.get('/api/auth/validate', authenticate, async (req: Request, res: Response) => {
  try {
    // If authenticate middleware passes, session is valid
    res.json({ 
      valid: true, 
      user: {
        id: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
        organization_id: req.organization_id
      }
    })
  } catch (error) {
    console.error('Session validation error:', error)
    res.status(401).json({ valid: false, error: 'Invalid session' })
  }
})

app.post('/api/auth/extend-session', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.session) {
      await extendSession(req.session.id, 1) // Extend by 1 hour
      res.json({ ok: true, message: 'Session extended successfully' })
    } else {
      res.status(400).json({ error: 'No active session' })
    }
  } catch (error) {
    console.error('Session extension error:', error)
    res.status(500).json({ error: 'Failed to extend session' })
  }
})

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User registration with comprehensive validation
 *     description: |
 *       Creates a new user account with email verification and organization assignment.
 *       
 *       **Security Features:**
 *       - Password strength validation (8+ chars, mixed case, numbers, special chars)
 *       - Email format validation and duplicate checking
 *       - Terms of service acceptance requirement
 *       - Audit logging for compliance
 *       - Rate limiting protection
 *       - Input sanitization and validation
 *       
 *       **Multi-tenant Support:**
 *       - Organization-based user assignment
 *       - Invitation token support
 *       - Role-based access control
 *       
 *       **Post-signup Flow:**
 *       1. Account created (inactive until email verified)
 *       2. Email verification sent
 *       3. User can login but will see verification prompt
 *       4. Full access granted after email verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignUpRequest'
 *           examples:
 *             standard_signup:
 *               summary: Standard User Registration
 *               value:
 *                 email: "newuser@example.com"
 *                 password: "SecurePass123!"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 termsAccepted: true
 *                 marketingOptIn: false
 *                 referralSource: "google_search"
 *             invited_user:
 *               summary: Invitation-based Registration
 *               value:
 *                 email: "invited@company.com"
 *                 password: "SecurePass123!"
 *                 firstName: "Jane"
 *                 lastName: "Smith"
 *                 invitationToken: "abc123def456"
 *                 termsAccepted: true
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignUpResponse'
 *             example:
 *               user:
 *                 id: "123"
 *                 email: "newuser@example.com"
 *                 first_name: "John"
 *                 last_name: "Doe"
 *                 role: "broker"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               organization:
 *                 id: "org_456"
 *                 name: "Demo Financial"
 *                 subdomain: "demo"
 *               sessionId: "sess_789"
 *               requiresVerification: true
 *               verificationSent: true
 *               nextSteps: ["verify_email"]
 *       400:
 *         description: Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               password_weak:
 *                 summary: Weak Password
 *                 value:
 *                   error: "VALIDATION_ERROR"
 *                   message: "Password does not meet security requirements: Password must contain at least one uppercase letter, Password must contain at least one special character"
 *                   correlationId: "123e4567-e89b-12d3-a456-426614174000"
 *               email_taken:
 *                 summary: Email Already Registered
 *                 value:
 *                   error: "VALIDATION_ERROR"
 *                   message: "An account with this email address already exists"
 *                   correlationId: "123e4567-e89b-12d3-a456-426614174000"
 *               terms_not_accepted:
 *                 summary: Terms Not Accepted
 *                 value:
 *                   error: "VALIDATION_ERROR"
 *                   message: "You must accept the terms of service to create an account"
 *                   correlationId: "123e4567-e89b-12d3-a456-426614174000"
 *       429:
 *         description: Too many registration attempts
 *         headers:
 *           X-Rate-Limit-Remaining:
 *             $ref: '#/components/headers/X-Rate-Limit-Remaining'
 *           X-Rate-Limit-Reset:
 *             $ref: '#/components/headers/X-Rate-Limit-Reset'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     security: []
 */
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const signUpData: SignUpRequest = req.body;
    
    // Basic validation
    if (!signUpData.email || !signUpData.password || !signUpData.firstName || !signUpData.lastName) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        message: 'Email, password, first name, and last name are required' 
      });
    }

    if (!signUpData.termsAccepted) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR',
        message: 'You must accept the terms of service to create an account' 
      });
    }

    const response = await signUp(signUpData, req);
    res.status(201).json(response);
  } catch (error) {
    console.error('Sign-up error:', error);
    if (error instanceof Error) {
      if (error.message.includes('already exists') || 
          error.message.includes('security requirements') ||
          error.message.includes('required') ||
          error.message.includes('accept the terms')) {
        res.status(400).json({ 
          error: 'VALIDATION_ERROR',
          message: error.message 
        });
      } else {
        res.status(500).json({ 
          error: 'SIGNUP_FAILED',
          message: 'Account creation failed. Please try again.' 
        });
      }
    } else {
      res.status(500).json({ 
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred' 
      });
    }
  }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Email verification activation
 *     description: |
 *       Activates a user account by verifying the email address using the token
 *       sent to their email during registration.
 *       
 *       **Security Features:**
 *       - Time-limited verification tokens (24 hours)
 *       - One-time use tokens
 *       - Secure token generation
 *       - Audit logging
 *       
 *       **Flow:**
 *       1. User receives verification email after signup
 *       2. User clicks verification link or enters token
 *       3. Token validated and account activated
 *       4. User gains full access to the platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailVerificationRequest'
 *           example:
 *             token: "abc123def456789"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailVerificationResponse'
 *             example:
 *               verified: true
 *               message: "Email successfully verified"
 *               user:
 *                 id: "123"
 *                 email: "user@example.com"
 *                 first_name: "John"
 *                 last_name: "Doe"
 *       400:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailVerificationResponse'
 *             example:
 *               verified: false
 *               message: "Invalid or expired verification token"
 *       500:
 *         description: Internal server error
 *     security: []
 */
app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const verificationData: EmailVerificationRequest = req.body;
    
    if (!verificationData.token) {
      return res.status(400).json({ 
        verified: false,
        message: 'Verification token is required' 
      });
    }

    const response = await verifyEmail(verificationData);
    
    if (response.verified) {
      res.json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      verified: false,
      message: 'Email verification failed' 
    });
  }
});

// Mount authentication routes
// app.use('/api/auth', authRoutes) - we've implemented inline above

// =============== DASHBOARD STATISTICS ===============

app.get("/api/dashboard/stats", authenticate, async (req, res) => {
  try {
    // Get total users in organization
    const usersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = $1 AND is_active = true',
      [req.organization_id]
    );
    
    // Get total applications
    const appsResult = await query(
      'SELECT COUNT(*) as count FROM applications WHERE organization_id = $1',
      [req.organization_id]
    );
    
    // Get pending applications
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM applications 
       WHERE organization_id = $1 AND status IN ('submitted', 'under_review', 'underwriting')`,
      [req.organization_id]
    );
    
    // Get total templates
    const templatesResult = await query(
      'SELECT COUNT(*) as count FROM application_templates WHERE organization_id = $1',
      [req.organization_id]
    );
    
    // Get recent activity from audit logs (last 10 activities)
    const activityResult = await query(
      `SELECT al.id, al.action, al.details, al.created_at, 
              u.first_name || ' ' || u.last_name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE (al.user_id IN (SELECT id FROM users WHERE organization_id = $1))
          OR (al.details->>'organization_id' = $1::text)
       ORDER BY al.created_at DESC
       LIMIT 10`,
      [req.organization_id]
    );
    
    // Format recent activity
    const recentActivity = activityResult.rows.map(row => ({
      id: row.id,
      type: row.action,
      description: getActivityDescription(row.action, row.details),
      timestamp: row.created_at,
      user: row.user_name || row.user_email || 'System'
    }));
    
    res.json({
      totalUsers: parseInt(usersResult.rows[0].count),
      totalApplications: parseInt(appsResult.rows[0].count),
      totalTemplates: parseInt(templatesResult.rows[0].count),
      pendingApplications: parseInt(pendingResult.rows[0].count),
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Helper function to format activity descriptions
function getActivityDescription(action: string, details: any): string {
  const descriptions: { [key: string]: string } = {
    'user_login': 'User logged in',
    'user_logout': 'User logged out',
    'user_signup': 'New user signed up',
    'email_verified': 'Email address verified',
    'application_created': 'New application created',
    'application_submitted': 'Application submitted',
    'application_approved': 'Application approved',
    'application_declined': 'Application declined',
    'template_created': 'Application template created',
    'template_updated': 'Application template updated',
    'lead_created': 'New lead created',
    'lead_converted': 'Lead converted to application'
  };
  
  return descriptions[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// =============== APPLICATION TEMPLATES ===============

app.get("/api/templates", authenticate, authorize('tenant_admin', 'admin', 'broker'), async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, lp.name as loan_product_name 
       FROM application_templates t
       LEFT JOIN loan_products lp ON t.loan_product_id = lp.id
       WHERE t.organization_id = $1 
       ORDER BY t.name`,
      [req.organization_id]
    )
    // Parse form_schema from JSONB and extract stages
    const templates = result.rows.map(row => ({
      ...row,
      stages: row.form_schema?.stages || []
    }))
    res.json({ items: templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

app.post("/api/templates", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { name, loan_product_id, form_schema, validation_rules } = req.body
    
    // Production-ready validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' })
    }

    if (!form_schema || typeof form_schema !== 'object') {
      return res.status(400).json({ error: 'Valid form_schema is required' })
    }

    // Validate stages structure
    if (!form_schema.stages || !Array.isArray(form_schema.stages)) {
      return res.status(400).json({ error: 'form_schema must have a stages array' })
    }

    if (form_schema.stages.length === 0) {
      return res.status(400).json({ error: 'At least one stage is required' })
    }

    // Validate loan product if provided
    if (loan_product_id) {
      const productCheck = await query(
        'SELECT id FROM loan_products WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [loan_product_id, req.organization_id]
      )
      
      if (productCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive loan product' })
      }
    }

    // Create the template
    const result = await query(
      `INSERT INTO application_templates 
       (organization_id, loan_product_id, name, form_schema, validation_rules, version, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, true, NOW(), NOW())
       RETURNING *`,
      [
        req.organization_id, 
        loan_product_id || null, 
        name.trim(), 
        JSON.stringify(form_schema), 
        JSON.stringify(validation_rules || {})
      ]
    )

    const template = result.rows[0]

    // Audit log
    const totalFields = form_schema.stages.reduce((sum: number, stage: any) => sum + (stage.fields?.length || 0), 0)
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        req.user.id,
        'template_created',
        'application_template',
        template.id,
        JSON.stringify({ 
          template_name: name.trim(),
          loan_product_id,
          stage_count: form_schema.stages.length,
          field_count: totalFields
        }),
        req.ip,
        req.headers['user-agent']
      ]
    )

    console.log(`✅ Template created: ${template.id} - ${name} by user ${req.user.email}`)
    
    res.status(201).json(template)
  } catch (error) {
    console.error('Error creating template:', error)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

app.put("/api/templates/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, loan_product_id, form_schema, validation_rules, is_active } = req.body
    
    const result = await query(
      `UPDATE application_templates 
       SET name = COALESCE($1, name),
           loan_product_id = COALESCE($2, loan_product_id),
           form_schema = COALESCE($3, form_schema),
           validation_rules = COALESCE($4, validation_rules),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 AND organization_id = $7
       RETURNING *`,
      [name, loan_product_id, form_schema ? JSON.stringify(form_schema) : null, 
       validation_rules ? JSON.stringify(validation_rules) : null, is_active, id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating template:', error)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

app.delete("/api/templates/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'UPDATE application_templates SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    res.json({ message: 'Template deactivated successfully' })
  } catch (error) {
    console.error('Error deleting template:', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// =============== USER MANAGEMENT ENDPOINTS ===============

app.get("/api/users", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active, created_at, last_login
       FROM users WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.organization_id]
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.post("/api/users", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { email, first_name, last_name, role, password } = req.body
    
    if (!email || !first_name || !last_name || !role || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if (req.user?.role === 'tenant_admin' && role === 'admin') {
      return res.status(403).json({ error: 'Tenant administrators cannot create admin users' })
    }

    // For admin users, allow specifying organization via header
    // For tenant_admin users, always use their own organization
    const targetOrgId = req.user?.role === 'admin' 
      ? (req.headers['x-organization-id'] as string || req.organization_id)
      : req.organization_id;

    if (!targetOrgId && role !== 'admin') {
      return res.status(400).json({ error: 'Organization ID is required for non-admin users' })
    }

    const hashedPassword = await hashPassword(password)
    
    const result = await query(
      `INSERT INTO users 
       (organization_id, email, password_hash, first_name, last_name, role, is_active, email_verified, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW())
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [targetOrgId, email, hashedPassword, first_name, last_name, role]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error: any) {
    console.error('Error creating user:', error)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists' })
    }
    res.status(500).json({ error: 'Failed to create user' })
  }
})

app.put("/api/users/:id", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { first_name, last_name, role, is_active } = req.body
    
    const existing = await query(
      `SELECT id, role FROM users WHERE id = $1 AND organization_id = $2`,
      [id, req.organization_id]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (req.user?.role === 'tenant_admin') {
      if (existing.rows[0].role === 'admin') {
        return res.status(403).json({ error: 'Tenant administrators cannot modify admin users' })
      }
      if (role === 'admin') {
        return res.status(403).json({ error: 'Tenant administrators cannot assign admin role' })
      }
    }

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           role = COALESCE($3, role),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND organization_id = $6
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [first_name, last_name, role, is_active, id, req.organization_id]
    )
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

app.delete("/api/users/:id", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { id } = req.params

    const existing = await query(
      'SELECT role FROM users WHERE id = $1 AND organization_id = $2',
      [id, req.organization_id]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (req.user?.role === 'tenant_admin' && existing.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Tenant administrators cannot deactivate admin users' })
    }

    const result = await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    res.json({ message: 'User deactivated successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// =============== ROLE & PERMISSION MANAGEMENT ENDPOINTS ===============

// Get all permissions
app.get("/api/permissions", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, code, name, description, category, is_active
       FROM permissions 
       WHERE is_active = true
       ORDER BY category, name`
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    res.status(500).json({ error: 'Failed to fetch permissions' })
  }
})

// Get role definitions for organization
app.get("/api/roles", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT rd.id, rd.name, rd.description, rd.is_system_role, rd.is_active,
              rd.created_at, rd.updated_at,
              json_agg(
                json_build_object(
                  'permission_id', p.id,
                  'code', p.code,
                  'name', p.name,
                  'category', p.category
                )
              ) FILTER (WHERE p.id IS NOT NULL) as permissions
       FROM role_definitions rd
       LEFT JOIN role_permissions rp ON rd.id = rp.role_definition_id AND rp.granted = true
       LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
       WHERE rd.organization_id = $1 OR rd.organization_id IS NULL
       GROUP BY rd.id
       ORDER BY rd.is_system_role DESC, rd.name`,
      [req.organization_id]
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching roles:', error)
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
})

// Create custom role
app.post("/api/roles", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { name, description, permission_ids } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Role name is required' })
    }

    // Create role
    const roleResult = await query(
      `INSERT INTO role_definitions (organization_id, name, description, is_system_role, is_active)
       VALUES ($1, $2, $3, false, true)
       RETURNING id, name, description, is_system_role, is_active, created_at`,
      [req.organization_id, name, description || '', ]
    )

    const roleId = roleResult.rows[0].id

    // Add permissions if provided
    if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
      const permissionValues = permission_ids.map((permId: string) => `('${roleId}', '${permId}', true)`).join(',')
      await query(
        `INSERT INTO role_permissions (role_definition_id, permission_id, granted)
         VALUES ${permissionValues}
         ON CONFLICT (role_definition_id, permission_id) DO NOTHING`
      )
    }

    res.status(201).json(roleResult.rows[0])
  } catch (error: any) {
    console.error('Error creating role:', error)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Role with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create role' })
  }
})

// Update role
app.put("/api/roles/:id", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, permission_ids } = req.body

    // Check if role exists and is not a system role
    const existing = await query(
      `SELECT id, is_system_role FROM role_definitions 
       WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
      [id, req.organization_id]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' })
    }

    if (existing.rows[0].is_system_role) {
      return res.status(403).json({ error: 'System roles cannot be modified' })
    }

    // Update role
    await query(
      `UPDATE role_definitions 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3`,
      [name, description, id]
    )

    // Update permissions if provided
    if (permission_ids && Array.isArray(permission_ids)) {
      // Remove existing permissions
      await query('DELETE FROM role_permissions WHERE role_definition_id = $1', [id])
      
      // Add new permissions
      if (permission_ids.length > 0) {
        const permissionValues = permission_ids.map((permId: string) => `('${id}', '${permId}', true)`).join(',')
        await query(
          `INSERT INTO role_permissions (role_definition_id, permission_id, granted)
           VALUES ${permissionValues}
           ON CONFLICT (role_definition_id, permission_id) DO NOTHING`
        )
      }
    }

    // Fetch updated role
    const result = await query(
      `SELECT rd.id, rd.name, rd.description, rd.is_system_role, rd.is_active,
              json_agg(
                json_build_object(
                  'permission_id', p.id,
                  'code', p.code,
                  'name', p.name
                )
              ) FILTER (WHERE p.id IS NOT NULL) as permissions
       FROM role_definitions rd
       LEFT JOIN role_permissions rp ON rd.id = rp.role_definition_id AND rp.granted = true
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE rd.id = $1
       GROUP BY rd.id`,
      [id]
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating role:', error)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

// Delete role
app.delete("/api/roles/:id", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { id } = req.params

    const existing = await query(
      `SELECT is_system_role FROM role_definitions 
       WHERE id = $1 AND organization_id = $2`,
      [id, req.organization_id]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' })
    }

    if (existing.rows[0].is_system_role) {
      return res.status(403).json({ error: 'System roles cannot be deleted' })
    }

    await query('DELETE FROM role_definitions WHERE id = $1', [id])
    res.json({ message: 'Role deleted successfully' })
  } catch (error) {
    console.error('Error deleting role:', error)
    res.status(500).json({ error: 'Failed to delete role' })
  }
})

// =============== USER INVITATION ENDPOINTS ===============

// Send user invitation
app.post("/api/users/invite", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { email, role, message } = req.body
    
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' })
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' })
    }

    // Check for existing pending invitation
    const existingInvite = await query(
      `SELECT id FROM organization_invitations 
       WHERE email = $1 AND organization_id = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`,
      [email, req.organization_id]
    )

    if (existingInvite.rows.length > 0) {
      return res.status(409).json({ error: 'Pending invitation already exists for this email' })
    }

    // Generate unique token
    const { v4: uuidv4 } = await import('uuid')
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const result = await query(
      `INSERT INTO organization_invitations 
       (organization_id, email, role, token, invited_by_user_id, message, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, token, expires_at, created_at`,
      [req.organization_id, email, role, token, req.user?.id, message || '', expiresAt]
    )

    // In production, send actual email here
    // For now, just return the invitation link
    const invitationLink = `${req.headers.origin}/accept-invite?token=${token}`

    res.status(201).json({
      ...result.rows[0],
      invitation_link: invitationLink
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    res.status(500).json({ error: 'Failed to create invitation' })
  }
})

// Get pending invitations
app.get("/api/users/invitations", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT i.id, i.email, i.role, i.message, i.expires_at, i.created_at,
              u.first_name as invited_by_first_name, u.last_name as invited_by_last_name
       FROM organization_invitations i
       LEFT JOIN users u ON i.invited_by_user_id = u.id
       WHERE i.organization_id = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL
       ORDER BY i.created_at DESC`,
      [req.organization_id]
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    res.status(500).json({ error: 'Failed to fetch invitations' })
  }
})

// Revoke invitation
app.delete("/api/users/invitations/:id", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      `UPDATE organization_invitations 
       SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND used_at IS NULL
       RETURNING id`,
      [id, req.organization_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already used' })
    }

    res.json({ message: 'Invitation revoked successfully' })
  } catch (error) {
    console.error('Error revoking invitation:', error)
    res.status(500).json({ error: 'Failed to revoke invitation' })
  }
})

// Bulk user actions
app.post("/api/users/bulk", authenticate, authorize('admin', 'tenant_admin'), async (req, res) => {
  try {
    const { action, user_ids } = req.body
    
    if (!action || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'Action and user_ids are required' })
    }

    let query_text = ''
    let success_message = ''

    switch (action) {
      case 'activate':
        query_text = `UPDATE users SET is_active = true, updated_at = NOW() 
                     WHERE id = ANY($1) AND organization_id = $2 
                     RETURNING id`
        success_message = 'Users activated successfully'
        break
      case 'deactivate':
        query_text = `UPDATE users SET is_active = false, updated_at = NOW() 
                     WHERE id = ANY($1) AND organization_id = $2 
                     RETURNING id`
        success_message = 'Users deactivated successfully'
        break
      case 'delete':
        query_text = `DELETE FROM users 
                     WHERE id = ANY($1) AND organization_id = $2 
                     RETURNING id`
        success_message = 'Users deleted successfully'
        break
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }

    const result = await query(query_text, [user_ids, req.organization_id])
    
    res.json({ 
      message: success_message,
      affected_count: result.rows.length
    })
  } catch (error) {
    console.error('Error performing bulk action:', error)
    res.status(500).json({ error: 'Failed to perform bulk action' })
  }
})

// =============== WORKFLOW MANAGEMENT ENDPOINTS ===============

app.get("/api/workflows", authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM workflows WHERE organization_id = $1 ORDER BY name`,
      [req.organization_id]
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching workflows:', error)
    res.status(500).json({ error: 'Failed to fetch workflows' })
  }
})

app.post("/api/workflows", authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, steps_schema } = req.body
    
    if (!name || !steps_schema) {
      return res.status(400).json({ error: 'Name and steps_schema are required' })
    }

    const result = await query(
      `INSERT INTO workflows 
       (organization_id, name, description, steps_schema, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING *`,
      [req.organization_id, name, description || '', JSON.stringify(steps_schema)]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating workflow:', error)
    res.status(500).json({ error: 'Failed to create workflow' })
  }
})

// =============== AUDIT LOGS ENDPOINTS ===============

app.get("/api/audit-logs", authenticate, authorize('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    
    const result = await query(
      `SELECT al.*, u.email as user_email, u.first_name, u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.organization_id, limit, offset]
    )
    
    res.json({ items: result.rows, limit, offset })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

// =============== CONFIGURATION ENDPOINTS ===============

app.get("/api/config/branding", authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT branding FROM organizations WHERE id = $1',
      [req.organization_id]
    )
    res.json(result.rows[0]?.branding || {
      companyName: "Originate Lite",
      primaryColor: "#3b82f6",
      logoUrl: ""
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branding' })
  }
})

app.put("/api/config/branding", authenticate, authorize('admin'), async (req, res) => {
  try {
    await query(
      'UPDATE organizations SET branding = $1 WHERE id = $2',
      [req.body, req.organization_id]
    )
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branding' })
  }
})

app.get("/api/config/feature-flags", authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT feature_flags FROM organizations WHERE id = $1',
      [req.organization_id]
    )
    res.json(result.rows[0]?.feature_flags || {
      enableLeadCapture: true,
      enableDocumentUpload: true,
      enableAutomatedUnderwriting: false
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feature flags' })
  }
})

app.put("/api/config/feature-flags", authenticate, authorize('admin'), async (req, res) => {
  try {
    await query(
      'UPDATE organizations SET feature_flags = $1 WHERE id = $2',
      [req.body, req.organization_id]
    )
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update feature flags' })
  }
})

app.get("/api/config/workflow", authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT workflow_config FROM organizations WHERE id = $1',
      [req.organization_id]
    )
    res.json(result.rows[0]?.workflow_config || {
      states: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DECIDED", "FUNDED"],
      transitions: [
        { from: "DRAFT", to: "SUBMITTED", event: "submit" },
        { from: "SUBMITTED", to: "UNDER_REVIEW", event: "review" },
        { from: "UNDER_REVIEW", to: "DECIDED", event: "decide" },
        { from: "DECIDED", to: "FUNDED", event: "fund" }
      ]
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflow' })
  }
})

app.put("/api/config/workflow", authenticate, authorize('admin'), async (req, res) => {
  try {
    await query(
      'UPDATE organizations SET workflow_config = $1 WHERE id = $2',
      [req.body, req.organization_id]
    )
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update workflow' })
  }
})

// =============== BROKER ENDPOINTS ===============

app.get("/api/broker/leads", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const status = req.query.status as string
    const page = parseInt(req.query.page as string) || 1
    const per_page = parseInt(req.query.per_page as string) || 20
    const offset = (page - 1) * per_page

    let whereClause = 'WHERE organization_id = $1'
    const params = [req.organization_id]

    if (status && status !== 'all') {
      whereClause += ` AND status = $2`
      params.push(status)
    }

    const countResult = await query(`SELECT COUNT(*) FROM leads ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count)

    const leadsResult = await query(
      `SELECT * FROM leads ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per_page, offset]
    )

    res.json({
      items: leadsResult.rows,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page)
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

app.post("/api/broker/leads", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, phone, requested_amount, loan_purpose } = req.body

    const result = await query(
      `INSERT INTO leads (organization_id, first_name, last_name, email, phone, requested_amount, purpose, status, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', 'manual', NOW())
       RETURNING *`,
      [req.organization_id, first_name, last_name, email, phone, requested_amount, loan_purpose]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating lead:', error)
    res.status(500).json({ error: 'Failed to create lead' })
  }
})

app.get("/api/broker/applications", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const status = req.query.status as string
    const page = parseInt(req.query.page as string) || 1
    const per_page = parseInt(req.query.per_page as string) || 20
    const offset = (page - 1) * per_page

    let whereClause = 'WHERE a.organization_id = $1'
    const params = [req.organization_id]

    if (status && status !== 'all') {
      whereClause += ` AND a.status = $2`
      params.push(status)
    }

    const countResult = await query(`SELECT COUNT(*) FROM applications a ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count)

    const appsResult = await query(
      `SELECT a.*, lp.name as product_name, 
              u1.first_name as broker_first_name, u1.last_name as broker_last_name
       FROM applications a 
       LEFT JOIN loan_products lp ON a.loan_product_id = lp.id
       LEFT JOIN users u1 ON a.assigned_broker_id = u1.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per_page, offset]
    )

    const applications = appsResult.rows.map(app => ({
      id: app.id,
      application_number: app.application_number,
      customer: `${(app.applicant_data?.first_name || 'Unknown')} ${(app.applicant_data?.last_name || '')}`,
      product: app.product_name || 'No Product',
      status: app.status,
      stage: app.stage,
      requested_amount: app.requested_amount,
      requested_term_months: app.requested_term_months,
      purpose: app.purpose,
      approved_amount: app.approved_amount,
      broker: app.broker_first_name ? `${app.broker_first_name} ${app.broker_last_name}` : 'Unassigned',
      created: app.created_at?.toISOString().split('T')[0] || 'Unknown',
      submitted_at: app.submitted_at?.toISOString().split('T')[0] || null,
      applicant_data: app.applicant_data
    }))

    res.json({
      items: applications,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page)
    })
  } catch (error) {
    console.error('Error fetching applications:', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
})

app.post("/api/broker/applications", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const { 
      loan_product_id, 
      template_id,
      applicant_data
    } = req.body

    // Extract required fields from applicant_data
    const requested_amount = applicant_data?.loan_amount || 0
    const requested_term_months = applicant_data?.loan_term || 12
    const purpose = applicant_data?.loan_purpose || 'Other'

    // Generate unique application number (format: APP-YYYYMMDD-XXXXX)
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
    const application_number = `APP-${date}-${random}`

    const result = await query(
      `INSERT INTO applications (
        organization_id, loan_product_id, template_id, application_number,
        requested_amount, requested_term_months, purpose,
        applicant_data, status, stage, assigned_broker_id, created_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'application', $9, NOW())
       RETURNING *`,
      [
        req.organization_id, loan_product_id, template_id, application_number,
        requested_amount, requested_term_months, purpose,
        JSON.stringify(applicant_data),
        req.user?.id
      ]
    )

    const application = result.rows[0]

    // Auto-generate tasks from task_setups for this loan product
    const taskSetups = await query(
      `SELECT * FROM task_setups 
       WHERE loan_product_id = $1 AND is_active = true 
       ORDER BY sequence_order ASC`,
      [loan_product_id]
    )

    if (taskSetups.rows.length > 0) {
      for (const taskSetup of taskSetups.rows) {
        await query(
          `INSERT INTO application_tasks (
            application_id, task_setup_id, name, description, task_type,
            assigned_role, status, sequence_order, is_required,
            created_at, updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, NOW(), NOW())`,
          [
            application.id,
            taskSetup.id,
            taskSetup.name,
            taskSetup.description,
            taskSetup.task_type,
            taskSetup.assigned_role,
            taskSetup.sequence_order,
            taskSetup.is_required
          ]
        )
      }
    }

    res.status(201).json(application)
  } catch (error) {
    console.error('Error creating application:', error)
    console.error('Error details:', {
      message: error.message,
      detail: error.detail,
      code: error.code,
      stack: error.stack
    })
    res.status(500).json({ 
      error: 'Failed to create application',
      details: error.message 
    })
  }
})

// Submit application for underwriting
app.post("/api/broker/applications/:id/submit", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const { id } = req.params

    // Verify application belongs to broker's organization and is in draft status
    const checkResult = await query(
      `SELECT id, status FROM applications WHERE id = $1 AND organization_id = $2 AND assigned_broker_id = $3`,
      [id, req.organization_id, req.user?.id]
    )

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' })
    }

    if (checkResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Only draft applications can be submitted' })
    }

    // Update status to submitted
    const result = await query(
      `UPDATE applications 
       SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )

    res.json({ 
      success: true, 
      application: result.rows[0],
      message: 'Application submitted successfully'
    })
  } catch (error) {
    console.error('Error submitting application:', error)
    res.status(500).json({ error: 'Failed to submit application' })
  }
})

// Broker Pipeline Stats
app.get("/api/broker/pipeline/stats", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_applications,
        COUNT(*) FILTER (WHERE status = 'submitted') as pending,
        COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'funded') as funded,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COALESCE(SUM(requested_amount), 0) as total_amount
       FROM applications 
       WHERE organization_id = $1 AND assigned_broker_id = $2`,
      [req.organization_id, req.user?.id]
    )

    const avgTimeResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (decision_date - submitted_at))/86400) as avg_days
       FROM applications 
       WHERE organization_id = $1 
       AND assigned_broker_id = $2
       AND submitted_at IS NOT NULL 
       AND decision_date IS NOT NULL`,
      [req.organization_id, req.user?.id]
    )

    const stats = statsResult.rows[0]
    const avgDays = avgTimeResult.rows[0]?.avg_days || 0

    res.json({
      total_applications: parseInt(stats.total_applications),
      pending: parseInt(stats.pending),
      under_review: parseInt(stats.under_review),
      approved: parseInt(stats.approved),
      funded: parseInt(stats.funded),
      declined: parseInt(stats.declined),
      total_amount: parseFloat(stats.total_amount),
      avg_approval_time: Math.round(avgDays)
    })
  } catch (error) {
    console.error('Error fetching pipeline stats:', error)
    res.status(500).json({ error: 'Failed to fetch pipeline stats' })
  }
})

// Broker Pipeline Activities
app.get("/api/broker/pipeline/activities", authenticate, authorize('broker', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        a.id,
        a.application_number,
        a.status,
        a.stage,
        a.updated_at,
        a.applicant_data
       FROM applications a
       WHERE a.organization_id = $1 AND a.assigned_broker_id = $2
       ORDER BY a.updated_at DESC
       LIMIT 10`,
      [req.organization_id, req.user?.id]
    )

    const activities = result.rows.map(row => ({
      id: row.id,
      type: row.status,
      description: `${row.applicant_data?.first_name || 'Application'} ${row.applicant_data?.last_name || ''} - ${row.status}`,
      timestamp: row.updated_at?.toISOString()
    }))

    res.json({ items: activities })
  } catch (error) {
    console.error('Error fetching pipeline activities:', error)
    res.status(500).json({ error: 'Failed to fetch pipeline activities' })
  }
})

// =============== UNDERWRITER ENDPOINTS ===============

app.get("/api/underwriter/applications", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const status = req.query.status as string
    const page = parseInt(req.query.page as string) || 1
    const per_page = parseInt(req.query.per_page as string) || 20
    const offset = (page - 1) * per_page

    let whereClause = 'WHERE a.organization_id = $1'
    const params = [req.organization_id]

    if (status && status !== 'all') {
      whereClause += ` AND a.status = $2`
      params.push(status)
    } else if (!status) {
      // Default: Focus on applications in underwriting stages only when no filter is specified
      whereClause += ` AND a.status IN ('submitted', 'under_review', 'underwriting')`
    }
    // When status === 'all', show all applications regardless of status

    const countResult = await query(`SELECT COUNT(*) FROM applications a ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count)

    const appsResult = await query(
      `SELECT a.*, lp.name as product_name, 
              u1.first_name as broker_first_name, u1.last_name as broker_last_name
       FROM applications a 
       LEFT JOIN loan_products lp ON a.loan_product_id = lp.id
       LEFT JOIN users u1 ON a.assigned_broker_id = u1.id
       ${whereClause}
       ORDER BY a.submitted_at DESC, a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per_page, offset]
    )

    const applications = appsResult.rows.map(app => ({
      id: app.id,
      application_number: app.application_number,
      customer: `${(app.applicant_data?.first_name || 'Unknown')} ${(app.applicant_data?.last_name || '')}`,
      product: app.product_name || 'No Product',
      status: app.status,
      stage: app.stage,
      requested_amount: app.requested_amount,
      approved_amount: app.approved_amount,
      broker: app.broker_first_name ? `${app.broker_first_name} ${app.broker_last_name}` : 'Unassigned',
      submitted: app.submitted_at?.toISOString().split('T')[0] || 'Draft',
      days_in_queue: app.submitted_at ? Math.floor((Date.now() - new Date(app.submitted_at).getTime()) / (1000 * 60 * 60 * 24)) : 0
    }))

    res.json({
      items: applications,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page)
    })
  } catch (error) {
    console.error('Error fetching underwriter applications:', error)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
})

// Dashboard stats
app.get("/api/underwriter/dashboard/stats", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const statsResult = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review', 'underwriting')) as total_queue,
        COUNT(*) FILTER (WHERE status = 'submitted') as pending,
        COUNT(*) FILTER (WHERE status = 'under_review') as in_progress,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) FILTER (WHERE status = 'approved' AND DATE(updated_at) = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'approved' AND updated_at >= CURRENT_DATE - INTERVAL '7 days') as completed_week,
        COUNT(*) FILTER (WHERE status = 'approved' AND updated_at >= CURRENT_DATE - INTERVAL '30 days') as completed_month,
        COUNT(*) FILTER (WHERE status = 'approved') as total_approved,
        COUNT(*) FILTER (WHERE status = 'declined') as total_declined,
        AVG(EXTRACT(EPOCH FROM (updated_at - submitted_at))/3600) FILTER (WHERE status IN ('approved', 'declined') AND submitted_at IS NOT NULL) as avg_decision_hours
       FROM applications 
       WHERE organization_id = $1`,
      [req.organization_id]
    )

    const stats = statsResult.rows[0]
    const totalDecisions = parseInt(stats.total_approved) + parseInt(stats.total_declined)
    const approvalRate = totalDecisions > 0 ? Math.round((parseInt(stats.total_approved) / totalDecisions) * 100) : 0
    const declineRate = totalDecisions > 0 ? Math.round((parseInt(stats.total_declined) / totalDecisions) * 100) : 0

    res.json({
      queue: {
        total: parseInt(stats.total_queue) || 0,
        pending: parseInt(stats.pending) || 0,
        in_progress: parseInt(stats.in_progress) || 0,
        on_hold: parseInt(stats.on_hold) || 0
      },
      performance: {
        completed_today: parseInt(stats.completed_today) || 0,
        completed_week: parseInt(stats.completed_week) || 0,
        completed_month: parseInt(stats.completed_month) || 0,
        avg_decision_time: stats.avg_decision_hours ? `${Math.round(parseFloat(stats.avg_decision_hours))}h` : 'N/A'
      },
      rates: {
        approval_rate: approvalRate,
        decline_rate: declineRate
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
  }
})

// Recent applications for dashboard
app.get("/api/underwriter/dashboard/recent", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.application_number, a.applicant_data, a.requested_amount, a.status, a.submitted_at
       FROM applications a
       WHERE a.organization_id = $1 AND a.status IN ('submitted', 'under_review', 'underwriting')
       ORDER BY a.submitted_at DESC
       LIMIT 10`,
      [req.organization_id]
    )

    const recentApps = result.rows.map(row => ({
      id: row.id,
      application_number: row.application_number,
      customer: `${row.applicant_data?.first_name || 'Unknown'} ${row.applicant_data?.last_name || ''}`.trim(),
      amount: row.requested_amount,
      status: row.status,
      days_waiting: row.submitted_at ? Math.floor((Date.now() - new Date(row.submitted_at).getTime()) / (1000 * 60 * 60 * 24)) : 0
    }))

    res.json({ items: recentApps })
  } catch (error) {
    console.error('Error fetching recent applications:', error)
    res.status(500).json({ error: 'Failed to fetch recent applications' })
  }
})

// Get single application detail
app.get("/api/underwriter/applications/:id", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, lp.name as product_name, 
              u1.first_name || ' ' || u1.last_name as broker_name,
              org.name as organization_name
       FROM applications a
       LEFT JOIN loan_products lp ON a.loan_product_id = lp.id
       LEFT JOIN users u1 ON a.assigned_broker_id = u1.id
       LEFT JOIN organizations org ON a.organization_id = org.id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, req.organization_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching application:', error)
    res.status(500).json({ error: 'Failed to fetch application' })
  }
})

// Get risk assessment for application
app.get("/api/underwriter/applications/:id/risk", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const result = await query(
      'SELECT applicant_data, requested_amount FROM applications WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' })
    }

    const app = result.rows[0]
    const data = app.applicant_data || {}

    // Placeholder risk calculations
    const annualIncome = parseFloat(data.annual_income) || 0
    const monthlyIncome = annualIncome / 12
    const monthlyDebts = (parseFloat(data.monthly_mortgage) || 0) + 
                         (parseFloat(data.monthly_car_payment) || 0) + 
                         (parseFloat(data.credit_card_debt) || 0) / 12 + 
                         (parseFloat(data.student_loans) || 0) / 12 + 
                         (parseFloat(data.other_debts) || 0) / 12

    const dtiRatio = monthlyIncome > 0 ? Math.round((monthlyDebts / monthlyIncome) * 100) : 0
    
    // Estimated monthly payment (simplified: principal/term at 7% APR)
    const loanAmount = parseFloat(app.requested_amount) || 0
    const estimatedMonthlyPayment = loanAmount > 0 ? loanAmount / 36 * 1.02 : 0 // Simple estimate
    const paymentToIncome = monthlyIncome > 0 ? Math.round((estimatedMonthlyPayment / monthlyIncome) * 100) : 0

    // LTV placeholder (would need property value from applicant_data)
    const propertyValue = parseFloat(data.property_value) || loanAmount * 1.2
    const ltvRatio = Math.round((loanAmount / propertyValue) * 100)

    // Risk scoring (placeholder logic)
    let riskScore = 0
    const factors: string[] = []

    if (dtiRatio > 43) {
      riskScore += 30
      factors.push('High DTI ratio (>43%)')
    } else if (dtiRatio > 36) {
      riskScore += 15
      factors.push('Elevated DTI ratio (36-43%)')
    }

    if (ltvRatio > 80) {
      riskScore += 25
      factors.push('High LTV ratio (>80%)')
    } else if (ltvRatio > 70) {
      riskScore += 10
      factors.push('Moderate LTV ratio (70-80%)')
    }

    if (paymentToIncome > 28) {
      riskScore += 20
      factors.push('High payment-to-income ratio (>28%)')
    }

    if (annualIncome < 30000) {
      riskScore += 15
      factors.push('Low income (<$30k)')
    }

    if (factors.length === 0) {
      factors.push('Good financial profile')
    }

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 
      riskScore < 25 ? 'LOW' : riskScore < 50 ? 'MEDIUM' : 'HIGH'

    res.json({
      dti_ratio: dtiRatio,
      ltv_ratio: ltvRatio,
      payment_to_income: paymentToIncome,
      risk_score: riskScore,
      risk_level: riskLevel,
      factors
    })
  } catch (error) {
    console.error('Error calculating risk:', error)
    res.status(500).json({ error: 'Failed to calculate risk assessment' })
  }
})

// Get notes for application
app.get("/api/underwriter/applications/:id/notes", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, u.first_name || ' ' || u.last_name as user_name
       FROM application_notes n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.application_id = $1
       ORDER BY n.created_at DESC`,
      [req.params.id]
    )

    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching notes:', error)
    res.status(500).json({ error: 'Failed to fetch notes' })
  }
})

// Add note to application
app.post("/api/underwriter/notes", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const { application_id, content, is_internal } = req.body

    if (!application_id || !content) {
      return res.status(400).json({ error: 'application_id and content are required' })
    }

    const result = await query(
      `INSERT INTO application_notes (application_id, user_id, content, is_internal, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [application_id, req.user.id, content, is_internal !== false]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error adding note:', error)
    res.status(500).json({ error: 'Failed to add note' })
  }
})

// Submit decision
app.post("/api/underwriter/decision", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const { application_id, decision, notes, counter_offer } = req.body

    if (!application_id || !decision) {
      return res.status(400).json({ error: 'application_id and decision are required' })
    }

    const validDecisions = ['approve', 'decline', 'counter', 'request_info']
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision type' })
    }

    // Update application status
    const statusMap: Record<string, string> = {
      'approve': 'approved',
      'decline': 'declined',
      'counter': 'counter_offer',
      'request_info': 'pending_info'
    }

    const newStatus = statusMap[decision]
    
    await query(
      `UPDATE applications 
       SET status = $1, 
           approved_amount = $2,
           assigned_underwriter_id = $3,
           updated_at = NOW()
       WHERE id = $4 AND organization_id = $5`,
      [
        newStatus,
        decision === 'approve' ? req.body.approved_amount || null : null,
        req.user.id,
        application_id,
        req.organization_id
      ]
    )

    // Add decision note
    if (notes) {
      await query(
        `INSERT INTO application_notes (application_id, user_id, content, is_internal, created_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [application_id, req.user.id, `Decision: ${decision.toUpperCase()} - ${notes}`]
      )
    }

    // Log to audit trail
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
       VALUES ($1, $2, 'application', $3, $4, NOW())`,
      [
        req.user.id,
        'application_decision',
        application_id,
        JSON.stringify({ decision, notes, counter_offer })
      ]
    )

    res.json({ ok: true, message: 'Decision submitted successfully', status: newStatus })
  } catch (error) {
    console.error('Error submitting decision:', error)
    res.status(500).json({ error: 'Failed to submit decision' })
  }
})

// =============== OPENAPI DOCUMENTATION ===============

app.get("/v1/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.0.0",
    info: { title: "Originate Lite API", version: "1.0.0" },
    paths: {
      "/api/auth/login": { post: { summary: "User login" } },
      "/api/auth/me": { get: { summary: "Get current user" } },
      "/api/templates": { get: { summary: "List application templates" } },
      "/api/config/branding": { get: { summary: "Get branding" }, put: { summary: "Update branding" } },
      "/api/config/feature-flags": { get: { summary: "Get flags" }, put: { summary: "Update flags" } },
      "/api/config/workflow": { get: { summary: "Get workflow" }, put: { summary: "Update workflow" } },
      "/api/broker/leads": { get: { summary: "List leads" }, post: { summary: "Create lead" } },
      "/api/broker/applications": { get: { summary: "List applications" }, post: { summary: "Create application" } },
      "/api/underwriter/applications": { get: { summary: "List applications for underwriting" } },
      "/api/db/seed": { post: { summary: "Seed demo data" } },
      "/api/files/presign": { get: { summary: "Create presigned PUT/GET URLs" } },
      "/api/queue/test": { post: { summary: "Send SQS message (LocalStack)" } },
      "/api/copilot/faq": { get: { summary: "FAQ search using local knowledge" } }
    }
  })
})

// =============== WEBHOOK & INFRASTRUCTURE ===============

async function signBody(secret: string, body: string) {
  const crypto = await import('crypto')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return 'sha256=' + sig
}

app.post("/v1/webhooks/test", async (req, res) => {
  const target = req.query.target as string
  const secret = (req.query.secret as string) || "demo-secret"
  if (!target) return res.status(400).json({ error: "target query param required" })
  const body = JSON.stringify({ event: "TestEvent", at: new Date().toISOString(), sample: { id: "evt_123" } })
  const sig = await signBody(secret, body)
  try {
    const fetchMod = await import('node-fetch').catch(() => ({ default: null }))
    const fetchFn = (globalThis.fetch || fetchMod?.default)
    if (!fetchFn) throw new Error("No fetch available")
    const r = await fetchFn(target, { method: "POST", headers: { "Content-Type": "application/json", "X-Signature": sig }, body })
    res.json({ ok: true, status: r.status, sent: JSON.parse(body), signature: sig })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message, signature: sig, sent: JSON.parse(body) })
  }
})

// =============== DATABASE & INFRA SETUP ===============

const {
  MINIO_ENDPOINT = 'minio',
  MINIO_PORT = '9000',
  MINIO_USE_SSL = 'false',
  MINIO_ACCESS_KEY = 'minioadmin',
  MINIO_SECRET_KEY = 'minioadmin',
  MINIO_BUCKET = 'originate-docs'
} = process.env

// Database seeding
app.post("/api/db/seed", authenticate, authorize('admin'), async (req, res) => {
  try {
    const orgId = req.organization_id;
    
    // Check if already seeded
    const existingProducts = await query(
      'SELECT COUNT(*) as count FROM loan_products WHERE organization_id = $1',
      [orgId]
    );
    
    if (existingProducts.rows[0].count > 0) {
      return res.json({ 
        message: 'Demo data already exists for this organization. Please delete existing data first.',
        existingProducts: existingProducts.rows[0].count
      });
    }
    
    // Seed loan products
    const productResult = await query(`
      INSERT INTO loan_products (
        organization_id, name, product_type, description, 
        min_amount, max_amount, min_term_months, max_term_months,
        base_rate, max_rate, processing_fee, credit_score_requirement, income_requirement
      )
      VALUES 
        ($1, 'Personal Loan - Standard', 'personal', 'Unsecured personal loan for various purposes', 1000, 50000, 12, 60, 0.0699, 0.1599, 99.00, 650, 30000),
        ($1, 'Auto Loan - New Vehicle', 'auto', 'Financing for new vehicle purchases', 5000, 100000, 24, 84, 0.0399, 0.0899, 0, 680, 35000),
        ($1, 'Mortgage - Conventional', 'mortgage', '30-year fixed rate mortgage', 50000, 1000000, 180, 360, 0.0325, 0.0625, 0, 700, 50000),
        ($1, 'Business Loan - Small', 'business', 'Small business term loan', 10000, 250000, 12, 60, 0.0599, 0.1299, 500.00, 650, 75000)
      RETURNING id, name
    `, [orgId]);

    // Seed application templates
    const templateResult = await query(`
      INSERT INTO application_templates (
        organization_id, loan_product_id, name, form_schema, validation_rules
      )
      VALUES 
        ($1, $2, 'Standard Personal Loan Application', $3, $4),
        ($1, $5, 'Auto Loan Application', $6, $7)
      RETURNING id
    `, [
      orgId,
      productResult.rows[0]?.id || null,
      JSON.stringify({
        fields: [
          { name: 'full_name', type: 'text', required: true, label: 'Full Name' },
          { name: 'email', type: 'email', required: true, label: 'Email' },
          { name: 'phone', type: 'tel', required: true, label: 'Phone Number' },
          { name: 'ssn', type: 'text', required: true, label: 'SSN' },
          { name: 'annual_income', type: 'number', required: true, label: 'Annual Income' },
          { name: 'employment_status', type: 'select', required: true, label: 'Employment Status' }
        ]
      }),
      JSON.stringify({ min_income: 30000, max_dti: 0.43 }),
      productResult.rows[1]?.id || null,
      JSON.stringify({
        fields: [
          { name: 'full_name', type: 'text', required: true, label: 'Full Name' },
          { name: 'vehicle_year', type: 'number', required: true, label: 'Vehicle Year' },
          { name: 'vehicle_make', type: 'text', required: true, label: 'Vehicle Make' },
          { name: 'vehicle_model', type: 'text', required: true, label: 'Vehicle Model' },
          { name: 'vehicle_price', type: 'number', required: true, label: 'Vehicle Price' },
          { name: 'down_payment', type: 'number', required: true, label: 'Down Payment' }
        ]
      }),
      JSON.stringify({ min_down_payment_percent: 0.10 })
    ]);

    // Seed some demo applications
    const appNumbers = ['APP-2025-001', 'APP-2025-002', 'APP-2025-003', 'APP-2025-004', 'APP-2025-005'];
    const statuses = ['submitted', 'under_review', 'underwriting', 'approved', 'submitted'];
    
    for (let i = 0; i < 5; i++) {
      await query(`
        INSERT INTO applications (
          organization_id, loan_product_id, application_number, 
          requested_amount, requested_term_months, applicant_data, 
          status, submitted_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${i} days', NOW() - INTERVAL '${i + 1} days')
        ON CONFLICT (application_number) DO NOTHING
      `, [
        orgId,
        productResult.rows[i % productResult.rows.length]?.id || null,
        appNumbers[i],
        5000 + (i * 5000),
        12 + (i * 12),
        JSON.stringify({
          full_name: `Demo Applicant ${i + 1}`,
          email: `applicant${i + 1}@example.com`,
          phone: `555-010${i}`,
          annual_income: 50000 + (i * 10000)
        }),
        statuses[i]
      ]);
    }

    // Seed audit logs for recent activity
    await query(`
      INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
      VALUES 
        ($1, 'template_created', 'template', $2, NOW() - INTERVAL '2 hours'),
        ($1, 'application_submitted', 'application', $3, NOW() - INTERVAL '4 hours'),
        ($1, 'user_login', 'user', $4, NOW() - INTERVAL '6 hours'),
        ($1, 'application_approved', 'application', $5, NOW() - INTERVAL '1 day')
    `, [
      req.user.id,
      JSON.stringify({ template_name: 'Personal Loan Application', organization_id: orgId }),
      JSON.stringify({ application_number: 'APP-2025-001', organization_id: orgId }),
      JSON.stringify({ email: req.user.email, organization_id: orgId }),
      JSON.stringify({ application_number: 'APP-2025-004', organization_id: orgId })
    ]);

    res.json({ 
      ok: true, 
      message: "Demo data seeded successfully",
      summary: {
        loan_products: productResult.rows.length,
        templates: templateResult.rows.length,
        applications: 5,
        audit_logs: 4
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ 
      error: "Failed to seed demo data",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
})

// Clean up duplicate demo data
app.delete("/api/db/cleanup", authenticate, authorize('admin'), async (req, res) => {
  try {
    const orgId = req.organization_id;
    
    console.log(`🗑️ Starting cleanup for organization: ${orgId}`);
    
    // First, count what we have
    const countResult = await query(
      'SELECT COUNT(*) as count FROM loan_products WHERE organization_id = $1',
      [orgId]
    );
    console.log(`Found ${countResult.rows[0].count} loan products to delete`);
    
    // Delete in correct order to avoid foreign key violations
    // 1. Delete applications first (references loan_products and templates)
    const appResult = await query(
      'DELETE FROM applications WHERE organization_id = $1 RETURNING id',
      [orgId]
    );
    console.log(`Deleted ${appResult.rows.length} applications`);
    
    // 2. Delete templates (references loan_products)
    const templateResult = await query(
      'DELETE FROM application_templates WHERE organization_id = $1 RETURNING id',
      [orgId]
    );
    console.log(`Deleted ${templateResult.rows.length} templates`);
    
    // 3. Now safe to delete loan products
    const productResult = await query(
      'DELETE FROM loan_products WHERE organization_id = $1 RETURNING id',
      [orgId]
    );
    console.log(`Deleted ${productResult.rows.length} loan products`);
    
    console.log(`✅ Cleanup complete for org ${orgId}: ${productResult.rows.length} products, ${templateResult.rows.length} templates, ${appResult.rows.length} applications deleted`);
    
    res.json({
      ok: true,
      message: "Demo data cleaned up successfully",
      summary: {
        loan_products_deleted: productResult.rows.length,
        templates_deleted: templateResult.rows.length,
        applications_deleted: appResult.rows.length
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      error: "Failed to cleanup data",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
})

// Get database stats
app.get("/api/db/stats", authenticate, async (req, res) => {
  try {
    const orgId = req.organization_id;
    
    const productsCount = await query(
      'SELECT COUNT(*) as count FROM loan_products WHERE organization_id = $1',
      [orgId]
    );
    
    const templatesCount = await query(
      'SELECT COUNT(*) as count FROM application_templates WHERE organization_id = $1',
      [orgId]
    );
    
    const appsCount = await query(
      'SELECT COUNT(*) as count FROM applications WHERE organization_id = $1',
      [orgId]
    );
    
    // Get unique product names to detect duplicates
    const uniqueProducts = await query(
      'SELECT name, COUNT(*) as count FROM loan_products WHERE organization_id = $1 GROUP BY name ORDER BY count DESC',
      [orgId]
    );
    
    res.json({
      total: {
        loan_products: parseInt(productsCount.rows[0].count),
        templates: parseInt(templatesCount.rows[0].count),
        applications: parseInt(appsCount.rows[0].count)
      },
      duplicates: uniqueProducts.rows.filter(p => parseInt(p.count) > 1)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
})

app.get("/api/db/apps", authenticate, async (_req, res) => {
  try {
    const result = await query('SELECT id, application_number, status, created_at FROM applications LIMIT 10')
    res.json({ items: result.rows })
  } catch (error) {
    res.status(500).json({ error: "DB query failed" })
  }
})

// File upload with MinIO
const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: parseInt(MINIO_PORT),
  useSSL: MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

app.get("/api/files/presign", authenticate, async (req, res) => {
  try {
    const fileName = req.query.fileName as string
    if (!fileName) return res.status(400).json({ error: "fileName required" })
    
    const putUrl = await minioClient.presignedPutObject(MINIO_BUCKET, fileName, 24 * 60 * 60)
    const getUrl = await minioClient.presignedGetObject(MINIO_BUCKET, fileName, 24 * 60 * 60)
    
    res.json({ putUrl, getUrl, fileName })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// SQS messaging
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.SQS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

app.post("/api/queue/test", authenticate, async (req, res) => {
  try {
    const queueUrl = process.env.SQS_QUEUE_URL || 'http://localstack:4566/000000000000/originate-events'
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ event: 'test', user: req.user?.email, timestamp: new Date() })
    })
    const result = await sqsClient.send(command)
    res.json({ ok: true, messageId: result.MessageId })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// =============== LOAN PRODUCTS ENDPOINTS ===============

app.get("/api/loan-products", authenticate, async (req, res) => {
  try {
    console.log(`Fetching loan products for organization: ${req.organization_id}`)
    
    const result = await query(
      'SELECT * FROM loan_products WHERE organization_id = $1 AND is_active = true ORDER BY name',
      [req.organization_id]
    )
    
    console.log(`Found ${result.rows.length} loan products`)
    console.log('Products:', result.rows.map(p => ({ id: p.id, name: p.name, type: p.type })))
    
    // Convert decimal rates back to percentages for frontend
    const products = result.rows.map(product => ({
      ...product,
      base_rate: parseFloat(product.base_rate) * 100,
      max_rate: parseFloat(product.max_rate) * 100
    }))
    
    res.json({ items: products })
  } catch (error) {
    console.error('Error fetching loan products:', error)
    res.status(500).json({ error: 'Failed to fetch loan products' })
  }
})

app.get("/api/loan-products/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const result = await query(
      'SELECT * FROM loan_products WHERE id = $1 AND organization_id = $2',
      [id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan product not found' })
    }
    
    // Convert decimal rates back to percentages for frontend
    const product = {
      ...result.rows[0],
      base_rate: parseFloat(result.rows[0].base_rate) * 100,
      max_rate: parseFloat(result.rows[0].max_rate) * 100
    }
    
    res.json(product)
  } catch (error) {
    console.error('Error fetching loan product:', error)
    res.status(500).json({ error: 'Failed to fetch loan product' })
  }
})

app.post("/api/loan-products", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    console.log('📝 Creating loan product:', req.body);
    
    const {
      name,
      description,
      product_type,
      min_amount,
      max_amount,
      min_term_months,
      max_term_months,
      base_rate,
      max_rate,
      processing_fee,
      is_active,
      credit_score_requirement,
      income_requirement
    } = req.body

    // Validation
    if (!name || !product_type || !min_amount || !max_amount || !min_term_months || !max_term_months || !base_rate || !max_rate) {
      console.error('❌ Validation failed - missing required fields');
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (min_amount >= max_amount) {
      console.error('❌ Validation failed - min_amount >= max_amount');
      return res.status(400).json({ error: 'Minimum amount must be less than maximum amount' })
    }

    if (min_term_months >= max_term_months) {
      console.error('❌ Validation failed - min_term_months >= max_term_months');
      return res.status(400).json({ error: 'Minimum term must be less than maximum term' })
    }

    if (base_rate >= max_rate) {
      console.error('❌ Validation failed - base_rate >= max_rate');
      return res.status(400).json({ error: 'Base rate must be less than maximum rate' })
    }

    console.log('✅ Validation passed, inserting into database...');

    // Convert percentage rates to decimal (e.g., 5.5% -> 0.055)
    const baseRateDecimal = base_rate / 100;
    const maxRateDecimal = max_rate / 100;

    const result = await query(
      `INSERT INTO loan_products (
        organization_id, name, description, product_type, min_amount, max_amount,
        min_term_months, max_term_months, base_rate, max_rate, processing_fee,
        is_active, credit_score_requirement, income_requirement, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        req.organization_id, name, description, product_type, min_amount, max_amount,
        min_term_months, max_term_months, baseRateDecimal, maxRateDecimal, processing_fee || 0,
        is_active !== false, credit_score_requirement || 600, income_requirement || 0
      ]
    )

    console.log('✅ Loan product created:', result.rows[0].id);
    // Convert decimal rates back to percentages for frontend
    const product = {
      ...result.rows[0],
      base_rate: parseFloat(result.rows[0].base_rate) * 100,
      max_rate: parseFloat(result.rows[0].max_rate) * 100
    }
    res.status(201).json(product)
  } catch (error) {
    console.error('❌ Error creating loan product:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
    res.status(500).json({ error: 'Failed to create loan product', details: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.put("/api/loan-products/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      description,
      product_type,
      min_amount,
      max_amount,
      min_term_months,
      max_term_months,
      base_rate,
      max_rate,
      processing_fee,
      is_active,
      credit_score_requirement,
      income_requirement
    } = req.body

    // Validation
    if (!name || !product_type || !min_amount || !max_amount || !min_term_months || !max_term_months || !base_rate || !max_rate) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (min_amount >= max_amount) {
      return res.status(400).json({ error: 'Minimum amount must be less than maximum amount' })
    }

    if (min_term_months >= max_term_months) {
      return res.status(400).json({ error: 'Minimum term must be less than maximum term' })
    }

    if (base_rate >= max_rate) {
      return res.status(400).json({ error: 'Base rate must be less than maximum rate' })
    }

    // Convert percentage rates to decimal (e.g., 5.5% -> 0.055)
    const baseRateDecimal = base_rate / 100;
    const maxRateDecimal = max_rate / 100;

    const result = await query(
      `UPDATE loan_products SET
        name = $1, description = $2, product_type = $3, min_amount = $4, max_amount = $5,
        min_term_months = $6, max_term_months = $7, base_rate = $8, max_rate = $9,
        processing_fee = $10, is_active = $11, credit_score_requirement = $12,
        income_requirement = $13, updated_at = NOW()
      WHERE id = $14 AND organization_id = $15
      RETURNING *`,
      [
        name, description, product_type, min_amount, max_amount,
        min_term_months, max_term_months, baseRateDecimal, maxRateDecimal, processing_fee || 0,
        is_active !== false, credit_score_requirement || 600, income_requirement || 0,
        id, req.organization_id
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan product not found' })
    }

    // Convert decimal rates back to percentages for frontend
    const product = {
      ...result.rows[0],
      base_rate: parseFloat(result.rows[0].base_rate) * 100,
      max_rate: parseFloat(result.rows[0].max_rate) * 100
    }

    res.json(product)
  } catch (error) {
    console.error('Error updating loan product:', error)
    res.status(500).json({ error: 'Failed to update loan product' })
  }
})

app.patch("/api/loan-products/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Build dynamic query based on provided fields
    const validFields = [
      'name', 'description', 'product_type', 'min_amount', 'max_amount',
      'min_term_months', 'max_term_months', 'base_rate', 'max_rate',
      'processing_fee', 'is_active', 'credit_score_requirement', 'income_requirement'
    ]
    
    const updateFields = Object.keys(updates).filter(key => validFields.includes(key))
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ')
    const values = updateFields.map(field => updates[field])
    values.push(new Date()) // for updated_at
    values.push(id)
    values.push(req.organization_id)

    const result = await query(
      `UPDATE loan_products SET ${setClause}, updated_at = $${values.length - 2} 
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan product not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating loan product:', error)
    res.status(500).json({ error: 'Failed to update loan product' })
  }
})

app.delete("/api/loan-products/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM loan_products WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, req.organization_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Loan product not found' })
    }

    res.json({ ok: true, deleted: result.rows[0] })
  } catch (error) {
    console.error('Error deleting loan product:', error)
    res.status(500).json({ error: 'Failed to delete loan product' })
  }
})

// FAQ search using local knowledge
const faqs = [
  { q: "How do I apply for a loan?", a: "You can start by filling out our online application form. The process typically takes 10-15 minutes." },
  { q: "What documents do I need?", a: "You'll need proof of income, identification, and bank statements for the last 3 months." },
  { q: "How long does approval take?", a: "Most applications are reviewed within 24-48 hours. Some may require additional documentation." }
]

function score(text: string, query: string): number {
  const words = query.toLowerCase().split(' ')
  const textLower = text.toLowerCase()
  return words.reduce((acc, word) => acc + (textLower.includes(word) ? 1 : 0), 0)
}

app.get("/api/copilot/faq", (req, res) => {
  const q = (req.query.q as string) || ""
  if (!q) return res.json({ items: faqs.slice(0, 3) })
  
  const hits = faqs.map(f => ({ ...f, _score: score(`${f.q} ${f.a}`, q) }))
    .filter(f => f._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
  
  res.json({ items: hits })
})

// =============== ORGANIZATION MANAGEMENT ENDPOINTS (Admin Only) ===============

// List all organizations
app.get("/api/organizations", authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, subdomain, branding, feature_flags, created_at, updated_at FROM organizations ORDER BY created_at DESC'
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    res.status(500).json({ error: 'Failed to fetch organizations' })
  }
})

// Get single organization
app.get("/api/organizations/:id", authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const result = await query(
      'SELECT id, name, subdomain, branding, feature_flags, created_at, updated_at FROM organizations WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching organization:', error)
    res.status(500).json({ error: 'Failed to fetch organization' })
  }
})

// Create organization
app.post("/api/organizations", authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, subdomain, branding, feature_flags } = req.body
    
    if (!name || !subdomain) {
      return res.status(400).json({ error: 'Name and subdomain are required' })
    }
    
    // Check if subdomain already exists
    const existing = await query(
      'SELECT id FROM organizations WHERE subdomain = $1',
      [subdomain]
    )
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Subdomain already exists' })
    }
    
    const result = await query(
      `INSERT INTO organizations (name, subdomain, branding, feature_flags) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, subdomain, branding, feature_flags, created_at, updated_at`,
      [name, subdomain, branding || {}, feature_flags || {}]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error: any) {
    console.error('Error creating organization:', error)
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Subdomain already exists' })
    }
    res.status(500).json({ error: 'Failed to create organization' })
  }
})

// Update organization
app.put("/api/organizations/:id", authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, subdomain, branding, feature_flags } = req.body
    
    const result = await query(
      `UPDATE organizations 
       SET name = COALESCE($1, name),
           subdomain = COALESCE($2, subdomain),
           branding = COALESCE($3, branding),
           feature_flags = COALESCE($4, feature_flags),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, subdomain, branding, feature_flags, created_at, updated_at`,
      [name, subdomain, branding, feature_flags, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating organization:', error)
    res.status(500).json({ error: 'Failed to update organization' })
  }
})

// Soft delete/deactivate organization
app.delete("/api/organizations/:id", authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if organization exists
    const org = await query('SELECT id FROM organizations WHERE id = $1', [id])
    if (org.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' })
    }
    
    // Note: Actual deletion will cascade to all related records
    // In production, you might want to implement soft delete instead
    await query('DELETE FROM organizations WHERE id = $1', [id])
    
    res.json({ ok: true, message: 'Organization deleted successfully' })
  } catch (error) {
    console.error('Error deleting organization:', error)
    res.status(500).json({ error: 'Failed to delete organization' })
  }
})

// =============== TASK SETUP ENDPOINTS (Tenant Admin) ===============

// List task setups
app.get("/api/task-setups", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { loan_product_id } = req.query
    
    let queryText = `
      SELECT ts.*, lp.name as product_name, lp.product_type
      FROM task_setups ts
      LEFT JOIN loan_products lp ON ts.loan_product_id = lp.id
    `
    const params: any[] = []
    
    if (loan_product_id) {
      queryText += ' WHERE ts.loan_product_id = $1'
      params.push(loan_product_id)
    }
    
    queryText += ' ORDER BY ts.sequence_order, ts.created_at'
    
    const result = await query(queryText, params)
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching task setups:', error)
    res.status(500).json({ error: 'Failed to fetch task setups' })
  }
})

// Create task setup
app.post("/api/task-setups", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const {
      loan_product_id,
      name,
      description,
      task_type,
      assigned_role,
      sequence_order,
      is_required,
      is_active,
      estimated_duration_minutes,
      instructions,
      checklist_items
    } = req.body
    
    if (!loan_product_id || !name || !task_type || !assigned_role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    
    const result = await query(
      `INSERT INTO task_setups 
       (loan_product_id, name, description, task_type, assigned_role, sequence_order, 
        is_required, is_active, estimated_duration_minutes, instructions, checklist_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [loan_product_id, name, description, task_type, assigned_role, sequence_order || 1,
       is_required !== false, is_active !== false, estimated_duration_minutes || 30, 
       instructions, JSON.stringify(checklist_items || [])]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating task setup:', error)
    res.status(500).json({ error: 'Failed to create task setup' })
  }
})

// Update task setup
app.put("/api/task-setups/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      description,
      task_type,
      assigned_role,
      sequence_order,
      is_required,
      is_active,
      estimated_duration_minutes,
      instructions,
      checklist_items
    } = req.body
    
    const result = await query(
      `UPDATE task_setups SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       task_type = COALESCE($3, task_type),
       assigned_role = COALESCE($4, assigned_role),
       sequence_order = COALESCE($5, sequence_order),
       is_required = COALESCE($6, is_required),
       is_active = COALESCE($7, is_active),
       estimated_duration_minutes = COALESCE($8, estimated_duration_minutes),
       instructions = COALESCE($9, instructions),
       checklist_items = COALESCE($10, checklist_items),
       updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [name, description, task_type, assigned_role, sequence_order,
       is_required, is_active, estimated_duration_minutes, instructions,
       checklist_items ? JSON.stringify(checklist_items) : null, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task setup not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating task setup:', error)
    res.status(500).json({ error: 'Failed to update task setup' })
  }
})

// Delete task setup
app.delete("/api/task-setups/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM task_setups WHERE id = $1 RETURNING *',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task setup not found' })
    }
    
    res.json({ ok: true, deleted: result.rows[0] })
  } catch (error) {
    console.error('Error deleting task setup:', error)
    res.status(500).json({ error: 'Failed to delete task setup' })
  }
})

// =============== APPLICATION TASKS ENDPOINTS (Underwriter) ===============

// Get all tasks for underwriter (assigned to their role)
app.get("/api/underwriter/tasks", authenticate, authorize('underwriter', 'admin'), async (req, res) => {
  try {
    const { status, application_id } = req.query
    
    let queryText = `
      SELECT 
        t.*,
        a.application_number,
        a.status as application_status,
        a.requested_amount,
        a.applicant_data,
        lp.name as product_name,
        lp.product_type
      FROM application_tasks t
      JOIN applications a ON t.application_id = a.id
      JOIN loan_products lp ON a.loan_product_id = lp.id
      WHERE a.organization_id = $1 AND t.assigned_role = 'underwriter'
    `
    const params = [req.organization_id]
    let paramCount = 1

    if (status) {
      paramCount++
      queryText += ` AND t.status = $${paramCount}`
      params.push(status as string)
    }

    if (application_id) {
      paramCount++
      queryText += ` AND t.application_id = $${paramCount}`
      params.push(application_id as string)
    }

    queryText += ' ORDER BY t.sequence_order ASC, t.created_at DESC'

    const result = await query(queryText, params)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching underwriter tasks:', error)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// Get tasks for a specific application
app.get("/api/applications/:id/tasks", authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    // Verify access to application
    const appResult = await query(
      'SELECT id FROM applications WHERE id = $1 AND organization_id = $2',
      [id, req.organization_id]
    )
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' })
    }

    const result = await query(
      `SELECT t.*, u.first_name, u.last_name 
       FROM application_tasks t
       LEFT JOIN users u ON t.assigned_user_id = u.id
       WHERE t.application_id = $1
       ORDER BY t.sequence_order ASC`,
      [id]
    )
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching application tasks:', error)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// Update task status
app.patch("/api/tasks/:id/status", authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { status, completion_notes } = req.body

    if (!['pending', 'in_progress', 'completed', 'skipped', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Verify task belongs to user's organization
    const taskCheck = await query(
      `SELECT t.id FROM application_tasks t
       JOIN applications a ON t.application_id = a.id
       WHERE t.id = $1 AND a.organization_id = $2`,
      [id, req.organization_id]
    )

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const updateFields = ['status = $1', 'updated_at = NOW()']
    const params = [status, id]
    let paramCount = 2

    if (status === 'in_progress') {
      updateFields.push('started_at = COALESCE(started_at, NOW())')
    }

    if (status === 'completed') {
      paramCount++
      updateFields.push(`completed_at = NOW()`)
      updateFields.push(`completed_by_user_id = $${paramCount}`)
      params.splice(paramCount - 1, 0, req.user?.id)

      if (completion_notes) {
        paramCount++
        updateFields.push(`completion_notes = $${paramCount}`)
        params.splice(paramCount - 1, 0, completion_notes)
      }
    }

    const result = await query(
      `UPDATE application_tasks 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount + 1}
       RETURNING *`,
      params
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating task status:', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// Assign task to specific user
app.patch("/api/tasks/:id/assign", authenticate, authorize('underwriter', 'tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { assigned_user_id } = req.body

    const result = await query(
      `UPDATE application_tasks t
       SET assigned_user_id = $1, updated_at = NOW()
       FROM applications a
       WHERE t.id = $2 AND t.application_id = a.id AND a.organization_id = $3
       RETURNING t.*`,
      [assigned_user_id, id, req.organization_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error assigning task:', error)
    res.status(500).json({ error: 'Failed to assign task' })
  }
})

// =============== QUEUE MANAGEMENT ENDPOINTS (Tenant Admin) ===============

// List queues for organization
app.get("/api/queues", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT q.*, 
       (SELECT COUNT(*) FROM queue_assignments qa WHERE qa.queue_id = q.id) as assigned_count
       FROM underwriting_queues q
       WHERE q.organization_id = $1
       ORDER BY q.priority DESC, q.name`,
      [req.organization_id]
    )
    
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching queues:', error)
    res.status(500).json({ error: 'Failed to fetch queues' })
  }
})

// Create queue
app.post("/api/queues", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { name, description, criteria, priority, is_active } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Queue name is required' })
    }
    
    const result = await query(
      `INSERT INTO underwriting_queues 
       (organization_id, name, description, criteria, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.organization_id, name, description, 
       criteria ? JSON.stringify(criteria) : '{}',
       priority || 1, is_active !== false]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating queue:', error)
    res.status(500).json({ error: 'Failed to create queue' })
  }
})

// Update queue
app.put("/api/queues/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, criteria, priority, is_active } = req.body
    
    const result = await query(
      `UPDATE underwriting_queues SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       criteria = COALESCE($3, criteria),
       priority = COALESCE($4, priority),
       is_active = COALESCE($5, is_active)
       WHERE id = $6 AND organization_id = $7
       RETURNING *`,
      [name, description, 
       criteria ? JSON.stringify(criteria) : null,
       priority, is_active, id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Queue not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating queue:', error)
    res.status(500).json({ error: 'Failed to update queue' })
  }
})

// Delete queue
app.delete("/api/queues/:id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM underwriting_queues WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, req.organization_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Queue not found' })
    }
    
    res.json({ ok: true, deleted: result.rows[0] })
  } catch (error) {
    console.error('Error deleting queue:', error)
    res.status(500).json({ error: 'Failed to delete queue' })
  }
})

// Assign users to queue
app.post("/api/queues/:id/assignments", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { user_id, is_primary } = req.body
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' })
    }
    
    // Verify queue belongs to organization
    const queue = await query(
      'SELECT id FROM underwriting_queues WHERE id = $1 AND organization_id = $2',
      [id, req.organization_id]
    )
    
    if (queue.rows.length === 0) {
      return res.status(404).json({ error: 'Queue not found' })
    }
    
    const result = await query(
      `INSERT INTO queue_assignments (queue_id, user_id, is_primary)
       VALUES ($1, $2, $3)
       ON CONFLICT (queue_id, user_id) DO UPDATE SET is_primary = $3
       RETURNING *`,
      [id, user_id, is_primary || false]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error assigning user to queue:', error)
    res.status(500).json({ error: 'Failed to assign user to queue' })
  }
})

// Remove user from queue
app.delete("/api/queues/:id/assignments/:user_id", authenticate, authorize('tenant_admin', 'admin'), async (req, res) => {
  try {
    const { id, user_id } = req.params
    
    // Verify queue belongs to organization
    const queue = await query(
      'SELECT id FROM underwriting_queues WHERE id = $1 AND organization_id = $2',
      [id, req.organization_id]
    )
    
    if (queue.rows.length === 0) {
      return res.status(404).json({ error: 'Queue not found' })
    }
    
    const result = await query(
      'DELETE FROM queue_assignments WHERE queue_id = $1 AND user_id = $2 RETURNING *',
      [id, user_id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    
    res.json({ ok: true, deleted: result.rows[0] })
  } catch (error) {
    console.error('Error removing queue assignment:', error)
    res.status(500).json({ error: 'Failed to remove queue assignment' })
  }
})

// Session cleanup background tasks
setInterval(async () => {
  try {
    const expiredCount = await cleanupExpiredSessions();
    const timeoutMinutes = config.isDevelopment() ? 30 : 15; // Shorter timeout in production
    const timedOutCount = await timeoutInactiveSessions(timeoutMinutes);
    
    if (expiredCount > 0 || timedOutCount > 0) {
      console.log(`Session cleanup: ${expiredCount} expired, ${timedOutCount} timed out`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Add health check endpoint for configuration
app.get('/api/health/config', async (req: Request, res: Response) => {
  try {
    const healthCheck = await config.healthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Initialize application
async function initializeApp() {
  try {
    console.log(`🚀 Starting ${config.get('APP_NAME')} v${config.get('APP_VERSION')}`);
    console.log(`📍 Environment: ${config.getEnvironment()}`);
    
    // Initialize demo users
    await ensureDemoUsers();
    
    // Start server
    const PORT = config.get('PORT');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ BFF listening on 0.0.0.0:${PORT}`);
      console.log(`🔒 Database-based session management enabled`);
      console.log(`🛡️ Security middleware configured for ${config.getEnvironment()}`);
      console.log(`📊 Health checks available at /api/health/config`);
      
      if (config.isDevelopment()) {
        console.log(`🔧 Development mode: Auto-generated secrets in use`);
        console.log(`📝 Configuration loaded with ${Object.keys(config.getConfig()).length} settings`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp();
