import { Request, Response } from 'express';
import { Pool } from 'pg';
import config from '../config/environment.js';

// Health check status types
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// Individual component health check result
interface ComponentHealth {
  status: HealthStatus;
  responseTime: number;
  details?: any;
  error?: string;
  lastChecked: string;
}

// Overall system health response
interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  components: {
    [key: string]: ComponentHealth;
  };
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

// Performance metrics
interface PerformanceMetrics {
  timestamp: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
    };
  };
  cpu: {
    usage: number;
  };
  eventLoop: {
    delay: number;
  };
  requests: {
    total: number;
    active: number;
    errorsLast5Min: number;
    avgResponseTime: number;
  };
}

// Database connection pool for health checks
let dbPool: Pool | null = null;

class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private activeRequests: number = 0;
  private lastHealthCheck: SystemHealth | null = null;
  
  private constructor() {
    this.startTime = new Date();
    this.initializeDatabasePool();
    
    // Clear old metrics every 5 minutes
    setInterval(() => {
      this.clearOldMetrics();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  private initializeDatabasePool(): void {
    try {
      const dbConfig = config.getDatabaseConfig();
      dbPool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl,
        min: 1, // Minimum connections for health checks
        max: 3, // Maximum connections for health checks
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: config.get('HEALTH_CHECK_TIMEOUT'),
      });
    } catch (error) {
      console.error('Failed to initialize health check database pool:', error);
    }
  }

  // Database health check
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      if (!dbPool) {
        return {
          status: 'unhealthy',
          responseTime: 0,
          error: 'Database pool not initialized',
          lastChecked: new Date().toISOString(),
        };
      }

      // Test connection with a simple query
      const client = await dbPool.connect();
      const result = await client.query('SELECT 1 as health_check, NOW() as timestamp');
      const connectionCount = await client.query('SELECT numbackends as active_connections FROM pg_stat_database WHERE datname = $1', [config.get('DATABASE_NAME')]);
      client.release();

      const responseTime = Date.now() - startTime;
      const activeConnections = connectionCount.rows[0]?.active_connections || 0;

      // Determine health status based on response time and connection count
      let status: HealthStatus = 'healthy';
      if (responseTime > 1000) {
        status = 'degraded'; // Slow response
      }
      if (responseTime > 5000 || activeConnections > 50) {
        status = 'unhealthy'; // Very slow or too many connections
      }

      return {
        status,
        responseTime,
        details: config.isProduction() ? {
          // Limit details in production for security
          activeConnections: activeConnections > 30 ? 'high' : 'normal',
        } : {
          serverTime: result.rows[0].timestamp,
          activeConnections,
          poolSize: {
            total: dbPool.totalCount,
            idle: dbPool.idleCount,
            waiting: dbPool.waitingCount,
          },
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: config.isProduction() ? 'Database connectivity issue' : (error instanceof Error ? error.message : 'Unknown database error'),
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Memory health check
  private checkMemoryHealth(): ComponentHealth {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external + memUsage.arrayBuffers;
      const usedMemory = memUsage.heapUsed + memUsage.external + memUsage.arrayBuffers;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      // Determine health status based on memory usage
      let status: HealthStatus = 'healthy';
      if (memoryPercentage > 80) {
        status = 'degraded';
      }
      if (memoryPercentage > 95) {
        status = 'unhealthy';
      }

      return {
        status,
        responseTime: Date.now() - startTime,
        details: {
          usage: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
          },
          percentage: Math.round(memoryPercentage * 100) / 100,
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Memory check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Configuration health check
  private async checkConfigurationHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const configHealth = await config.healthCheck();
      
      return {
        status: configHealth.status as HealthStatus,
        responseTime: Date.now() - startTime,
        details: configHealth.details,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Configuration check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // External dependencies health check
  private async checkExternalDependencies(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const checks = [];
      
      // Example: Check external API endpoints if configured
      // This would include third-party services, payment processors, etc.
      
      // For now, we'll simulate external dependency checks
      const externalServices = {
        mockPaymentProcessor: true,
        mockCreditScoring: true,
        mockDocumentService: true,
      };

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          services: externalServices,
          note: 'External dependency checks would be implemented based on actual integrations',
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'External dependency check failed',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Comprehensive system health check
  public async performHealthCheck(): Promise<SystemHealth> {
    const overallStartTime = Date.now();
    
    // Run all health checks in parallel
    const [database, memory, configuration, external] = await Promise.all([
      this.checkDatabaseHealth(),
      Promise.resolve(this.checkMemoryHealth()),
      this.checkConfigurationHealth(),
      this.checkExternalDependencies(),
    ]);

    const components = {
      database,
      memory,
      configuration,
      external,
    };

    // Calculate summary
    const statuses = Object.values(components).map(c => c.status);
    const summary = {
      healthy: statuses.filter(s => s === 'healthy').length,
      degraded: statuses.filter(s => s === 'degraded').length,
      unhealthy: statuses.filter(s => s === 'unhealthy').length,
      total: statuses.length,
    };

    // Determine overall system status
    let overallStatus: HealthStatus = 'healthy';
    if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    }

    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.get('APP_VERSION'),
      environment: config.getEnvironment(),
      uptime: this.getUptime(),
      components,
      summary,
    };

    this.lastHealthCheck = systemHealth;
    return systemHealth;
  }

  // Get performance metrics
  public getPerformanceMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round((memUsage.heapUsed + memUsage.external) / 1024 / 1024),
        total: Math.round((memUsage.heapTotal + memUsage.external) / 1024 / 1024),
        percentage: Math.round(((memUsage.heapUsed + memUsage.external) / (memUsage.heapTotal + memUsage.external)) * 100),
        heap: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
      },
      cpu: {
        usage: this.getCpuUsage(),
      },
      eventLoop: {
        delay: this.getEventLoopDelay(),
      },
      requests: {
        total: this.requestCount,
        active: this.activeRequests,
        errorsLast5Min: this.errorCount,
        avgResponseTime: this.getAverageResponseTime(),
      },
    };
  }

  // Request tracking methods
  public trackRequest(responseTime?: number): void {
    this.requestCount++;
    if (responseTime !== undefined) {
      this.responseTimes.push(responseTime);
      // Keep only last 1000 response times
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }
    }
  }

  public incrementActiveRequests(): void {
    this.activeRequests++;
  }

  public decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  public trackError(): void {
    this.errorCount++;
  }

  // Readiness probe (for Kubernetes/container orchestration)
  public async readinessProbe(): Promise<{ ready: boolean; details?: any }> {
    try {
      // Check if essential services are ready
      const dbHealth = await this.checkDatabaseHealth();
      const configHealth = await this.checkConfigurationHealth();
      
      const isReady = dbHealth.status !== 'unhealthy' && configHealth.status !== 'unhealthy';
      
      return {
        ready: isReady,
        details: {
          database: dbHealth.status,
          configuration: configHealth.status,
          checkedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        ready: false,
        details: {
          error: error instanceof Error ? error.message : 'Readiness check failed',
        },
      };
    }
  }

  // Liveness probe (for Kubernetes/container orchestration)
  public livenessProbe(): { alive: boolean; uptime: number } {
    return {
      alive: true,
      uptime: this.getUptime(),
    };
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, you might want to use a more sophisticated approach
    const usage = process.cpuUsage();
    const total = usage.user + usage.system;
    return Math.round((total / 1000000) * 100) / 100; // Convert to percentage
  }

  private getEventLoopDelay(): number {
    // Simplified event loop delay measurement
    // In production, consider using the 'perf_hooks' module
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return delay;
    });
    return 0; // Placeholder
  }

  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  private clearOldMetrics(): void {
    // Reset error count every 5 minutes
    this.errorCount = 0;
    
    // Keep only recent response times
    if (this.responseTimes.length > 500) {
      this.responseTimes = this.responseTimes.slice(-500);
    }
  }

  // Get cached health check result
  public getLastHealthCheck(): SystemHealth | null {
    return this.lastHealthCheck;
  }
}

export default HealthMonitor;