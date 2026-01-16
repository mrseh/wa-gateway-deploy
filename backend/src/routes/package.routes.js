/**
 * Package Routes
 */

const express = require('express');
const router = express.Router();
const packageController = require('../controllers/package.controller');
const { authenticate, isAdmin } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const packageValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration_days').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('features').isObject().withMessage('Features must be an object'),
];

/**
 * Public routes
 */

// Get all active packages
router.get('/', packageController.getPackages);

// Get single package
router.get('/:id', packageController.getPackage);

// Calculate price with discount
router.post('/:id/calculate-price', packageController.calculatePrice);

/**
 * Admin routes
 */

// Create package
router.post(
  '/',
  authenticate,
  isAdmin,
  packageValidation,
  packageController.createPackage
);

// Update package
router.put(
  '/:id',
  authenticate,
  isAdmin,
  packageValidation,
  packageController.updatePackage
);

// Delete package
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  packageController.deletePackage
);

// Get package statistics
router.get(
  '/:id/statistics',
  authenticate,
  isAdmin,
  packageController.getPackageStatistics
);

module.exports = router;
