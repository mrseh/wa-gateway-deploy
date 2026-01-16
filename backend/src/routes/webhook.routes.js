const express = require('express');
const router = express.Router();
const evolutionWebhookController = require('../controllers/evolutionWebhook.controller');

/**
 * Webhook Routes
 * Base path: /api/v1/webhooks
 */

/**
 * @route   POST /api/v1/webhooks/evolution/:token
 * @desc    Evolution API webhook receiver
 * @access  Public (protected by token)
 */
router.post(
  '/evolution/:token',
  express.json({ limit: '10mb' }), // Increase limit for media webhooks
  evolutionWebhookController.handleWebhook
);

/**
 * @route   GET /api/v1/webhooks/evolution/test
 * @desc    Test webhook endpoint
 * @access  Public
 */
router.get(
  '/evolution/test',
  evolutionWebhookController.testWebhook
);

module.exports = router;
