/**
 * Subscription Routes
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const subscribeValidation = [
  body('package_id').isUUID().withMessage('Invalid package ID'),
  body('duration_months').optional().isInt({ min: 1, max: 12 }).withMessage('Duration must be between 1-12 months'),
];

/**
 * User subscription routes
 */

// Subscribe to a package
router.post(
  '/subscribe',
  authenticate,
  subscribeValidation,
  subscriptionController.subscribe
);

// Get current user subscription
router.get(
  '/my-subscription',
  authenticate,
  subscriptionController.getMySubscription
);

// Get subscription quota/usage
router.get(
  '/quota',
  authenticate,
  subscriptionController.getQuota
);

// Get user invoices
router.get(
  '/invoices',
  authenticate,
  subscriptionController.getInvoices
);

// Get subscription history
router.get(
  '/history',
  authenticate,
  subscriptionController.getHistory
);

// Get subscription details
router.get(
  '/:id',
  authenticate,
  subscriptionController.getSubscription
);

// Renew subscription
router.post(
  '/:id/renew',
  authenticate,
  subscriptionController.renewSubscription
);

// Cancel subscription
router.post(
  '/:id/cancel',
  authenticate,
  subscriptionController.cancelSubscription
);

// Upgrade subscription
router.post(
  '/:id/upgrade',
  authenticate,
  [body('package_id').isUUID().withMessage('Invalid package ID')],
  subscriptionController.upgradeSubscription
);

module.exports = router;
