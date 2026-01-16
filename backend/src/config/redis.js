const Redis = require('ioredis');
const logger = require('./logger');

/**
 * Redis Configuration with Connection Management
 * Handles caching, session storage, and pub/sub functionality
 */

// Redis client options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_PREFIX || 'wa_gateway:',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  keepAlive: 30000,
  lazyConnect: false,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
};

// Create Redis client
const redis = new Redis(redisOptions);

// Create separate client for pub/sub
const redisPubSub = new Redis(redisOptions);

/**
 * Redis Event Handlers
 */
redis.on('connect', () => {
  logger.info('✓ Redis client connecting...');
});

redis.on('ready', () => {
  logger.info('✓ Redis client ready');
});

redis.on('error', (error) => {
  logger.error('✗ Redis client error:', error);
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

redis.on('end', () => {
  logger.info('Redis client connection ended');
});

/**
 * Test Redis connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const result = await redis.ping();
    if (result === 'PONG') {
      logger.info('✓ Redis connection test successful');
      return true;
    }
    throw new Error('Redis ping failed');
  } catch (error) {
    logger.error('✗ Redis connection test failed:', error);
    throw error;
  }
}

/**
 * Get Redis client info
 * @returns {Promise<Object>}
 */
async function getInfo() {
  try {
    const info = await redis.info();
    const lines = info.split('\r\n');
    const result = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key.trim()] = value.trim();
        }
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Error getting Redis info:', error);
    throw error;
  }
}

/**
 * Health check
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  try {
    const startTime = Date.now();
    await redis.ping();
    const duration = Date.now() - startTime;
    
    const info = await getInfo();
    
    return {
      status: 'healthy',
      duration,
      connected_clients: parseInt(info.connected_clients || '0', 10),
      used_memory: info.used_memory_human,
      uptime_in_seconds: parseInt(info.uptime_in_seconds || '0', 10),
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
 * Cache Operations
 */

/**
 * Get cached value
 * @param {string} key 
 * @returns {Promise<any>}
 */
async function get(key) {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    logger.error(`Error getting cache key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttl = 3600) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl > 0) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error setting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cached value
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
async function del(key) {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error(`Error deleting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Delete keys by pattern
 * @param {string} pattern 
 * @returns {Promise<number>}
 */
async function delByPattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error(`Error deleting cache pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if key exists
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
async function exists(key) {
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Error checking cache key ${key}:`, error);
    return false;
  }
}

/**
 * Set expiry on key
 * @param {string} key 
 * @param {number} seconds 
 * @returns {Promise<boolean>}
 */
async function expire(key, seconds) {
  try {
    await redis.expire(key, seconds);
    return true;
  } catch (error) {
    logger.error(`Error setting expiry on key ${key}:`, error);
    return false;
  }
}

/**
 * Increment value
 * @param {string} key 
 * @param {number} amount 
 * @returns {Promise<number>}
 */
async function incr(key, amount = 1) {
  try {
    return await redis.incrby(key, amount);
  } catch (error) {
    logger.error(`Error incrementing key ${key}:`, error);
    throw error;
  }
}

/**
 * Hash Operations
 */

/**
 * Set hash field
 * @param {string} key 
 * @param {string} field 
 * @param {any} value 
 * @returns {Promise<boolean>}
 */
async function hset(key, field, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.hset(key, field, serialized);
    return true;
  } catch (error) {
    logger.error(`Error setting hash field ${key}:${field}:`, error);
    return false;
  }
}

/**
 * Get hash field
 * @param {string} key 
 * @param {string} field 
 * @returns {Promise<any>}
 */
async function hget(key, field) {
  try {
    const value = await redis.hget(key, field);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    logger.error(`Error getting hash field ${key}:${field}:`, error);
    return null;
  }
}

/**
 * Get all hash fields
 * @param {string} key 
 * @returns {Promise<Object>}
 */
async function hgetall(key) {
  try {
    const data = await redis.hgetall(key);
    const result = {};
    
    Object.keys(data).forEach(field => {
      try {
        result[field] = JSON.parse(data[field]);
      } catch {
        result[field] = data[field];
      }
    });
    
    return result;
  } catch (error) {
    logger.error(`Error getting hash ${key}:`, error);
    return {};
  }
}

/**
 * List Operations
 */

/**
 * Push to list
 * @param {string} key 
 * @param {any} value 
 * @returns {Promise<number>}
 */
async function lpush(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await redis.lpush(key, serialized);
  } catch (error) {
    logger.error(`Error pushing to list ${key}:`, error);
    throw error;
  }
}

/**
 * Pop from list
 * @param {string} key 
 * @returns {Promise<any>}
 */
async function lpop(key) {
  try {
    const value = await redis.lpop(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    logger.error(`Error popping from list ${key}:`, error);
    return null;
  }
}

/**
 * Get list length
 * @param {string} key 
 * @returns {Promise<number>}
 */
async function llen(key) {
  try {
    return await redis.llen(key);
  } catch (error) {
    logger.error(`Error getting list length ${key}:`, error);
    return 0;
  }
}

/**
 * Pub/Sub Operations
 */

/**
 * Publish message
 * @param {string} channel 
 * @param {any} message 
 * @returns {Promise<number>}
 */
async function publish(channel, message) {
  try {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return await redisPubSub.publish(channel, serialized);
  } catch (error) {
    logger.error(`Error publishing to channel ${channel}:`, error);
    throw error;
  }
}

/**
 * Subscribe to channel
 * @param {string} channel 
 * @param {Function} callback 
 * @returns {Promise<void>}
 */
async function subscribe(channel, callback) {
  try {
    await redisPubSub.subscribe(channel);
    
    redisPubSub.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch {
          callback(message);
        }
      }
    });
  } catch (error) {
    logger.error(`Error subscribing to channel ${channel}:`, error);
    throw error;
  }
}

/**
 * Close Redis connections
 * @returns {Promise<void>}
 */
async function closeConnection() {
  try {
    await redis.quit();
    await redisPubSub.quit();
    logger.info('✓ Redis connections closed successfully');
  } catch (error) {
    logger.error('✗ Error closing Redis connections:', error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
  logger.info('Closing Redis connections...');
  await closeConnection();
}

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
  redis,
  redisPubSub,
  testConnection,
  healthCheck,
  getInfo,
  closeConnection,
  
  // Cache operations
  get,
  set,
  del,
  delByPattern,
  exists,
  expire,
  incr,
  
  // Hash operations
  hset,
  hget,
  hgetall,
  
  // List operations
  lpush,
  lpop,
  llen,
  
  // Pub/Sub operations
  publish,
  subscribe,
  
  gracefulShutdown
};
