const express = require('express');
const router = express.Router();
const mikrotikController = require('../controllers/mikrotik.controller');
const { authenticate } = require('../middleware/auth');

// Public webhook (no auth)
router.post('/mikrotik/:token', mikrotikController.handleWebhook);

// Protected routes
router.get('/mikrotik/events', authenticate, mikrotikController.getMikrotikEvents);
router.get('/mikrotik/script', authenticate, mikrotikController.generateScript);

module.exports = router;
