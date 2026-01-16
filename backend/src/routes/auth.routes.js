const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, verifyRefreshToken, checkAccountLock } = require('../middleware/auth');
const { validate, sanitize } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for whitelisted IPs (optional)
    const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
    return whitelist.includes(req.ip);
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many registration attempts. Please try again later.'
    }
  }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many password reset requests. Please try again later.'
    }
  }
});

const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification requests. Please try again later.'
    }
  }
});

/**
 * Public Routes (No authentication required)
 */

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerLimiter,
  sanitize('body'),
  validate('register'),
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  checkAccountLock,
  sanitize('body'),
  validate('login'),
  authController.login
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post(
  '/verify-email',
  verificationLimiter,
  sanitize('body'),
  validate('verifyEmail'),
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post(
  '/resend-verification',
  verificationLimiter,
  sanitize('body'),
  validate('forgotPassword'), // Same validation as forgot password (email only)
  authController.resendVerification
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  sanitize('body'),
  validate('forgotPassword'),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  passwordResetLimiter,
  sanitize('body'),
  validate('resetPassword'),
  authController.resetPassword
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post(
  '/refresh-token',
  sanitize('body'),
  validate('refreshToken'),
  verifyRefreshToken,
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Public
 */
router.post(
  '/verify-token',
  sanitize('body'),
  authController.verifyToken
);

/**
 * Protected Routes (Authentication required)
 */

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  authController.getProfile
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  sanitize('body'),
  validate('updateProfile'),
  authController.updateProfile
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  sanitize('body'),
  validate('changePassword'),
  authController.changePassword
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

/**
 * @route   DELETE /api/v1/auth/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/account',
  authenticate,
  authController.deleteAccount
);

module.exports = router;
