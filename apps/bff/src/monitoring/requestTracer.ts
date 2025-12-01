import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/environment.js';

// Request trace context
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  method: string;
  url: string;
  statusCode?: number;
  userAgent?: string;
  clientIp?: string;
  userId?: string;
  sessionId?: string;
  userRole?: string;
  tags: Record<string, any>;
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }>;
  spans: TraceSpan[];
}

// Individual operation span
interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: any;
  }>;
  status: 'ok' | 'error' | 'timeout';
}

// Performance metrics aggregation
interface PerformanceAggregates {
  endpoint: string;
  method: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  lastUpdated: string;
}

// Request context storage
declare global {
  namespace Express {
    interface Request {
      traceContext?: TraceContext;
      startSpan?: (operationName: string, tags?: Record<string, any>) => TraceSpan;
      finishSpan?: (span: TraceSpan, tags?: Record<string, any>) => void;
      addLog?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void;
      addTag?: (key: string, value: any) => void;
      addError?: (error: Error | string) => void;
    }
  }
}

class RequestTracer {
  private static instance: RequestTracer;
  private traces: Map<string, TraceContext> = new Map();
  private performanceData: Map<string, number[]> = new Map();
  private aggregates: Map<string, PerformanceAggregates> = new Map();
  private slowQueryThreshold: number;
  private traceRetentionMs: number;

  private constructor() {
    this.slowQueryThreshold = config.isDevelopment() ? 1000 : 500; // ms
    this.traceRetentionMs = config.isDevelopment() ? 60000 : 30000; // 1min dev, 30sec prod
    
    // Periodic cleanup of old traces
    setInterval(() => {
      this.cleanupOldTraces();
    }, this.traceRetentionMs);

    // Aggregate performance data every 5 minutes
    setInterval(() => {
      this.aggregatePerformanceMetrics();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): RequestTracer {
    if (!RequestTracer.instance) {
      RequestTracer.instance = new RequestTracer();
    }
    return RequestTracer.instance;
  }

  // Initialize trace context for incoming request
  public initializeTrace(req: Request): TraceContext {
    const traceId = uuidv4();
    const spanId = uuidv4();
    
    const context: TraceContext = {
      traceId,
      spanId,
      startTime: Date.now(),
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      clientIp: this.getClientIP(req),
      userId: (req as any).user?.id?.toString(),
      sessionId: (req as any).sessionId,
      userRole: (req as any).user?.role,
      tags: {},
      errors: [],
      spans: [],
    };

    this.traces.set(traceId, context);
    req.traceContext = context;

    // Add helper methods to request
    req.startSpan = (operationName: string, tags?: Record<string, any>) => 
      this.startSpan(context, operationName, tags);
    
    req.finishSpan = (span: TraceSpan, tags?: Record<string, any>) => 
      this.finishSpan(span, tags);
    
    req.addLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) =>
      this.addLogToContext(context, level, message, data);
    
    req.addTag = (key: string, value: any) => {
      context.tags[key] = value;
    };
    
    req.addError = (error: Error | string) => {
      this.addErrorToContext(context, error);
    };

    return context;
  }

  // Finish trace when request completes
  public finishTrace(context: TraceContext, statusCode: number): void {
    context.endTime = Date.now();
    context.duration = context.endTime - context.startTime;
    context.statusCode = statusCode;

    // Record performance data
    const endpointKey = `${context.method}:${this.normalizeEndpoint(context.url)}`;
    if (!this.performanceData.has(endpointKey)) {
      this.performanceData.set(endpointKey, []);
    }
    this.performanceData.get(endpointKey)!.push(context.duration);

    // Log slow requests
    if (context.duration > this.slowQueryThreshold) {
      console.warn(`🐌 Slow request detected:`, {
        traceId: context.traceId,
        method: context.method,
        url: context.url,
        duration: context.duration,
        statusCode: context.statusCode,
        userId: context.userId,
      });
    }

    // Log errors
    if (statusCode >= 400) {
      console.error(`❌ Error request:`, {
        traceId: context.traceId,
        method: context.method,
        url: context.url,
        statusCode: context.statusCode,
        duration: context.duration,
        errors: context.errors,
      });
    }

    // In development, log all traces for debugging
    if (config.isDevelopment()) {
      console.debug(`🔍 Request trace:`, {
        traceId: context.traceId,
        method: context.method,
        url: context.url,
        duration: context.duration,
        statusCode: context.statusCode,
        spans: context.spans.length,
        tags: context.tags,
      });
    }
  }

  // Start a new span for an operation
  private startSpan(context: TraceContext, operationName: string, tags?: Record<string, any>): TraceSpan {
    const span: TraceSpan = {
      spanId: uuidv4(),
      parentSpanId: context.spanId,
      operationName,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'ok',
    };

    context.spans.push(span);
    return span;
  }

  // Finish a span
  private finishSpan(span: TraceSpan, tags?: Record<string, any>): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    // Log slow operations
    if (span.duration > this.slowQueryThreshold / 2) {
      console.warn(`🐌 Slow operation detected:`, {
        spanId: span.spanId,
        operation: span.operationName,
        duration: span.duration,
        tags: span.tags,
      });
    }
  }

  // Add log entry to context
  private addLogToContext(context: TraceContext, level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    // Add to current span if exists
    if (context.spans.length > 0) {
      const currentSpan = context.spans[context.spans.length - 1];
      if (!currentSpan.endTime) {
        currentSpan.logs.push({
          timestamp: Date.now(),
          level,
          message,
          data,
        });
      }
    }
  }

  // Add error to context
  private addErrorToContext(context: TraceContext, error: Error | string): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
    };

    context.errors.push(errorInfo);

    // Mark current span as error if exists
    if (context.spans.length > 0) {
      const currentSpan = context.spans[context.spans.length - 1];
      if (!currentSpan.endTime) {
        currentSpan.status = 'error';
      }
    }
  }

  // Get client IP address
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Normalize endpoint for grouping (remove IDs, query params)
  private normalizeEndpoint(url: string): string {
    return url
      .split('?')[0] // Remove query parameters
      .replace(/\/\d+/g, '/:id') // Replace numeric IDs with :id
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs with :uuid
      .replace(/\/[a-f0-9]{24}/g, '/:objectId'); // Replace ObjectIds with :objectId
  }

  // Aggregate performance metrics
  private aggregatePerformanceMetrics(): void {
    for (const [endpointKey, durations] of this.performanceData.entries()) {
      if (durations.length === 0) continue;

      const sorted = durations.sort((a, b) => a - b);
      const [method, endpoint] = endpointKey.split(':');
      
      const aggregate: PerformanceAggregates = {
        endpoint,
        method,
        count: durations.length,
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: sorted[0],
        maxDuration: sorted[sorted.length - 1],
        p50Duration: sorted[Math.floor(sorted.length * 0.5)],
        p95Duration: sorted[Math.floor(sorted.length * 0.95)],
        p99Duration: sorted[Math.floor(sorted.length * 0.99)],
        errorCount: 0, // This would need to be tracked separately
        errorRate: 0,
        statusCodes: {}, // This would need to be tracked separately
        lastUpdated: new Date().toISOString(),
      };

      this.aggregates.set(endpointKey, aggregate);
    }

    // Clear performance data after aggregation
    this.performanceData.clear();
  }

  // Clean up old traces
  private cleanupOldTraces(): void {
    const cutoffTime = Date.now() - this.traceRetentionMs;
    
    for (const [traceId, context] of this.traces.entries()) {
      if (context.startTime < cutoffTime) {
        this.traces.delete(traceId);
      }
    }
  }

  // Get trace by ID
  public getTrace(traceId: string): TraceContext | undefined {
    return this.traces.get(traceId);
  }

  // Get recent traces
  public getRecentTraces(limit: number = 50): TraceContext[] {
    const allTraces = Array.from(this.traces.values());
    return allTraces
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  // Get performance aggregates
  public getPerformanceAggregates(): PerformanceAggregates[] {
    return Array.from(this.aggregates.values())
      .sort((a, b) => b.count - a.count);
  }

  // Get slow operations
  public getSlowOperations(limit: number = 10): TraceContext[] {
    const allTraces = Array.from(this.traces.values());
    return allTraces
      .filter(trace => trace.duration && trace.duration > this.slowQueryThreshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  // Get traces with errors
  public getErrorTraces(limit: number = 20): TraceContext[] {
    const allTraces = Array.from(this.traces.values());
    return allTraces
      .filter(trace => trace.errors.length > 0 || (trace.statusCode && trace.statusCode >= 400))
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  // Search traces by criteria
  public searchTraces(criteria: {
    userId?: string;
    method?: string;
    endpoint?: string;
    minDuration?: number;
    maxDuration?: number;
    statusCode?: number;
    hasErrors?: boolean;
  }): TraceContext[] {
    const allTraces = Array.from(this.traces.values());
    
    return allTraces.filter(trace => {
      if (criteria.userId && trace.userId !== criteria.userId) return false;
      if (criteria.method && trace.method !== criteria.method) return false;
      if (criteria.endpoint && !trace.url.includes(criteria.endpoint)) return false;
      if (criteria.minDuration && (!trace.duration || trace.duration < criteria.minDuration)) return false;
      if (criteria.maxDuration && (!trace.duration || trace.duration > criteria.maxDuration)) return false;
      if (criteria.statusCode && trace.statusCode !== criteria.statusCode) return false;
      if (criteria.hasErrors && trace.errors.length === 0) return false;
      
      return true;
    });
  }

  // Generate performance report
  public generatePerformanceReport(): {
    summary: any;
    aggregates: PerformanceAggregates[];
    slowOperations: TraceContext[];
    errorSummary: any;
  } {
    const aggregates = this.getPerformanceAggregates();
    const slowOps = this.getSlowOperations();
    const errorTraces = this.getErrorTraces();
    
    const summary = {
      totalEndpoints: aggregates.length,
      totalRequests: aggregates.reduce((sum, agg) => sum + agg.count, 0),
      averageResponseTime: aggregates.reduce((sum, agg) => sum + agg.averageDuration, 0) / aggregates.length,
      slowOperationsCount: slowOps.length,
      errorCount: errorTraces.length,
      reportGeneratedAt: new Date().toISOString(),
    };
    
    const errorSummary = {
      totalErrors: errorTraces.length,
      errorsByStatus: errorTraces.reduce((acc: Record<number, number>, trace) => {
        if (trace.statusCode) {
          acc[trace.statusCode] = (acc[trace.statusCode] || 0) + 1;
        }
        return acc;
      }, {}),
      errorsByEndpoint: errorTraces.reduce((acc: Record<string, number>, trace) => {
        const key = `${trace.method} ${this.normalizeEndpoint(trace.url)}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    };

    return {
      summary,
      aggregates: aggregates.slice(0, 20), // Top 20 endpoints
      slowOperations: slowOps,
      errorSummary,
    };
  }
}

// Tracing middleware
export function requestTracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tracer = RequestTracer.getInstance();
  const context = tracer.initializeTrace(req);

  // Set correlation ID header
  res.setHeader('X-Correlation-ID', context.traceId);

  // Override res.json to capture response size
  const originalJson = res.json;
  res.json = function(obj: any) {
    if (req.traceContext) {
      req.traceContext.tags.responseSize = JSON.stringify(obj).length;
    }
    return originalJson.call(this, obj);
  };

  // When response finishes, complete the trace
  res.on('finish', () => {
    tracer.finishTrace(context, res.statusCode);
  });

  next();
}

export default RequestTracer;