import swaggerJSDoc from 'swagger-jsdoc';
import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import config from '../config/environment.js';

// Swagger/OpenAPI definition with comprehensive security specifications
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Originate BFF API',
    version: config.get('APP_VERSION'),
    description: `
      # Originate Backend For Frontend (BFF) API

      This API provides secure, production-ready endpoints for the Originate loan origination system.
      
      ## Security Features
      - JWT-based authentication with secure token management
      - Database-backed session management with automatic cleanup
      - Comprehensive input validation and sanitization  
      - Rate limiting to prevent abuse
      - CORS protection with configurable origins
      - Audit logging for all user actions
      - PII encryption for sensitive data
      
      ## Authentication
      All protected endpoints require authentication via session token or JWT.
      Include the session token in the Authorization header: \`Bearer <token>\`
      
      ## Rate Limits
      - Default: ${config.get('RATE_LIMIT_MAX_REQUESTS')} requests per ${config.get('RATE_LIMIT_WINDOW_MS') / 60000} minutes
      - Authentication endpoints may have stricter limits
      
      ## Error Handling
      All endpoints follow standard HTTP status codes with detailed error responses including correlation IDs for tracking.
    `,
    contact: {
      name: 'Originate Development Team',
      email: 'support@originate.com',
    },
    license: {
      name: 'Proprietary',
      url: 'https://originate.com/license',
    },
  },
  servers: [
    {
      url: config.isDevelopment() ? 'http://localhost:3000' : 'https://api.originate.com',
      description: config.isDevelopment() ? 'Development server' : 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for API authentication',
      },
      sessionAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Session token with Bearer prefix',
      },
    },
    schemas: {
      // Error response schemas
      ErrorResponse: {
        type: 'object',
        required: ['error', 'message', 'correlationId'],
        properties: {
          error: {
            type: 'string',
            description: 'Error type identifier',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'Invalid email format',
          },
          correlationId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for tracking this error',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          details: {
            type: 'object',
            description: 'Additional error context (only in non-production)',
          },
        },
      },
      
      // Authentication schemas
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'user@example.com',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'User password (minimum 8 characters)',
            example: 'SecurePassword123!',
          },
        },
      },
      
      LoginResponse: {
        type: 'object',
        required: ['token', 'user', 'sessionId'],
        properties: {
          token: {
            type: 'string',
            description: 'JWT authentication token',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          sessionId: {
            type: 'string',
            format: 'uuid',
            description: 'Database session identifier',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Session expiration timestamp',
          },
        },
      },

      // Sign-up request and response schemas
      SignUpRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'termsAccepted'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address (must be unique)',
            example: 'newuser@example.com',
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Password meeting security requirements (8+ chars, mixed case, numbers, special chars)',
            example: 'SecurePassword123!',
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            description: 'User first name',
            example: 'John',
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            description: 'User last name',
            example: 'Doe',
          },
          organizationId: {
            type: 'string',
            description: 'Optional organization ID for multi-tenant signup',
            example: 'org_123456',
          },
          invitationToken: {
            type: 'string',
            description: 'Invitation token for invited user registration',
            example: 'inv_abc123def456',
          },
          role: {
            type: 'string',
            enum: ['broker', 'underwriter', 'admin', 'tenant_admin'],
            description: 'User role (defaults to broker)',
            example: 'broker',
          },
          termsAccepted: {
            type: 'boolean',
            description: 'Terms of service acceptance (required)',
            example: true,
          },
          marketingOptIn: {
            type: 'boolean',
            description: 'Marketing communication consent',
            example: false,
          },
          referralSource: {
            type: 'string',
            description: 'How the user heard about the service',
            example: 'google_search',
          },
        },
      },

      SignUpResponse: {
        type: 'object',
        required: ['user', 'token', 'organization', 'sessionId', 'requiresVerification'],
        properties: {
          user: {
            $ref: '#/components/schemas/User',
          },
          token: {
            type: 'string',
            description: 'JWT authentication token',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          organization: {
            $ref: '#/components/schemas/Organization',
          },
          sessionId: {
            type: 'string',
            format: 'uuid',
            description: 'Database session identifier',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          requiresVerification: {
            type: 'boolean',
            description: 'Whether email verification is required',
            example: true,
          },
          verificationSent: {
            type: 'boolean',
            description: 'Whether verification email was sent',
            example: true,
          },
          nextSteps: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of next steps for the user',
            example: ['verify_email'],
          },
        },
      },

      // Email verification schemas
      EmailVerificationRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string',
            description: 'Email verification token received via email',
            example: 'verify_abc123def456789',
          },
        },
      },

      EmailVerificationResponse: {
        type: 'object',
        required: ['verified', 'message'],
        properties: {
          verified: {
            type: 'boolean',
            description: 'Whether email was successfully verified',
            example: true,
          },
          message: {
            type: 'string',
            description: 'Human-readable verification result message',
            example: 'Email successfully verified',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
        },
      },

      // Organization schema for responses
      Organization: {
        type: 'object',
        required: ['id', 'name', 'subdomain'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique organization identifier',
            example: 'org_123456',
          },
          name: {
            type: 'string',
            description: 'Organization display name',
            example: 'Demo Financial',
          },
          subdomain: {
            type: 'string',
            description: 'Organization subdomain',
            example: 'demo',
          },
          branding: {
            type: 'object',
            description: 'Organization branding configuration',
            properties: {
              logo: {
                type: 'string',
                example: '/assets/logo.png',
              },
              primaryColor: {
                type: 'string',
                example: '#1f2937',
              },
              secondaryColor: {
                type: 'string',
                example: '#3b82f6',
              },
            },
          },
          feature_flags: {
            type: 'object',
            description: 'Organization feature toggles',
            properties: {
              underwriting_automation: {
                type: 'boolean',
                example: true,
              },
              document_ai: {
                type: 'boolean',
                example: true,
              },
              instant_decisions: {
                type: 'boolean',
                example: false,
              },
            },
          },
        },
      },
      
      // User schemas
      User: {
        type: 'object',
        required: ['id', 'email', 'role', 'name'],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique user identifier',
            example: 1,
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'user@example.com',
          },
          name: {
            type: 'string',
            description: 'User full name',
            example: 'John Doe',
          },
          role: {
            type: 'string',
            enum: ['admin', 'underwriter', 'broker', 'tenant-admin'],
            description: 'User role determining access permissions',
            example: 'broker',
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last successful login timestamp',
          },
        },
      },
      
      // Lead schemas
      Lead: {
        type: 'object',
        required: ['id', 'firstName', 'lastName', 'email', 'phone', 'status'],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique lead identifier',
            example: 1,
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            description: 'Lead first name (PII - encrypted at rest)',
            example: 'Jane',
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            description: 'Lead last name (PII - encrypted at rest)',
            example: 'Smith',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Lead email address (PII - encrypted at rest)',
            example: 'jane.smith@example.com',
          },
          phone: {
            type: 'string',
            pattern: '^\\+?[1-9]\\d{1,14}$',
            description: 'Lead phone number (PII - encrypted at rest)',
            example: '+1234567890',
          },
          status: {
            type: 'string',
            enum: ['new', 'contacted', 'qualified', 'converted', 'closed'],
            description: 'Lead status in the pipeline',
            example: 'new',
          },
          source: {
            type: 'string',
            description: 'Lead generation source',
            example: 'website',
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the lead',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Lead creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      
      // Application schemas
      Application: {
        type: 'object',
        required: ['id', 'leadId', 'status', 'loanAmount'],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique application identifier',
            example: 1,
          },
          leadId: {
            type: 'integer',
            description: 'Associated lead identifier',
            example: 1,
          },
          templateId: {
            type: 'integer',
            description: 'Application template identifier',
            example: 1,
          },
          status: {
            type: 'string',
            enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'funded'],
            description: 'Application processing status',
            example: 'submitted',
          },
          loanAmount: {
            type: 'number',
            format: 'decimal',
            minimum: 0,
            description: 'Requested loan amount',
            example: 250000.00,
          },
          loanPurpose: {
            type: 'string',
            description: 'Purpose of the loan',
            example: 'Home purchase',
          },
          submittedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Application submission timestamp',
          },
          reviewedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Review completion timestamp',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Application creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      
      // Pagination schemas
      PaginatedResponse: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            description: 'Array of result items',
            items: {
              type: 'object',
            },
          },
          pagination: {
            type: 'object',
            required: ['page', 'limit', 'total', 'totalPages'],
            properties: {
              page: {
                type: 'integer',
                minimum: 1,
                description: 'Current page number',
                example: 1,
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Items per page',
                example: 10,
              },
              total: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of items',
                example: 45,
              },
              totalPages: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of pages',
                example: 5,
              },
              hasNext: {
                type: 'boolean',
                description: 'Whether there are more pages',
                example: true,
              },
              hasPrev: {
                type: 'boolean',
                description: 'Whether there are previous pages',
                example: false,
              },
            },
          },
        },
      },
      
      // Health check schemas
      HealthResponse: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Overall system health status',
            example: 'healthy',
          },
          details: {
            type: 'object',
            description: 'Detailed health check results',
            properties: {
              database: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
                description: 'Database connectivity status',
              },
              dependencies: {
                type: 'object',
                description: 'External dependency health checks',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Health check execution time',
              },
            },
          },
        },
      },
    },
    
    // Common response headers
    headers: {
      'X-Correlation-ID': {
        description: 'Unique request identifier for tracing',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
      'X-Rate-Limit-Remaining': {
        description: 'Number of requests remaining in the current window',
        schema: {
          type: 'integer',
        },
      },
      'X-Rate-Limit-Reset': {
        description: 'Time when the rate limit window resets',
        schema: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
    
    // Common query parameters
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination (1-based)',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search query string',
        required: false,
        schema: {
          type: 'string',
          maxLength: 100,
        },
      },
    },
  },
  
  // Global security requirements
  security: [
    {
      bearerAuth: [],
    },
    {
      sessionAuth: [],
    },
  ],
  
  // Global tags for organization
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management endpoints',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Leads',
      description: 'Lead management endpoints',
    },
    {
      name: 'Applications',
      description: 'Loan application management endpoints',
    },
    {
      name: 'Templates',
      description: 'Application template management endpoints',
    },
    {
      name: 'Health',
      description: 'System health and monitoring endpoints',
    },
    {
      name: 'Documents',
      description: 'Document upload and management endpoints',
    },
  ],
};

// Swagger options
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/**/*.ts', // Include all TypeScript files for JSDoc comments
    './docs/api/*.yaml', // Include additional YAML documentation files
  ],
};

// Generate swagger specification
const swaggerSpec = swaggerJSDoc(options);

// Swagger UI configuration with security considerations
const swaggerUiOptions = {
  customSiteTitle: 'Originate BFF API Documentation',
  customfavIcon: '/favicon.ico',
  customCss: `
    .topbar-wrapper img { content: url('/api-logo.png'); }
    .swagger-ui .topbar { background-color: #1f2937; }
    .swagger-ui .info .title { color: #1f2937; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
};

// Setup function to configure Swagger in Express app
export function setupSwagger(app: Application): void {
  // Only allow documentation access in non-production environments
  if (!config.isProduction()) {
    // Serve swagger spec as JSON (useful for external tools)
    app.get('/api/docs/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
    
    // Serve Swagger UI
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    
    // Redirect /docs to /api/docs for convenience
    app.get('/docs', (req, res) => {
      res.redirect('/api/docs');
    });
    
    console.log(`📚 API Documentation available at http://localhost:${config.get('PORT')}/api/docs`);
  } else {
    // In production, completely disable documentation endpoints for security
    app.get('/api/docs*', (req, res) => {
      res.status(404).json({ error: 'Not Found', message: 'Documentation not available in production' });
    });
    
    app.get('/docs', (req, res) => {
      res.status(404).json({ error: 'Not Found', message: 'Documentation not available in production' });
    });
    
    console.log('� API Documentation: Completely disabled in production (security)');
  }
}

export default swaggerSpec;