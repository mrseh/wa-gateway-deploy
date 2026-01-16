const express = require('express');
const router = express.Router();
const { controller, upload } = require('../controllers/bulkMessage.controller');
const { authenticate } = require('../middleware/auth');
const expressSession = require('express-session');

// Session middleware for CSV data storage
router.use(expressSession({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }, // 1 hour
}));

// Upload CSV
router.post('/upload-csv', authenticate, upload.single('csv'), controller.uploadCSV.bind(controller));

// Send bulk
router.post('/send', authenticate, controller.sendBulk.bind(controller));

// Get batch status
router.get('/batch/:batchId', authenticate, controller.getBatchStatus.bind(controller));

// Get batch history
router.get('/history', authenticate, controller.getBatchHistory.bind(controller));

// Get batch details
router.get('/batch/:batchId/details', authenticate, controller.getBatchDetails.bind(controller));

// Cancel batch
router.post('/batch/:batchId/cancel', authenticate, controller.cancelBatch.bind(controller));

// Download sample CSV
router.get('/sample-csv', authenticate, controller.downloadSample.bind(controller));

// Export results
router.get('/batch/:batchId/export', authenticate, controller.exportResults.bind(controller));

module.exports = router;
