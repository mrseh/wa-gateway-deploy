const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

/**
 * Logger Configuration using Winston
 * Provides structured logging with file rotation
 */

// Ensure log directory exists
const logDir = process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ' ' + JSON.stringify(metadata);
    }
    
    return msg;
  })
);

// Create transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
);

// File transports (for production)
if (process.env.NODE_ENV !== 'test') {
  // Combined log (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'info'
    })
  );

  // Error log (error level only)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'error'
    })
  );

  // Access log (for HTTP requests)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'access-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: process.env.APP_NAME || 'whatsapp-gateway',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  exitOnError: false
});

/**
 * Custom logging methods
 */

/**
 * Log HTTP request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
logger.logRequest = (req, res, duration) => {
  const log = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous'
  };

  if (res.statusCode >= 500) {
    logger.error('HTTP Request Error', log);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request Warning', log);
  } else {
    logger.info('HTTP Request', log);
  }
};

/**
 * Log database query
 * @param {string} query - SQL query
 * @param {number} duration - Query duration in ms
 */
logger.logQuery = (query, duration) => {
  if (process.env.VERBOSE_LOGGING === 'true') {
    logger.debug('Database Query', {
      query: query.substring(0, 200),
      duration: `${duration}ms`
    });
  }
};

/**
 * Log authentication event
 * @param {string} event - Event type (login, logout, etc.)
 * @param {Object} user - User object
 * @param {Object} metadata - Additional metadata
 */
logger.logAuth = (event, user, metadata = {}) => {
  logger.info('Authentication Event', {
    event,
    userId: user?.id,
    email: user?.email,
    ...metadata
  });
};

/**
 * Log security event
 * @param {string} event - Event type
 * @param {Object} metadata - Event metadata
 */
logger.logSecurity = (event, metadata = {}) => {
  logger.warn('Security Event', {
    event,
    ...metadata
  });
};

/**
 * Log business event
 * @param {string} event - Event type
 * @param {Object} metadata - Event metadata
 */
logger.logBusiness = (event, metadata = {}) => {
  logger.info('Business Event', {
    event,
    ...metadata
  });
};

/**
 * Log error with context
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 */
logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context
  });
};

/**
 * Log performance metric
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in ms
 * @param {Object} metadata - Additional metadata
 */
logger.logPerformance = (operation, duration, metadata = {}) => {
  if (duration > 1000) {
    logger.warn('Slow Operation', {
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  } else {
    logger.debug('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  }
};

/**
 * Create child logger with additional context
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Child logger
 */
logger.child = (metadata) => {
  return logger.child(metadata);
};

/**
 * Log stream for Morgan HTTP logging
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

/**
 * Handle uncaught exceptions
 */
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    format: logFormat
  })
);

/**
 * Handle unhandled promise rejections
 */
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'rejections.log'),
    format: logFormat
  })
);

// Export logger
module.exports = logger;
