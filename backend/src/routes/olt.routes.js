const express = require('express');
const router = express.Router();
const oltController = require('../controllers/olt.controller');
const ponPortController = require('../controllers/ponPort.controller');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

// OLT routes
router.get('/', authenticate, oltController.getOLTs);
router.get('/:id', authenticate, oltController.getOLT);
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('vendor').trim().notEmpty().withMessage('Vendor is required'),
    body('ip_address').trim().isIP().withMessage('Valid IP address is required'),
    body('snmp_community').trim().notEmpty().withMessage('SNMP community is required'),
  ],
  oltController.addOLT
);
router.put('/:id', authenticate, oltController.updateOLT);
router.delete('/:id', authenticate, oltController.deleteOLT);
router.post('/:id/test', authenticate, oltController.testConnection);
router.post('/:id/discover-pon-ports', authenticate, oltController.discoverPONPorts);
router.post('/:id/discover-onus', authenticate, oltController.discoverONUs);

// PON Port routes
router.get('/pon-ports/:id', authenticate, ponPortController.getPONPort);
router.get('/pon-ports/:id/metrics', authenticate, ponPortController.getPONPortMetrics);
router.put('/pon-ports/:id/thresholds', authenticate, ponPortController.updatePONPortThresholds);
router.get('/pon-ports/:id/onus', authenticate, ponPortController.getPONPortONUs);

module.exports = router;
