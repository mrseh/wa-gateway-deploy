// Configuration file
require('dotenv').config();

module.exports = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8000,
  
  // URLs
  apiUrl: process.env.API_URL || 'http://localhost:8000',
  frontendUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },
  
  // Evolution API
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    globalApiKey: process.env.EVOLUTION_GLOBAL_API_KEY
  },
  
  // Payment Gateway - Midtrans
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true'
  },
  
  // Payment Gateway - Xendit
  xendit: {
    secretKey: process.env.XENDIT_SECRET_KEY
  },
  
  // Email (SMTP)
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'WA Gateway <noreply@example.com>'
  },
  
  // InfluxDB
  influx: {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN,
    org: process.env.INFLUXDB_ORG || 'wagateway',
    bucket: process.env.INFLUXDB_BUCKET || 'pon_monitoring'
  },
  
  // Application Features
  features: {
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    trialPeriodDays: parseInt(process.env.TRIAL_PERIOD_DAYS, 10) || 7,
    maxInstancesFree: parseInt(process.env.MAX_INSTANCES_FREE, 10) || 1,
    maxMessagesFree: parseInt(process.env.MAX_MESSAGES_FREE, 10) || 100
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_FILE_MAX_FILES || '7d'
  },
  
  // Sentry (Error Tracking)
  sentry: {
    dsn: process.env.SENTRY_DSN
  }
};
