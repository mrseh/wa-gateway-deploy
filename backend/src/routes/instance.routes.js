const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instance.controller');
const { authenticate } = require('../middleware/auth');
const { validate, sanitize } = require('../middleware/validation');

/**
 * Instance Routes
 * Base path: /api/v1/instances
 */

/**
 * @route   GET /api/v1/instances
 * @desc    Get all user instances
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  instanceController.getInstances
);

/**
 * @route   GET /api/v1/instances/:id
 * @desc    Get single instance
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  instanceController.getInstance
);

/**
 * @route   POST /api/v1/instances
 * @desc    Create new instance
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  sanitize('body'),
  validate('createInstance'),
  instanceController.createInstance
);

/**
 * @route   PUT /api/v1/instances/:id
 * @desc    Update instance
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  sanitize('body'),
  validate('updateInstance'),
  instanceController.updateInstance
);

/**
 * @route   DELETE /api/v1/instances/:id
 * @desc    Delete instance
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  instanceController.deleteInstance
);

/**
 * @route   POST /api/v1/instances/:id/connect
 * @desc    Connect instance (get QR code)
 * @access  Private
 */
router.post(
  '/:id/connect',
  authenticate,
  instanceController.connectInstance
);

/**
 * @route   POST /api/v1/instances/:id/disconnect
 * @desc    Disconnect instance
 * @access  Private
 */
router.post(
  '/:id/disconnect',
  authenticate,
  instanceController.disconnectInstance
);

/**
 * @route   POST /api/v1/instances/:id/restart
 * @desc    Restart instance
 * @access  Private
 */
router.post(
  '/:id/restart',
  authenticate,
  instanceController.restartInstance
);

/**
 * @route   GET /api/v1/instances/:id/status
 * @desc    Get instance status
 * @access  Private
 */
router.get(
  '/:id/status',
  authenticate,
  instanceController.getInstanceStatus
);

/**
 * @route   GET /api/v1/instances/:id/profile
 * @desc    Get instance profile
 * @access  Private
 */
router.get(
  '/:id/profile',
  authenticate,
  instanceController.getInstanceProfile
);

/**
 * @route   GET /api/v1/instances/:id/groups
 * @desc    Get instance groups
 * @access  Private
 */
router.get(
  '/:id/groups',
  authenticate,
  instanceController.getInstanceGroups
);

/**
 * @route   GET /api/v1/instances/:id/logs
 * @desc    Get instance message logs
 * @access  Private
 */
router.get(
  '/:id/logs',
  authenticate,
  instanceController.getInstanceLogs
);

module.exports = router;
