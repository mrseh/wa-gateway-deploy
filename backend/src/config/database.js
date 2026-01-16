const { Sequelize } = require('sequelize');
const logger = require('./logger');

/**
 * Database Configuration with Connection Pooling
 * Handles PostgreSQL connection with proper error handling and logging
 */

const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'wagateway',
  username: process.env.POSTGRES_USER || 'wagateway',
  password: process.env.POSTGRES_PASSWORD || 'wagateway_password',
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    statement_timeout: 30000, // 30 seconds
    idle_in_transaction_session_timeout: 60000 // 60 seconds
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    acquire: 30000, // Maximum time to acquire connection
    idle: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
    evict: 1000 // Check for idle connections every second
  },
  logging: (msg) => {
    if (process.env.NODE_ENV !== 'production' && process.env.VERBOSE_LOGGING === 'true') {
      logger.debug(msg);
    }
  },
  benchmark: true,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/
    ]
  }
};

// Create Sequelize instance
const sequelize = new Sequelize(config.database, config.username, config.password, config);

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('✓ Database connection established successfully');
    
    // Test query
    const result = await sequelize.query('SELECT 1 as test');
    logger.info('✓ Database query test passed');
    
    return true;
  } catch (error) {
    logger.error('✗ Unable to connect to database:', error);
    throw error;
  }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeConnection() {
  try {
    await sequelize.close();
    logger.info('✓ Database connection closed successfully');
  } catch (error) {
    logger.error('✗ Error closing database connection:', error);
    throw error;
  }
}

/**
 * Check if database is healthy
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  try {
    const startTime = Date.now();
    await sequelize.authenticate();
    const duration = Date.now() - startTime;
    
    const poolInfo = {
      size: sequelize.connectionManager.pool.size,
      available: sequelize.connectionManager.pool.available,
      using: sequelize.connectionManager.pool.using,
      waiting: sequelize.connectionManager.pool.waiting
    };
    
    return {
      status: 'healthy',
      duration,
      pool: poolInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
async function getStats() {
  try {
    const [result] = await sequelize.query(`
      SELECT 
        numbackends as active_connections,
        xact_commit as transactions_committed,
        xact_rollback as transactions_rolled_back,
        blks_read as blocks_read,
        blks_hit as blocks_hit,
        tup_returned as tuples_returned,
        tup_fetched as tuples_fetched,
        tup_inserted as tuples_inserted,
        tup_updated as tuples_updated,
        tup_deleted as tuples_deleted
      FROM pg_stat_database 
      WHERE datname = current_database()
    `);
    
    return result[0];
  } catch (error) {
    logger.error('Error getting database stats:', error);
    throw error;
  }
}

/**
 * Execute transaction with retry logic
 * @param {Function} callback - Transaction callback
 * @param {Object} options - Transaction options
 * @returns {Promise<any>}
 */
async function executeTransaction(callback, options = {}) {
  const maxRetries = options.maxRetries || 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await sequelize.transaction(
        {
          isolationLevel: options.isolationLevel || Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
          ...options
        },
        callback
      );
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        logger.error(`Transaction failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      
      // Check if error is retryable
      const isRetryable = /deadlock|lock|serialization/i.test(error.message);
      if (!isRetryable) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      logger.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
  logger.info('Closing database connections...');
  
  try {
    await closeConnection();
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error('Error during database shutdown:', error);
    throw error;
  }
}

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors
sequelize.addHook('afterConnect', (connection) => {
  logger.debug('New database connection established');
});

sequelize.addHook('beforeDisconnect', (connection) => {
  logger.debug('Database connection about to close');
});

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  closeConnection,
  healthCheck,
  getStats,
  executeTransaction,
  gracefulShutdown,
  
  // Export config for testing
  config: process.env.NODE_ENV === 'test' ? config : undefined
};
