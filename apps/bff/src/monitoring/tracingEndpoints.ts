import { Request, Response, Application } from 'express';
import RequestTracer from './requestTracer.js';
import config from '../config/environment.js';

/**
 * Setup request tracing and performance monitoring endpoints
 */
export function setupTracingEndpoints(app: Application): void {
  const tracer = RequestTracer.getInstance();

  /**
   * @swagger
   * /api/monitoring/traces:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get recent request traces
   *     description: |
   *       Returns recent request traces with performance data and error information.
   *       Useful for debugging performance issues and tracking request flow.
   *       
   *       **Development Only:** This endpoint is only available in development environment.
   *     parameters:
   *       - name: limit
   *         in: query
   *         description: Maximum number of traces to return
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *     responses:
   *       200:
   *         description: Recent traces retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 traces:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       traceId:
   *                         type: string
   *                         format: uuid
   *                       method:
   *                         type: string
   *                       url:
   *                         type: string
   *                       statusCode:
   *                         type: number
   *                       duration:
   *                         type: number
   *                       startTime:
   *                         type: number
   *                       userId:
   *                         type: string
   *                       errors:
   *                         type: array
   *                       spans:
   *                         type: array
   *                 totalTraces:
   *                   type: number
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/traces', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Tracing endpoints disabled in production',
        message: 'Use external APM tools for production monitoring',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const traces = tracer.getRecentTraces(limit);

    res.json({
      traces: traces.map(trace => ({
        traceId: trace.traceId,
        method: trace.method,
        url: trace.url,
        statusCode: trace.statusCode,
        duration: trace.duration,
        startTime: trace.startTime,
        userId: trace.userId ? '***MASKED***' : undefined,
        userRole: trace.userRole,
        clientIp: '***MASKED***',
        errors: trace.errors?.map(error => ({
          message: 'Error details masked for security',
          timestamp: error.timestamp,
        })),
        spans: trace.spans.map(span => ({
          spanId: span.spanId,
          operationName: span.operationName,
          duration: span.duration,
          status: span.status,
          tags: span.tags ? { ...span.tags, pii: '***MASKED***' } : undefined,
        })),
        tags: trace.tags,
      })),
      totalTraces: traces.length,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/traces/{traceId}:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get specific trace by ID
   *     description: |
   *       Returns detailed information about a specific trace including all spans,
   *       logs, and performance data.
   *     parameters:
   *       - name: traceId
   *         in: path
   *         required: true
   *         description: Trace ID to retrieve
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Trace found and returned
   *       404:
   *         description: Trace not found
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/traces/:traceId', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Tracing endpoints disabled in production',
      });
    }

    const traceId = req.params.traceId;
    const trace = tracer.getTrace(traceId);

    if (!trace) {
      return res.status(404).json({
        error: 'Trace not found',
        message: `No trace found with ID: ${traceId}`,
      });
    }

    // Mask sensitive data from trace before returning
    const maskedTrace = {
      ...trace,
      userId: trace.userId ? '***MASKED***' : undefined,
      clientIp: '***MASKED***',
      errors: trace.errors?.map(error => ({
        message: 'Error details masked for security',
        timestamp: error.timestamp,
      })),
      spans: trace.spans.map(span => ({
        ...span,
        tags: span.tags ? { ...span.tags, pii: '***MASKED***' } : undefined,
      })),
    };

    res.json({
      trace: maskedTrace,
      retrievedAt: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/performance:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get performance aggregates
   *     description: |
   *       Returns aggregated performance metrics for all endpoints including
   *       response times, percentiles, and throughput data.
   *     responses:
   *       200:
   *         description: Performance aggregates retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 aggregates:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       endpoint:
   *                         type: string
   *                       method:
   *                         type: string
   *                       count:
   *                         type: number
   *                       averageDuration:
   *                         type: number
   *                       p95Duration:
   *                         type: number
   *                       p99Duration:
   *                         type: number
   *                       errorCount:
   *                         type: number
   *                       errorRate:
   *                         type: number
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/performance', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Performance monitoring endpoints disabled in production',
      });
    }

    const aggregates = tracer.getPerformanceAggregates();

    res.json({
      aggregates,
      generatedAt: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/slow-operations:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get slow operations
   *     description: |
   *       Returns requests that exceeded the slow operation threshold,
   *       useful for identifying performance bottlenecks.
   *     parameters:
   *       - name: limit
   *         in: query
   *         description: Maximum number of slow operations to return
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *     responses:
   *       200:
   *         description: Slow operations retrieved successfully
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/slow-operations', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Monitoring endpoints disabled in production',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const slowOps = tracer.getSlowOperations(limit);

    res.json({
      slowOperations: slowOps.map(trace => ({
        traceId: trace.traceId,
        method: trace.method,
        url: trace.url,
        duration: trace.duration,
        statusCode: trace.statusCode,
        startTime: trace.startTime,
        userId: trace.userId,
        spans: trace.spans.length,
        errors: trace.errors.length,
      })),
      threshold: config.isDevelopment() ? 1000 : 500,
      retrievedAt: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/errors:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get error traces
   *     description: |
   *       Returns requests that resulted in errors (4xx/5xx status codes)
   *       or had application exceptions.
   *     parameters:
   *       - name: limit
   *         in: query
   *         description: Maximum number of error traces to return
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 20
   *     responses:
   *       200:
   *         description: Error traces retrieved successfully
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/errors', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Error monitoring endpoints disabled in production',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const errorTraces = tracer.getErrorTraces(limit);

    res.json({
      errorTraces: errorTraces.map(trace => ({
        traceId: trace.traceId,
        method: trace.method,
        url: trace.url,
        statusCode: trace.statusCode,
        duration: trace.duration,
        startTime: trace.startTime,
        userId: trace.userId,
        errors: trace.errors,
        spans: trace.spans.filter(span => span.status === 'error'),
      })),
      totalErrors: errorTraces.length,
      retrievedAt: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/search:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Search traces by criteria
   *     description: |
   *       Search for traces based on various criteria including user ID,
   *       HTTP method, endpoint, duration, and error status.
   *     parameters:
   *       - name: userId
   *         in: query
   *         description: Filter by user ID
   *         required: false
   *         schema:
   *           type: string
   *       - name: method
   *         in: query
   *         description: Filter by HTTP method
   *         required: false
   *         schema:
   *           type: string
   *           enum: [GET, POST, PUT, DELETE, PATCH]
   *       - name: endpoint
   *         in: query
   *         description: Filter by endpoint (partial match)
   *         required: false
   *         schema:
   *           type: string
   *       - name: minDuration
   *         in: query
   *         description: Minimum request duration in milliseconds
   *         required: false
   *         schema:
   *           type: number
   *       - name: maxDuration
   *         in: query
   *         description: Maximum request duration in milliseconds
   *         required: false
   *         schema:
   *           type: number
   *       - name: statusCode
   *         in: query
   *         description: Filter by HTTP status code
   *         required: false
   *         schema:
   *           type: number
   *       - name: hasErrors
   *         in: query
   *         description: Filter traces with errors
   *         required: false
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Search completed successfully
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/search', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Search endpoints disabled in production',
      });
    }

    const criteria = {
      userId: req.query.userId as string,
      method: req.query.method as string,
      endpoint: req.query.endpoint as string,
      minDuration: req.query.minDuration ? parseInt(req.query.minDuration as string) : undefined,
      maxDuration: req.query.maxDuration ? parseInt(req.query.maxDuration as string) : undefined,
      statusCode: req.query.statusCode ? parseInt(req.query.statusCode as string) : undefined,
      hasErrors: req.query.hasErrors === 'true',
    };

    // Remove undefined values
    const cleanCriteria = Object.fromEntries(
      Object.entries(criteria).filter(([_, value]) => value !== undefined)
    );

    const results = tracer.searchTraces(cleanCriteria);

    res.json({
      results: results.map(trace => ({
        traceId: trace.traceId,
        method: trace.method,
        url: trace.url,
        statusCode: trace.statusCode,
        duration: trace.duration,
        startTime: trace.startTime,
        userId: trace.userId,
        errors: trace.errors.length,
        spans: trace.spans.length,
      })),
      criteria: cleanCriteria,
      totalResults: results.length,
      searchedAt: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/monitoring/report:
   *   get:
   *     tags:
   *       - Monitoring
   *     summary: Get comprehensive performance report
   *     description: |
   *       Returns a comprehensive performance report including summary statistics,
   *       performance aggregates, slow operations, and error analysis.
   *     responses:
   *       200:
   *         description: Performance report generated successfully
   *       403:
   *         description: Not available in production
   *     security:
   *       - bearerAuth: []
   */
  app.get('/api/monitoring/report', (req: Request, res: Response) => {
    if (config.isProduction()) {
      return res.status(403).json({
        error: 'Reporting endpoints disabled in production',
      });
    }

    const report = tracer.generatePerformanceReport();

    res.json(report);
  });

  if (!config.isProduction()) {
    console.log('🔍 Request tracing endpoints configured (development only):');
    console.log('   📊 /api/monitoring/traces - Recent request traces');
    console.log('   📈 /api/monitoring/performance - Performance aggregates');
    console.log('   🐌 /api/monitoring/slow-operations - Slow operations');
    console.log('   ❌ /api/monitoring/errors - Error traces');
    console.log('   🔍 /api/monitoring/search - Search traces');
    console.log('   📋 /api/monitoring/report - Performance report');
  }
}

export { requestTracingMiddleware } from './requestTracer.js';