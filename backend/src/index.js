require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./config/logger');
const { testConnection: testDatabase, gracefulShutdown: closeDatabase } = require('./config/database');
const { testConnection: testRedis, gracefulShutdown: closeRedis } = require('./config/redis');

/**
 * WhatsApp Gateway SaaS Platform
 * Main Application Entry Point
 */

// Create Express app
const app = express();

// Trust proxy (for running behind reverse proxy)
app.set('trust proxy', 1);

/**
 * Security Middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/**
 * CORS Configuration
 */
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
}));

/**
 * Body Parsing Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Compression
 */
app.use(compression());

/**
 * Request Logging
 */
if (config.app.env !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

/**
 * Request ID Middleware
 */
app.use((req, res, next) => {
  req.id = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

/**
 * Request Timing Middleware
 */
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  // Override res.json to add timing
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const duration = Date.now() - req.startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log request
    logger.logRequest(req, res, duration);
    
    return originalJson(data);
  };
  
  next();
});

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env,
    version: require('../package.json').version
  });
});

/**
 * Detailed Health Check
 */
app.get('/health/detailed', async (req, res) => {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString()
  };

  try {
    // Check database
    const { sequelize } = require('./config/database');
    await sequelize.authenticate();
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
    logger.error('Database health check failed:', error);
  }

  try {
    // Check Redis
    const { redis } = require('./config/redis');
    await redis.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
    logger.error('Redis health check failed:', error);
  }

  const allHealthy = Object.values(checks).every(v => 
    v === 'healthy' || v === new Date().toISOString()
  );

  res.status(allHealthy ? 200 : 503).json(checks);
});

/**
 * Readiness Probe (for Kubernetes)
 */
app.get('/ready', async (req, res) => {
  try {
    const { sequelize } = require('./config/database');
    await sequelize.authenticate();
    
    const { redis } = require('./config/redis');
    await redis.ping();
    
    res.json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ 
      status: 'not ready', 
      error: error.message 
    });
  }
});

/**
 * Liveness Probe (for Kubernetes)
 */
app.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});

/**
 * API Routes
 */
const authRoutes = require('./routes/auth.routes');
const instanceRoutes = require('./routes/instance.routes');
const messageRoutes = require('./routes/message.routes');
const webhookRoutes = require('./routes/webhook.routes');
const packageRoutes = require('./routes/package.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const paymentRoutes = require('./routes/payment.routes');
const mikrotikRoutes = require('./routes/mikrotik.routes');
const zabbixRoutes = require('./routes/zabbix.routes');
const oltRoutes = require('./routes/olt.routes');
const bulkMessageRoutes = require('./routes/bulkMessage.routes');
const analyticsRoutes = require('./routes/analytics.routes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/instances', instanceRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/packages', packageRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/webhooks', mikrotikRoutes);
app.use('/api/v1/webhooks', zabbixRoutes);
app.use('/api/v1/olts', oltRoutes);
app.use('/api/v1/bulk-messages', bulkMessageRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

/**
 * API Documentation
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'WhatsApp Gateway API',
    version: '1.0.0',
    description: 'WhatsApp Gateway SaaS Platform API',
    endpoints: {
      health: {
        basic: 'GET /health',
        detailed: 'GET /health/detailed',
        ready: 'GET /ready',
        live: 'GET /live'
      },
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout'
      },
      instances: {
        list: 'GET /api/v1/instances',
        create: 'POST /api/v1/instances',
        get: 'GET /api/v1/instances/:id',
        update: 'PUT /api/v1/instances/:id',
        delete: 'DELETE /api/v1/instances/:id'
      },
      messages: {
        send: 'POST /api/v1/messages/send',
        list: 'GET /api/v1/messages',
        get: 'GET /api/v1/messages/:id'
      }
    },
    documentation: `${config.app.apiUrl}/docs`
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      path: req.path,
      method: req.method
    }
  });
});

/**
 * Global Error Handler
 */
app.use((error, req, res, next) => {
  // Log error
  logger.logError(error, {
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    user: req.user?.id
  });

  // Determine status code
  const statusCode = error.statusCode || error.status || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: config.isProduction() 
        ? 'An internal error occurred' 
        : error.message,
      ...(config.isDevelopment() && { stack: error.stack }),
      requestId: req.id
    }
  });
});

/**
 * Initialize Application
 */
async function initializeApp() {
  try {
    logger.info('========================================');
    logger.info('Initializing WhatsApp Gateway API...');
    logger.info('========================================');

    // Test database connection
    logger.info('Testing database connection...');
    await testDatabase();

    // Test Redis connection
    logger.info('Testing Redis connection...');
    await testRedis();

    // Start background jobs
    logger.info('Starting background jobs...');
    const jobManager = require('./jobs');
    jobManager.startAll();

    logger.info('✓ All connections established');
    logger.info('========================================');

    return true;
  } catch (error) {
    logger.error('========================================');
    logger.error('✗ Failed to initialize application');
    logger.error('========================================');
    logger.error(error);
    throw error;
  }
}

/**
 * Start Server
 */
async function startServer() {
  try {
    // Initialize application
    await initializeApp();

    // Start listening
    const port = config.app.port;
    const server = app.listen(port, () => {
      logger.info('========================================');
      logger.info(`✓ Server started successfully`);
      logger.info(`  Environment: ${config.app.env}`);
      logger.info(`  Port: ${port}`);
      logger.info(`  URL: ${config.app.apiUrl}`);
      logger.info('========================================');
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('✓ HTTP server closed');

        try {
          // Close database connection
          await closeDatabase();
          logger.info('✓ Database connections closed');

          // Close Redis connection
          await closeRedis();
          logger.info('✓ Redis connections closed');

          logger.info('✓ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('✗ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('✗ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, startServer, initializeApp };
