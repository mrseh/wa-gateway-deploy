/**
 * Subscription Controller
 * Handles user subscription management
 */

const db = require('../config/database');
const subscriptionService = require('../services/subscription.service');
const midtransService = require('../services/midtrans.service');
const { validationResult } = require('express-validator');

class SubscriptionController {
  /**
   * Subscribe to a package
   * POST /api/v1/subscriptions/subscribe
   */
  async subscribe(req, res) {
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

      const userId = req.user.id;
      const { package_id, duration_months, discount_code } = req.body;

      // Check if package exists
      const packageData = await db.Package.findByPk(package_id);
      if (!packageData) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Package not found',
          },
        });
      }

      if (!packageData.is_active) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Package is not active',
          },
        });
      }

      // Check existing active subscription
      const existingSubscription = await db.Subscription.getUserActiveSubscription(userId);
      
      if (existingSubscription && !existingSubscription.isExpired()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'You already have an active subscription',
            details: 'Please cancel or wait for current subscription to expire',
          },
        });
      }

      // Create Midtrans transaction
      const payment = await midtransService.createTransaction(
        userId,
        package_id,
        duration_months || 1,
        discount_code
      );

      res.status(201).json({
        success: true,
        data: {
          transaction_id: payment.transaction_id,
          invoice_number: payment.invoice_number,
          amount: payment.amount,
          snap_token: payment.snap_token,
          redirect_url: payment.redirect_url,
        },
        message: 'Payment initiated. Please complete payment.',
      });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get current user subscription
   * GET /api/v1/subscriptions/my-subscription
   */
  async getMySubscription(req, res) {
    try {
      const userId = req.user.id;

      const subscription = await db.Subscription.getUserLatestSubscription(userId);

      if (!subscription) {
        return res.json({
          success: true,
          data: null,
          message: 'No subscription found',
        });
      }

      res.json({
        success: true,
        data: subscription.toSafeObject(),
      });
    } catch (error) {
      console.error('Get my subscription error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get subscription details
   * GET /api/v1/subscriptions/:id
   */
  async getSubscription(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const subscription = await db.Subscription.findOne({
        where: { id, user_id: userId },
        include: [
          {
            model: db.Package,
            as: 'package',
          },
          {
            model: db.Transaction,
            as: 'transaction',
          },
        ],
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Subscription not found',
          },
        });
      }

      res.json({
        success: true,
        data: subscription.toSafeObject(),
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Renew subscription
   * POST /api/v1/subscriptions/:id/renew
   */
  async renewSubscription(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { duration_months, discount_code } = req.body;

      const subscription = await db.Subscription.findOne({
        where: { id, user_id: userId },
        include: [{ model: db.Package, as: 'package' }],
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Subscription not found',
          },
        });
      }

      // Create renewal payment
      const payment = await midtransService.createTransaction(
        userId,
        subscription.package_id,
        duration_months || 1,
        discount_code
      );

      res.json({
        success: true,
        data: {
          transaction_id: payment.transaction_id,
          invoice_number: payment.invoice_number,
          amount: payment.amount,
          snap_token: payment.snap_token,
          redirect_url: payment.redirect_url,
        },
        message: 'Renewal payment initiated',
      });
    } catch (error) {
      console.error('Renew subscription error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to renew subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Cancel subscription
   * POST /api/v1/subscriptions/:id/cancel
   */
  async cancelSubscription(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      const subscription = await db.Subscription.findOne({
        where: { id, user_id: userId },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Subscription not found',
          },
        });
      }

      if (subscription.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Subscription is already cancelled',
          },
        });
      }

      await subscriptionService.cancelSubscription(id, reason);

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
      });
    } catch (error) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to cancel subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get subscription usage/quota
   * GET /api/v1/subscriptions/quota
   */
  async getQuota(req, res) {
    try {
      const userId = req.user.id;

      // Get subscription quota
      const quota = await subscriptionService.getUserQuota(userId);

      // Get current usage
      const instanceCount = await db.Instance.count({
        where: { user_id: userId },
      });

      const oltCount = await db.OLT.count({
        where: { user_id: userId },
      });

      // Get today's message count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const messagesToday = await db.MessageLog.count({
        where: {
          user_id: userId,
          direction: 'outbound',
          created_at: {
            [db.Sequelize.Op.gte]: today,
          },
        },
      });

      // Get this month's message count
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const messagesThisMonth = await db.MessageLog.count({
        where: {
          user_id: userId,
          direction: 'outbound',
          created_at: {
            [db.Sequelize.Op.gte]: startOfMonth,
          },
        },
      });

      res.json({
        success: true,
        data: {
          quota,
          usage: {
            instances: instanceCount,
            olts: oltCount,
            messages_today: messagesToday,
            messages_this_month: messagesThisMonth,
          },
          remaining: {
            instances: Math.max(0, quota.max_instances - instanceCount),
            olts: Math.max(0, quota.max_olts - oltCount),
            messages_today: Math.max(0, quota.max_messages_per_day - messagesToday),
            messages_this_month: Math.max(0, quota.max_messages_per_month - messagesThisMonth),
          },
          percentage: {
            instances: quota.max_instances > 0 ? (instanceCount / quota.max_instances * 100).toFixed(1) : 0,
            messages_today: quota.max_messages_per_day > 0 ? (messagesToday / quota.max_messages_per_day * 100).toFixed(1) : 0,
            messages_this_month: quota.max_messages_per_month > 0 ? (messagesThisMonth / quota.max_messages_per_month * 100).toFixed(1) : 0,
          },
        },
      });
    } catch (error) {
      console.error('Get quota error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch quota',
          details: error.message,
        },
      });
    }
  }

  /**
   * Upgrade subscription
   * POST /api/v1/subscriptions/:id/upgrade
   */
  async upgradeSubscription(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { package_id } = req.body;

      const subscription = await db.Subscription.findOne({
        where: { id, user_id: userId },
        include: [{ model: db.Package, as: 'package' }],
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Subscription not found',
          },
        });
      }

      if (!subscription.isActive()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot upgrade inactive subscription',
          },
        });
      }

      const newPackage = await db.Package.findByPk(package_id);
      if (!newPackage) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'New package not found',
          },
        });
      }

      // Check if it's actually an upgrade
      if (parseFloat(newPackage.price) <= parseFloat(subscription.package.price)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'New package must have higher price',
          },
        });
      }

      const result = await subscriptionService.upgradeSubscription(id, package_id);

      res.json({
        success: true,
        data: {
          subscription: result.subscription.toSafeObject(),
          prorated_amount: result.prorated_amount,
        },
        message: 'Subscription upgraded successfully',
      });
    } catch (error) {
      console.error('Upgrade subscription error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to upgrade subscription',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get user invoices/transactions
   * GET /api/v1/subscriptions/invoices
   */
  async getInvoices(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10, offset = 0 } = req.query;

      const result = await db.Transaction.getUserTransactions(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      const transactions = result.rows.map(t => t.toSafeObject());

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            total: result.count,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: result.count > parseInt(offset) + parseInt(limit),
          },
        },
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch invoices',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get subscription history
   * GET /api/v1/subscriptions/history
   */
  async getHistory(req, res) {
    try {
      const userId = req.user.id;

      const subscriptions = await db.Subscription.findAll({
        where: { user_id: userId },
        include: [
          {
            model: db.Package,
            as: 'package',
          },
        ],
        order: [['created_at', 'DESC']],
      });

      const history = subscriptions.map(sub => sub.toSafeObject());

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch history',
          details: error.message,
        },
      });
    }
  }
}

module.exports = new SubscriptionController();
