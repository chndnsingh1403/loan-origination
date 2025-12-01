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
import { authenticate, authorize, login, logout, signUp, verifyEmail, ensureDemoUsers } from './auth.js'
import { query } from './db.js'
import { cleanupExpiredSessions, timeoutInactiveSessions, extendSession } from './session.js'
import type { User, Lead, Application, ApplicationTemplate, PaginatedResponse, LoginRequest, LoginResponse, SignUpRequest, SignUpResponse, EmailVerificationRequest } from './types.js'

// Validate environment before starting
EnvironmentUtils.validateEnvironment()

const app = express()

// Configure CORS with security-first approach
const corsOptions = {
  origin: config.get('CORS_ORIGIN'),
  credentials: config.get('CORS_CREDENTIALS'),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

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
    res.json({ ok: true })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
})

// Session management endpoints
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

// =============== APPLICATION TEMPLATES ===============

app.get("/api/templates", authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM application_templates WHERE organization_id = $1 ORDER BY name',
      [req.organization_id]
    )
    res.json({ items: result.rows })
  } catch (error) {
    console.error('Error fetching templates:', error)
    res.status(500).json({ error: 'Failed to fetch templates' })
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
      approved_amount: app.approved_amount,
      broker: app.broker_first_name ? `${app.broker_first_name} ${app.broker_last_name}` : 'Unassigned',
      created: app.created_at?.toISOString().split('T')[0] || 'Unknown'
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
      lead_id, 
      loan_product_id, 
      requested_amount, 
      applicant_data,
      co_applicant_data,
      loan_purpose,
      property_details 
    } = req.body

    const result = await query(
      `INSERT INTO applications (
        organization_id, lead_id, loan_product_id, requested_amount, 
        applicant_data, co_applicant_data, loan_purpose, property_details,
        status, stage, assigned_broker_id, created_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'application', $9, NOW())
       RETURNING *`,
      [
        req.organization_id, lead_id, loan_product_id, requested_amount,
        applicant_data, co_applicant_data, loan_purpose, property_details,
        req.user?.id
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating application:', error)
    res.status(500).json({ error: 'Failed to create application' })
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
    }

    // Focus on applications in underwriting stages
    if (!status) {
      whereClause += ` AND a.status IN ('submitted', 'under_review', 'underwriting')`
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
    // Add some demo loan products
    await query(`
      INSERT INTO loan_products (organization_id, name, type, description, min_amount, max_amount, min_term_months, max_term_months, eligibility_criteria, required_documents)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `, [
      req.organization_id,
      'Personal Loan',
      'personal',
      'Unsecured personal loan for various purposes',
      1000,
      50000,
      12,
      60,
      { min_credit_score: 650, min_income: 30000 },
      ['income_verification', 'id_document', 'bank_statement']
    ])

    res.json({ ok: true, message: "Demo data seeded" })
  } catch (error) {
    console.error('Seed error:', error)
    res.status(500).json({ error: "Seed failed" })
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
    const result = await query(
      'SELECT * FROM loan_products WHERE organization_id = $1 ORDER BY name',
      [req.organization_id]
    )
    res.json(result.rows)
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
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching loan product:', error)
    res.status(500).json({ error: 'Failed to fetch loan product' })
  }
})

app.post("/api/loan-products", authenticate, authorize('admin'), async (req, res) => {
  try {
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

    const result = await query(
      `INSERT INTO loan_products (
        organization_id, name, description, product_type, min_amount, max_amount,
        min_term_months, max_term_months, base_rate, max_rate, processing_fee,
        is_active, credit_score_requirement, income_requirement, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        req.organization_id, name, description, product_type, min_amount, max_amount,
        min_term_months, max_term_months, base_rate, max_rate, processing_fee || 0,
        is_active !== false, credit_score_requirement || 600, income_requirement || 0
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating loan product:', error)
    res.status(500).json({ error: 'Failed to create loan product' })
  }
})

app.put("/api/loan-products/:id", authenticate, authorize('admin'), async (req, res) => {
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
        min_term_months, max_term_months, base_rate, max_rate, processing_fee || 0,
        is_active !== false, credit_score_requirement || 600, income_requirement || 0,
        id, req.organization_id
      ]
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

app.patch("/api/loan-products/:id", authenticate, authorize('admin'), async (req, res) => {
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

app.delete("/api/loan-products/:id", authenticate, authorize('admin'), async (req, res) => {
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
    app.listen(PORT, () => {
      console.log(`✅ BFF listening on port ${PORT}`);
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