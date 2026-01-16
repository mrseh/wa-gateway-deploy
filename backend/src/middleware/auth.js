const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');
const redis = require('../config/redis');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Handles JWT verification, role-based access control, and token management
 */

/**
 * Extract token from request headers
 * @param {Object} req - Express request object
 * @returns {string|null}
 */
function extractToken(req) {
  // Check Authorization header
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  
  // Check query parameter (for WebSocket connections)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  // Check cookie (if using cookie-based auth)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyToken(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
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
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication token is required'
        }
      });
    }
    
    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      logger.logSecurity('blacklisted_token_used', {
        token: token.substring(0, 20) + '...',
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked'
        }
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = await verifyToken(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
            expiredAt: error.expiredAt
          }
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token'
          }
        });
      }
      
      throw error;
    }
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: `Account is ${user.status}`,
          status: user.status
        }
      });
    }
    
    // Check if email is verified
    if (!user.email_verified && req.path !== '/api/v1/auth/verify-email') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address'
        }
      });
    }
    
    // Attach user and token to request
    req.user = user;
    req.token = token;
    req.tokenDecoded = decoded;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }
    
    // Try to verify token
    try {
      const decoded = await verifyToken(token, config.jwt.secret);
      const user = await User.findByPk(decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = user;
        req.token = token;
        req.tokenDecoded = decoded;
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

/**
 * Role-Based Access Control Middleware
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required'
        }
      });
    }
    
    if (!roles.includes(req.user.role)) {
      logger.logSecurity('unauthorized_access_attempt', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource',
          requiredRoles: roles,
          yourRole: req.user.role
        }
      });
    }
    
    next();
  };
};

/**
 * Require Admin Role
 */
const requireAdmin = requireRole('admin');

/**
 * Check if user owns resource
 * @param {Function} getResourceUserId - Function to extract user ID from resource
 */
const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required'
          }
        });
      }
      
      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Get resource user ID
      const resourceUserId = await getResourceUserId(req);
      
      if (!resourceUserId || resourceUserId !== req.user.id) {
        logger.logSecurity('ownership_violation', {
          userId: req.user.id,
          resourceUserId,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'NOT_OWNER',
            message: 'You do not own this resource'
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'OWNERSHIP_CHECK_ERROR',
          message: 'Failed to verify resource ownership'
        }
      });
    }
  };
};

/**
 * Verify Refresh Token
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required'
        }
      });
    }
    
    // Check if token is blacklisted
    if (await isTokenBlacklisted(refreshToken)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Refresh token has been revoked'
        }
      });
    }
    
    // Verify token
    try {
      const decoded = await verifyToken(refreshToken, config.jwt.refreshSecret);
      
      // Get user
      const user = await User.findByPk(decoded.userId);
      
      if (!user || user.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_USER',
            message: 'User is invalid or inactive'
          }
        });
      }
      
      req.user = user;
      req.refreshToken = refreshToken;
      req.refreshTokenDecoded = decoded;
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired'
          }
        });
      }
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    }
  } catch (error) {
    logger.error('Refresh token verification error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_TOKEN_ERROR',
        message: 'Failed to verify refresh token'
      }
    });
  }
};

/**
 * Check if account is locked
 */
const checkAccountLock = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }
    
    const user = await User.findByEmail(email);
    
    if (user && user.isLocked()) {
      const remainingTime = Math.ceil((user.locked_until - new Date()) / 1000 / 60);
      
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account is locked due to too many failed login attempts. Try again in ${remainingTime} minutes.`,
          locked_until: user.locked_until,
          remaining_minutes: remainingTime
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Account lock check error:', error);
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireOwnership,
  verifyRefreshToken,
  checkAccountLock,
  extractToken,
  verifyToken,
  isTokenBlacklisted
};
