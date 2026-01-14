// Main routes file
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const instanceRoutes = require('./instanceRoutes');
const messageRoutes = require('./messageRoutes');
const oltRoutes = require('./oltRoutes');
const ponPortRoutes = require('./ponPortRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const webhookRoutes = require('./webhookRoutes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/instances', instanceRoutes);
router.use('/messages', messageRoutes);
router.use('/olts', oltRoutes);
router.use('/pon-ports', ponPortRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/webhook', webhookRoutes);

module.exports = router;
