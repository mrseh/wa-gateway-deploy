const express = require('express');
const router = express.Router();
const zabbixController = require('../controllers/zabbix.controller');
const { authenticate } = require('../middleware/auth');

// Public webhook (no auth)
router.post('/zabbix/:token', zabbixController.handleWebhook);

// Protected routes
router.get('/zabbix/events', authenticate, zabbixController.getZabbixEvents);
router.get('/zabbix/config', authenticate, zabbixController.getMediaTypeConfig);

module.exports = router;
