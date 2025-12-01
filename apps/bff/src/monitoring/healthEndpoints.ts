import { Request, Response, Application } from 'express';
import HealthMonitor from './healthMonitor.js';
import config from '../config/environment.js';

// Initialize health monitor singleton
const healthMonitor = HealthMonitor.getInstance();

// Request timing middleware
export function requestTimingMiddleware(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  
  healthMonitor.incrementActiveRequests();
  
  // Track response time when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    healthMonitor.trackRequest(responseTime);
    healthMonitor.decrementActiveRequests();
    
    // Track errors
    if (res.statusCode >= 400) {
      healthMonitor.trackError();
    }
  });
  
  next();
}

/**
 * Setup health check and monitoring endpoints
 */
export function setupHealthEndpoints(app: Application): void {
  
  /**
   * @swagger
   * /api/health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Comprehensive system health check
   *     description: |
   *       Returns detailed health status of all system components including database, 
   *       memory usage, configuration, and external dependencies.
   *       
   *       **Status Levels:**
   *       - `healthy`: All systems operating normally
   *       - `degraded`: Some non-critical issues detected
   *       - `unhealthy`: Critical issues requiring attention
   *       
   *       **Use Cases:**
   *       - Load balancer health checks
   *       - Monitoring system integration
   *       - Operational dashboards
   *       - Troubleshooting system issues
   *     responses:
   *       200:
   *         description: Health check completed (status may still indicate issues)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   *             examples:
   *               healthy:
   *                 summary: All Systems Healthy
   *                 value:
   *                   status: "healthy"
   *                   timestamp: "2024-01-15T18:30:00.000Z"
   *                   version: "1.0.0"
   *                   environment: "production"
   *                   uptime: 3600
   *                   components:
   *                     database:
   *                       status: "healthy"
   *                       responseTime: 45
   *                       lastChecked: "2024-01-15T18:30:00.000Z"
   *                     memory:
   *                       status: "healthy"
   *                       responseTime: 2
   *                       details:
   *                         percentage: 65.2
   *                       lastChecked: "2024-01-15T18:30:00.000Z"
   *                   summary:
   *                     healthy: 4
   *                     degraded: 0
   *                     unhealthy: 0
   *                     total: 4
   *               degraded:
   *                 summary: System Degraded
   *                 value:
   *                   status: "degraded"
   *                   timestamp: "2024-01-15T18:30:00.000Z"
   *                   components:
   *                     database:
   *                       status: "degraded"
   *                       responseTime: 1250
   *                       details:
   *                         activeConnections: 25
   *                       lastChecked: "2024-01-15T18:30:00.000Z"
   *     security: []
   */
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      const healthCheck = await healthMonitor.performHealthCheck();
      
      // Set appropriate HTTP status based on health
      let statusCode = 200;
      if (healthCheck.status === 'degraded') {
        statusCode = 200; // Still operational
      } else if (healthCheck.status === 'unhealthy') {
        statusCode = 503; // Service unavailable
      }
      
      res.status(statusCode).json(healthCheck);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
        version: config.get('APP_VERSION'),
      });
    }
  });

  /**
   * @swagger
   * /api/health/live:
   *   get:
   *     tags:
   *       - Health
   *     summary: Liveness probe for container orchestration
   *     description: |
   *       Simple liveness check to determine if the application process is running.
   *       Used by Kubernetes and other orchestration platforms to determine if 
   *       the container should be restarted.
   *       
   *       **Response Format:**
   *       - Returns 200 if process is alive
   *       - Includes uptime for basic health indication
   *       
   *       **Kubernetes Integration:**
   *       ```yaml
   *       livenessProbe:
   *         httpGet:
   *           path: /api/health/live
   *           port: 3000
   *         initialDelaySeconds: 30
   *         periodSeconds: 10
   *       ```
   *     responses:
   *       200:
   *         description: Application is alive
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - alive
   *                 - uptime
   *               properties:
   *                 alive:
   *                   type: boolean
   *                   description: Whether the application process is running
   *                   example: true
   *                 uptime:
   *                   type: number
   *                   description: Application uptime in seconds
   *                   example: 3600
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Check execution time
   *     security: []
   */
  app.get('/api/health/live', (req: Request, res: Response) => {
    const liveness = healthMonitor.livenessProbe();
    res.json({
      ...liveness,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/health/ready:
   *   get:
   *     tags:
   *       - Health
   *     summary: Readiness probe for container orchestration
   *     description: |
   *       Readiness check to determine if the application is ready to receive traffic.
   *       Verifies that essential dependencies (database, configuration) are available.
   *       
   *       **Response Format:**
   *       - Returns 200 if ready to serve traffic
   *       - Returns 503 if not ready (dependencies unavailable)
   *       
   *       **Kubernetes Integration:**
   *       ```yaml
   *       readinessProbe:
   *         httpGet:
   *           path: /api/health/ready
   *           port: 3000
   *         initialDelaySeconds: 10
   *         periodSeconds: 5
   *       ```
   *     responses:
   *       200:
   *         description: Application is ready to serve traffic
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - ready
   *               properties:
   *                 ready:
   *                   type: boolean
   *                   description: Whether the application is ready
   *                   example: true
   *                 details:
   *                   type: object
   *                   description: Readiness check details
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Check execution time
   *       503:
   *         description: Application is not ready
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ready:
   *                   type: boolean
   *                   example: false
   *                 details:
   *                   type: object
   *                   description: Details about readiness issues
   *     security: []
   */
  app.get('/api/health/ready', async (req: Request, res: Response) => {
    try {
      const readiness = await healthMonitor.readinessProbe();
      
      const statusCode = readiness.ready ? 200 : 503;
      res.status(statusCode).json({
        ...readiness,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        details: {
          error: error instanceof Error ? error.message : 'Readiness check failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @swagger
   * /api/health/metrics:
   *   get:
   *     tags:
   *       - Health
   *     summary: Application performance metrics
   *     description: |
   *       Returns real-time performance metrics including memory usage, CPU usage,
   *       request statistics, and event loop performance.
   *       
   *       **Metrics Included:**
   *       - Memory usage (heap, total, percentage)
   *       - CPU usage estimation
   *       - Event loop delay
   *       - Request counts and response times
   *       - Error rates
   *       
   *       **Use Cases:**
   *       - Performance monitoring
   *       - Capacity planning
   *       - Alerting and notifications
   *       - Application optimization
   *     responses:
   *       200:
   *         description: Performance metrics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - timestamp
   *                 - memory
   *                 - cpu
   *                 - eventLoop
   *                 - requests
   *               properties:
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Metrics collection timestamp
   *                 memory:
   *                   type: object
   *                   properties:
   *                     used:
   *                       type: number
   *                       description: Used memory in MB
   *                     total:
   *                       type: number
   *                       description: Total allocated memory in MB
   *                     percentage:
   *                       type: number
   *                       description: Memory usage percentage
   *                     heap:
   *                       type: object
   *                       properties:
   *                         used:
   *                           type: number
   *                         total:
   *                           type: number
   *                 cpu:
   *                   type: object
   *                   properties:
   *                     usage:
   *                       type: number
   *                       description: CPU usage percentage
   *                 eventLoop:
   *                   type: object
   *                   properties:
   *                     delay:
   *                       type: number
   *                       description: Event loop delay in milliseconds
   *                 requests:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                       description: Total requests processed
   *                     active:
   *                       type: number
   *                       description: Currently active requests
   *                     errorsLast5Min:
   *                       type: number
   *                       description: Error count in last 5 minutes
   *                     avgResponseTime:
   *                       type: number
   *                       description: Average response time in milliseconds
   *             examples:
   *               normal:
   *                 summary: Normal Performance
   *                 value:
   *                   timestamp: "2024-01-15T18:30:00.000Z"
   *                   memory:
   *                     used: 128
   *                     total: 512
   *                     percentage: 25
   *                     heap:
   *                       used: 98
   *                       total: 256
   *                   cpu:
   *                     usage: 15.5
   *                   eventLoop:
   *                     delay: 2.1
   *                   requests:
   *                     total: 1543
   *                     active: 3
   *                     errorsLast5Min: 2
   *                     avgResponseTime: 145
   *     security: []
   */
  app.get('/api/health/metrics', (req: Request, res: Response) => {
    try {
      const metrics = healthMonitor.getPerformanceMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @swagger
   * /api/health/startup:
   *   get:
   *     tags:
   *       - Health
   *     summary: Startup probe for container orchestration
   *     description: |
   *       Startup check to determine if the application has completed initialization.
   *       This is useful for applications that have longer startup times.
   *       
   *       **Kubernetes Integration:**
   *       ```yaml
   *       startupProbe:
   *         httpGet:
   *           path: /api/health/startup
   *           port: 3000
   *         failureThreshold: 30
   *         periodSeconds: 10
   *       ```
   *     responses:
   *       200:
   *         description: Application has started successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 started:
   *                   type: boolean
   *                   example: true
   *                 uptime:
   *                   type: number
   *                   description: Seconds since startup
   *                 initialized:
   *                   type: boolean
   *                   description: Whether initialization is complete
   *     security: []
   */
  app.get('/api/health/startup', (req: Request, res: Response) => {
    const liveness = healthMonitor.livenessProbe();
    
    // Consider app started if it's been running for more than 10 seconds
    const isStarted = liveness.uptime > 10;
    
    res.json({
      started: isStarted,
      uptime: liveness.uptime,
      initialized: true, // Could check actual initialization status
      timestamp: new Date().toISOString(),
    });
  });

  // Enhanced health check endpoint with configuration details (admin only)
  /**
   * @swagger
   * /api/health/detailed:
   *   get:
   *     tags:
   *       - Health
   *     summary: Detailed system health with administrative information
   *     description: |
   *       Extended health check that includes configuration details, environment
   *       information, and diagnostic data. Intended for administrative use.
   *       
   *       **Security Note:** This endpoint may expose sensitive configuration
   *       information and should be restricted in production environments.
   *     responses:
   *       200:
   *         description: Detailed health information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 health:
   *                   $ref: '#/components/schemas/HealthResponse'
   *                 configuration:
   *                   type: object
   *                   description: Configuration health check results
   *                 environment:
   *                   type: object
   *                   description: Environment variables and settings
   *                 metrics:
   *                   type: object
   *                   description: Performance metrics
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/health/detailed', async (req: Request, res: Response) => {
    try {
      // In production, you might want to add authentication check here
      if (config.isProduction()) {
        return res.status(403).json({
          error: 'Detailed health endpoint disabled in production',
          message: 'Use /api/health for basic health checks',
        });
      }

      const [health, metrics] = await Promise.all([
        healthMonitor.performHealthCheck(),
        Promise.resolve(healthMonitor.getPerformanceMetrics()),
      ]);

      const configHealth = await config.healthCheck();

      res.json({
        health,
        configuration: configHealth,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          environment: config.getEnvironment(),
          pid: process.pid,
        },
        metrics,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve detailed health information',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  console.log('✅ Health check endpoints configured:');
  console.log('   📊 /api/health - Comprehensive health check');
  console.log('   🔴 /api/health/live - Liveness probe');
  console.log('   🟢 /api/health/ready - Readiness probe');
  console.log('   📈 /api/health/metrics - Performance metrics');
  console.log('   🚀 /api/health/startup - Startup probe');
  if (!config.isProduction()) {
    console.log('   🔧 /api/health/detailed - Detailed diagnostics (dev only)');
  }
}

export default healthMonitor;