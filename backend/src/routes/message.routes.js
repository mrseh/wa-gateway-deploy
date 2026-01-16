const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { validate, sanitize } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

/**
 * Message Routes
 * Base path: /api/v1/messages
 */

// Rate limiter for message sending
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many messages sent. Please try again later.'
    }
  }
});

/**
 * @route   GET /api/v1/messages
 * @desc    Get messages with filters
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  messageController.getMessages
);

/**
 * @route   GET /api/v1/messages/statistics
 * @desc    Get message statistics
 * @access  Private
 */
router.get(
  '/statistics',
  authenticate,
  messageController.getMessageStatistics
);

/**
 * @route   GET /api/v1/messages/quota
 * @desc    Get message quota
 * @access  Private
 */
router.get(
  '/quota',
  authenticate,
  messageController.getQuota
);

/**
 * @route   GET /api/v1/messages/:id
 * @desc    Get single message
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  messageController.getMessage
);

/**
 * @route   POST /api/v1/messages/send
 * @desc    Send text message
 * @access  Private
 */
router.post(
  '/send',
  authenticate,
  messageLimiter,
  sanitize('body'),
  validate('sendMessage'),
  messageController.sendMessage
);

/**
 * @route   POST /api/v1/messages/send-media
 * @desc    Send media message
 * @access  Private
 */
router.post(
  '/send-media',
  authenticate,
  messageLimiter,
  sanitize('body'),
  messageController.sendMediaMessage
);

/**
 * @route   POST /api/v1/messages/send-group
 * @desc    Send group message
 * @access  Private
 */
router.post(
  '/send-group',
  authenticate,
  messageLimiter,
  sanitize('body'),
  messageController.sendGroupMessage
);

/**
 * @route   POST /api/v1/messages/:id/retry
 * @desc    Retry failed message
 * @access  Private
 */
router.post(
  '/:id/retry',
  authenticate,
  messageController.retryMessage
);

/**
 * @route   DELETE /api/v1/messages/:id
 * @desc    Delete message
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  messageController.deleteMessage
);

module.exports = router;
