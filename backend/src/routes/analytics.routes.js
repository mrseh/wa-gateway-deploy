const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth');

// Dashboard analytics
router.get('/dashboard', authenticate, analyticsController.getDashboardAnalytics.bind(analyticsController));

// Message report
router.get('/messages', authenticate, analyticsController.getMessageReport.bind(analyticsController));

module.exports = router;
