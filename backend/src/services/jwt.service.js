const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');
const redis = require('../config/redis');

/**
 * JWT Service
 * Handles token generation, verification, and management
 */

/**
 * Generate access token
 * @param {Object} user - User object
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access'
  };
  
  const options = {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  };
  
  return jwt.sign(payload, config.jwt.secret, options);
}

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    type: 'refresh'
  };
  
  const options = {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  };
  
  return jwt.sign(payload, config.jwt.refreshSecret, options);
}

/**
 * Generate token pair (access + refresh)
 * @param {Object} user - User object
 * @returns {Object} Token pair
 */
function generateTokenPair(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Decode to get expiration times
  const accessDecoded = jwt.decode(accessToken);
  const refreshDecoded = jwt.decode(refreshToken);
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: accessDecoded.exp - Math.floor(Date.now() / 1000),
    expires_at: new Date(accessDecoded.exp * 1000),
    refresh_expires_in: refreshDecoded.exp - Math.floor(Date.now() / 1000),
    refresh_expires_at: new Date(refreshDecoded.exp * 1000)
  };
}

/**
 * Verify access token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token
 */
async function verifyAccessToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {Promise<Object>} Decoded token
 */
async function verifyRefreshToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.refreshSecret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

/**
 * Decode token without verification
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Blacklist token (invalidate)
 * @param {string} token - JWT token
 * @param {number} expiresIn - TTL in seconds
 * @returns {Promise<boolean>}
 */
async function blacklistToken(token, expiresIn = null) {
  try {
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return false;
    }
    
    // Calculate TTL if not provided
    if (!expiresIn) {
      const now = Math.floor(Date.now() / 1000);
      expiresIn = Math.max(decoded.exp - now, 0);
    }
    
    // Store in Redis with expiration
    const key = `blacklist:${token}`;
    await redis.set(key, '1', expiresIn);
    
    logger.logSecurity('token_blacklisted', {
      userId: decoded.userId,
      tokenType: decoded.type,
      expiresIn
    });
    
    return true;
  } catch (error) {
    logger.error('Error blacklisting token:', error);
    return false;
  }
}

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token
 * @returns {Promise<boolean>}
 */
async function isTokenBlacklisted(token) {
  try {
    const key = `blacklist:${token}`;
    return await redis.exists(key);
  } catch (error) {
    logger.error('Error checking token blacklist:', error);
    return false;
  }
}

/**
 * Blacklist all user tokens
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function blacklistUserTokens(userId) {
  try {
    // Store user ID in blacklist
    const key = `blacklist:user:${userId}`;
    await redis.set(key, '1', 7 * 24 * 60 * 60); // 7 days
    
    logger.logSecurity('user_tokens_blacklisted', { userId });
    return true;
  } catch (error) {
    logger.error('Error blacklisting user tokens:', error);
    return false;
  }
}

/**
 * Check if user tokens are blacklisted
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function areUserTokensBlacklisted(userId) {
  try {
    const key = `blacklist:user:${userId}`;
    return await redis.exists(key);
  } catch (error) {
    logger.error('Error checking user token blacklist:', error);
    return false;
  }
}

/**
 * Store refresh token
 * @param {string} userId - User ID
 * @param {string} token - Refresh token
 * @param {number} expiresIn - TTL in seconds
 * @returns {Promise<boolean>}
 */
async function storeRefreshToken(userId, token, expiresIn = 7 * 24 * 60 * 60) {
  try {
    const key = `refresh_token:${userId}`;
    await redis.set(key, token, expiresIn);
    return true;
  } catch (error) {
    logger.error('Error storing refresh token:', error);
    return false;
  }
}

/**
 * Get stored refresh token
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
async function getStoredRefreshToken(userId) {
  try {
    const key = `refresh_token:${userId}`;
    return await redis.get(key);
  } catch (error) {
    logger.error('Error getting refresh token:', error);
    return null;
  }
}

/**
 * Delete refresh token
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function deleteRefreshToken(userId) {
  try {
    const key = `refresh_token:${userId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Error deleting refresh token:', error);
    return false;
  }
}

/**
 * Rotate refresh token (invalidate old, generate new)
 * @param {Object} user - User object
 * @param {string} oldToken - Old refresh token
 * @returns {Promise<Object>} New token pair
 */
async function rotateRefreshToken(user, oldToken) {
  try {
    // Blacklist old token
    await blacklistToken(oldToken);
    
    // Generate new token pair
    const tokens = generateTokenPair(user);
    
    // Store new refresh token
    const decoded = decodeToken(tokens.refresh_token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    await storeRefreshToken(user.id, tokens.refresh_token, expiresIn);
    
    logger.logAuth('refresh_token_rotated', user);
    
    return tokens;
  } catch (error) {
    logger.error('Error rotating refresh token:', error);
    throw error;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null}
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null}
 */
function getTokenExpiration(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return null;
  }
  
  return new Date(decoded.exp * 1000);
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean}
 */
function isTokenExpired(token) {
  const expiration = getTokenExpiration(token);
  
  if (!expiration) {
    return true;
  }
  
  return new Date() > expiration;
}

/**
 * Get remaining token lifetime in seconds
 * @param {string} token - JWT token
 * @returns {number}
 */
function getTokenLifetime(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return 0;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return Math.max(decoded.exp - now, 0);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  blacklistToken,
  isTokenBlacklisted,
  blacklistUserTokens,
  areUserTokensBlacklisted,
  storeRefreshToken,
  getStoredRefreshToken,
  deleteRefreshToken,
  rotateRefreshToken,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpired,
  getTokenLifetime
};
