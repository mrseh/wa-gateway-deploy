/**
 * Payment Routes
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * Public routes (webhook)
 */

// Midtrans notification webhook (no auth required)
router.post(
  '/midtrans/notification',
  paymentController.handleMidtransWebhook
);

/**
 * User payment routes
 */

// Get payment methods
router.get(
  '/methods',
  paymentController.getPaymentMethods
);

// Check payment status
router.get(
  '/:transactionId/status',
  authenticate,
  paymentController.checkPaymentStatus
);

// Cancel payment
router.post(
  '/:transactionId/cancel',
  authenticate,
  paymentController.cancelPayment
);

// Retry failed payment
router.post(
  '/:transactionId/retry',
  authenticate,
  paymentController.retryPayment
);

// Get transaction by invoice
router.get(
  '/invoice/:invoiceNumber',
  authenticate,
  paymentController.getByInvoice
);

/**
 * Admin routes
 */

// Get payment statistics
router.get(
  '/statistics',
  authenticate,
  isAdmin,
  paymentController.getStatistics
);

// Process refund
router.post(
  '/:transactionId/refund',
  authenticate,
  isAdmin,
  paymentController.requestRefund
);

module.exports = router;
