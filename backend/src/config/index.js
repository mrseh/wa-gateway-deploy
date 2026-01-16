require('dotenv').config();
const logger = require('./logger');

/**
 * Main Configuration Index
 * Aggregates all configuration modules and provides validation
 */

// Validate required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

/**
 * Application Configuration
 */
const config = {
  // Application
  app: {
    name: process.env.APP_NAME || 'WhatsApp Gateway',
    env: process.env.NODE_ENV || 'development',
    url: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:8000',
    port: parseInt(process.env.PORT || '8000', 10),
    debug: process.env.DEBUG === 'true',
    timezone: process.env.TZ || 'Asia/Jakarta'
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'wagateway',
    username: process.env.POSTGRES_USER || 'wagateway',
    password: process.env.POSTGRES_PASSWORD,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10)
    },
    ssl: process.env.DB_SSL === 'true'
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    prefix: process.env.REDIS_PREFIX || 'wa_gateway:'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'whatsapp-gateway',
    audience: process.env.JWT_AUDIENCE || 'whatsapp-gateway-users'
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY
  },

  // SMTP Email
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'WhatsApp Gateway',
      email: process.env.SMTP_FROM_EMAIL || 'noreply@yourdomain.com'
    }
  },

  // Evolution API
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY,
    webhookUrl: process.env.EVOLUTION_WEBHOOK_URL,
    webhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET
  },

  // MinIO
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'wa-gateway-media'
  },

  // InfluxDB
  influxdb: {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN,
    org: process.env.INFLUXDB_ORG || 'wagateway',
    bucket: process.env.INFLUXDB_BUCKET || 'pon_monitoring',
    retention: process.env.INFLUXDB_RETENTION || '30d'
  },

  // Prometheus
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10)
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || '5', 10)
    }
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif').split(',')
  },

  // Payment (Midtrans)
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    merchantId: process.env.MIDTRANS_MERCHANT_ID
  },

  // SNMP
  snmp: {
    timeout: parseInt(process.env.SNMP_TIMEOUT || '5000', 10),
    retries: parseInt(process.env.SNMP_RETRIES || '3', 10),
    version: process.env.SNMP_VERSION || '2c',
    community: process.env.SNMP_COMMUNITY || 'public'
  },

  // Webhook
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.WEBHOOK_RETRY_COUNT || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10)
  },

  // Queue
  queue: {
    redisUrl: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    maxJobs: parseInt(process.env.QUEUE_MAX_JOBS || '1000', 10)
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    passwordMaxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10)
  },

  // Monitoring
  monitoring: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10),
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '15000', 10)
  },

  // Backup
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 3 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    path: process.env.BACKUP_PATH || '/backups',
    s3: {
      bucket: process.env.BACKUP_S3_BUCKET,
      region: process.env.BACKUP_S3_REGION,
      accessKey: process.env.BACKUP_S3_ACCESS_KEY,
      secretKey: process.env.BACKUP_S3_SECRET_KEY
    }
  },

  // Feature Flags
  features: {
    ponMonitoring: process.env.FEATURE_PON_MONITORING === 'true',
    mikrotikIntegration: process.env.FEATURE_MIKROTIK_INTEGRATION === 'true',
    zabbixIntegration: process.env.FEATURE_ZABBIX_INTEGRATION === 'true',
    bulkMessaging: process.env.FEATURE_BULK_MESSAGING === 'true',
    analytics: process.env.FEATURE_ANALYTICS === 'true',
    scheduledReports: process.env.FEATURE_SCHEDULED_REPORTS === 'true'
  },

  // Admin
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  }
};

/**
 * Validate configuration
 * @returns {boolean}
 */
function validateConfig() {
  try {
    // Validate JWT secret length
    if (config.jwt.secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    // Validate refresh secret
    if (config.jwt.refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    // Validate database connection
    if (!config.database.url && !config.database.host) {
      throw new Error('Database configuration is incomplete');
    }

    // Validate Redis connection
    if (!config.redis.url && !config.redis.host) {
      throw new Error('Redis configuration is incomplete');
    }

    logger.info('✓ Configuration validated successfully');
    return true;
  } catch (error) {
    logger.error('✗ Configuration validation failed:', error);
    throw error;
  }
}

/**
 * Get configuration value by path
 * @param {string} path - Dot notation path (e.g., 'app.port')
 * @returns {any}
 */
function get(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

/**
 * Check if running in production
 * @returns {boolean}
 */
function isProduction() {
  return config.app.env === 'production';
}

/**
 * Check if running in development
 * @returns {boolean}
 */
function isDevelopment() {
  return config.app.env === 'development';
}

/**
 * Check if running in test
 * @returns {boolean}
 */
function isTest() {
  return config.app.env === 'test';
}

// Validate configuration on load
validateConfig();

// Log configuration (without sensitive data)
if (isDevelopment()) {
  logger.info('Configuration loaded:', {
    env: config.app.env,
    port: config.app.port,
    database: `${config.database.host}:${config.database.port}/${config.database.database}`,
    redis: `${config.redis.host}:${config.redis.port}`,
    features: config.features
  });
}

module.exports = {
  ...config,
  get,
  isProduction,
  isDevelopment,
  isTest,
  validateConfig
};
