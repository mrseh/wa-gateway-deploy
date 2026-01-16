/**
 * Package Controller
 * Handles package/plan management endpoints
 */

const db = require('../config/database');
const { validationResult } = require('express-validator');

class PackageController {
  /**
   * Get all packages
   * GET /api/v1/packages
   */
  async getPackages(req, res) {
    try {
      const { include_inactive } = req.query;
      
      const whereClause = {};
      if (include_inactive !== 'true') {
        whereClause.is_active = true;
      }

      const packages = await db.Package.findAll({
        where: whereClause,
        order: [['sort_order', 'ASC'], ['price', 'ASC']],
      });

      const packagesData = packages.map(pkg => pkg.toSafeObject());

      res.json({
        success: true,
        data: packagesData,
      });
    } catch (error) {
      console.error('Get packages error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch packages',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get single package
   * GET /api/v1/packages/:id
   */
  async getPackage(req, res) {
    try {
      const { id } = req.params;

      const packageData = await db.Package.findByPk(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      res.json({
        success: true,
        data: packageData.toSafeObject(),
      });
    } catch (error) {
      console.error('Get package error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch package',
          details: error.message,
        },
      });
    }
  }

  /**
   * Create package (Admin only)
   * POST /api/v1/packages
   */
  async createPackage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: errors.array(),
          },
        });
      }

      const {
        name,
        description,
        price,
        duration_days,
        features,
        is_trial,
        sort_order,
      } = req.body;

      // Check if package with same name exists
      const existingPackage = await db.Package.findOne({
        where: { name },
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Package with this name already exists',
          },
        });
      }

      const packageData = await db.Package.create({
        name,
        description,
        price,
        duration_days,
        features,
        is_trial: is_trial || false,
        sort_order: sort_order || 0,
        is_active: true,
      });

      res.status(201).json({
        success: true,
        data: packageData.toSafeObject(),
        message: 'Package created successfully',
      });
    } catch (error) {
      console.error('Create package error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create package',
          details: error.message,
        },
      });
    }
  }

  /**
   * Update package (Admin only)
   * PUT /api/v1/packages/:id
   */
  async updatePackage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: errors.array(),
          },
        });
      }

      const { id } = req.params;
      const {
        name,
        description,
        price,
        duration_days,
        features,
        is_active,
        is_trial,
        sort_order,
      } = req.body;

      const packageData = await db.Package.findByPk(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      // Check if name is taken by another package
      if (name && name !== packageData.name) {
        const existingPackage = await db.Package.findOne({
          where: { name },
        });

        if (existingPackage) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Package name already in use',
            },
          });
        }
      }

      await packageData.update({
        name: name || packageData.name,
        description: description !== undefined ? description : packageData.description,
        price: price !== undefined ? price : packageData.price,
        duration_days: duration_days || packageData.duration_days,
        features: features || packageData.features,
        is_active: is_active !== undefined ? is_active : packageData.is_active,
        is_trial: is_trial !== undefined ? is_trial : packageData.is_trial,
        sort_order: sort_order !== undefined ? sort_order : packageData.sort_order,
      });

      res.json({
        success: true,
        data: packageData.toSafeObject(),
        message: 'Package updated successfully',
      });
    } catch (error) {
      console.error('Update package error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update package',
          details: error.message,
        },
      });
    }
  }

  /**
   * Delete package (Admin only)
   * DELETE /api/v1/packages/:id
   */
  async deletePackage(req, res) {
    try {
      const { id } = req.params;

      const packageData = await db.Package.findByPk(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      // Check if package has active subscriptions
      const activeSubscriptions = await db.Subscription.count({
        where: {
          package_id: id,
          status: 'active',
        },
      });

      if (activeSubscriptions > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot delete package with active subscriptions',
            details: `${activeSubscriptions} active subscriptions found`,
          },
        });
      }

      // Soft delete: just set inactive
      await packageData.update({ is_active: false });

      res.json({
        success: true,
        message: 'Package deactivated successfully',
      });
    } catch (error) {
      console.error('Delete package error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete package',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get package statistics (Admin only)
   * GET /api/v1/packages/:id/statistics
   */
  async getPackageStatistics(req, res) {
    try {
      const { id } = req.params;

      const packageData = await db.Package.findByPk(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      // Get subscription counts
      const totalSubscriptions = await db.Subscription.count({
        where: { package_id: id },
      });

      const activeSubscriptions = await db.Subscription.count({
        where: {
          package_id: id,
          status: 'active',
        },
      });

      // Get revenue
      const revenue = await db.Transaction.sum('amount', {
        where: {
          package_id: id,
          status: 'paid',
        },
      });

      res.json({
        success: true,
        data: {
          package: packageData.toSafeObject(),
          statistics: {
            total_subscriptions: totalSubscriptions,
            active_subscriptions: activeSubscriptions,
            total_revenue: parseFloat(revenue || 0),
          },
        },
      });
    } catch (error) {
      console.error('Get package statistics error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch statistics',
          details: error.message,
        },
      });
    }
  }

  /**
   * Calculate package price with discount
   * POST /api/v1/packages/:id/calculate-price
   */
  async calculatePrice(req, res) {
    try {
      const { id } = req.params;
      const { duration_months, discount_code } = req.body;

      const packageData = await db.Package.findByPk(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      const months = duration_months || 1;
      let discountPercent = 0;

      // Apply duration discount
      if (months >= 12) {
        discountPercent = 20; // 20% for yearly
      } else if (months >= 6) {
        discountPercent = 10; // 10% for 6 months
      } else if (months >= 3) {
        discountPercent = 5; // 5% for 3 months
      }

      // TODO: Apply discount code if provided

      const basePrice = parseFloat(packageData.price) * months;
      const discountAmount = (basePrice * discountPercent) / 100;
      const finalPrice = basePrice - discountAmount;

      res.json({
        success: true,
        data: {
          package_id: id,
          package_name: packageData.name,
          duration_months: months,
          base_price: basePrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          final_price: finalPrice,
          formatted_price: new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
          }).format(finalPrice),
        },
      });
    } catch (error) {
      console.error('Calculate price error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to calculate price',
          details: error.message,
        },
      });
    }
  }
}

module.exports = new PackageController();
