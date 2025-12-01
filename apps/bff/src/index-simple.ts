import express, { Request, Response } from 'express'
import cors from 'cors'

// Import our auth, db, and types
import { authenticate, authorize, login, logout, signUp, verifyEmail, ensureDemoUsers } from './auth.js'
import { query } from './db.js'

const app = express()
const PORT = process.env.PORT || 8080

// Basic middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Authentication routes
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const result = await login(email, password)
    res.json(result)
  } catch (error: any) {
    res.status(401).json({ message: error.message })
  }
})

app.post('/api/auth/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).sessionId
    await logout(sessionId)
    res.json({ message: 'Logged out successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// Sign-up endpoint
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const result = await signUp(req.body)
    res.status(201).json(result)
  } catch (error: any) {
    console.error('Signup error:', error)
    res.status(400).json({ message: error.message })
  }
})

// Email verification endpoint
app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' })
    }

    const result = await verifyEmail(token)
    res.json(result)
  } catch (error: any) {
    console.error('Email verification error:', error)
    res.status(400).json({ message: error.message })
  }
})

// User info endpoint
app.get('/api/auth/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const sessionId = (req as any).sessionId
    
    // Get session info from database
    const sessionResult = await query(
      'SELECT id, expires_at, last_activity FROM user_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, user.id]
    )
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid session' })
    }
    
    const session = sessionResult.rows[0]
    
    res.json({
      user,
      session: {
        id: session.id,
        expiresAt: session.expires_at,
        lastActivity: session.last_activity
      }
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// FAQ endpoint
app.get('/api/faq', (req: Request, res: Response) => {
  res.json([
    {
      "id": "1",
      "question": "How do I apply for a loan?",
      "answer": "You can apply for a loan by filling out our online application form. The process typically takes 15-20 minutes to complete."
    },
    {
      "id": "2", 
      "question": "What documents do I need?",
      "answer": "You'll need proof of income, identification, and bank statements from the last 3 months."
    }
  ])
})

// Application Templates endpoints
app.get('/api/application-templates', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM application_templates ORDER BY created_at DESC'
    )
    res.json(result.rows)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
})

// Initialize demo users and start server
async function startServer() {
  try {
    console.log('🚀 Starting BFF server...')
    
    // Ensure demo users exist
    await ensureDemoUsers()
    console.log('✅ Demo users initialized')
    
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`)
      console.log(`📝 Signup endpoint: http://localhost:${PORT}/api/auth/signup`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()