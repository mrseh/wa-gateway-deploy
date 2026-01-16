/**
 * Subscription Service
 * Manages subscription lifecycle, expiry, and renewals
 */

const db = require('../config/database');
const { Op } = require('sequelize');

class SubscriptionService {
  /**
   * Create subscription
   */
  async createSubscription(userId, packageId, transactionId = null) {
    try {
      const subscription = await db.Subscription.create({
        user_id: userId,
        package_id: packageId,
        transaction_id: transactionId,
        status: 'pending',
      });

      return subscription;
    } catch (error) {
      console.error('Create subscription error:', error.message);
      throw error;
    }
  }

  /**
   * Activate subscription
   */
  async activateSubscription(subscriptionId, durationDays = null) {
    try {
      const subscription = await db.Subscription.findByPk(subscriptionId, {
        include: [{ model: db.Package, as: 'package' }],
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const duration = durationDays || subscription.package.duration_days;
      await subscription.activate(new Date(), duration);

      console.log(`Subscription ${subscriptionId} activated`);

      return subscription;
    } catch (error) {
      console.error('Activate subscription error:', error.message);
      throw error;
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(subscriptionId, durationDays = null) {
    try {
      const subscription = await db.Subscription.findByPk(subscriptionId, {
        include: [{ model: db.Package, as: 'package' }],
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const duration = durationDays || subscription.package.duration_days;
      await subscription.renew(duration);

      console.log(`Subscription ${subscriptionId} renewed`);

      return subscription;
    } catch (error) {
      console.error('Renew subscription error:', error.message);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, reason = null) {
    try {
      const subscription = await db.Subscription.findByPk(subscriptionId);

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await subscription.cancel(reason);

      console.log(`Subscription ${subscriptionId} cancelled`);

      return subscription;
    } catch (error) {
      console.error('Cancel subscription error:', error.message);
      throw error;
    }
  }

  /**
   * Check expiring subscriptions
   */
  async checkExpiry() {
    try {
      const results = {
        expiring_soon: [],
        expired: [],
        grace_period_ended: [],
      };

      // Check subscriptions expiring in 7 days
      const expiringSoon7 = await db.Subscription.getExpiringSoon(7);
      for (const subscription of expiringSoon7) {
        const daysRemaining = subscription.getDaysRemaining();
        
        if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
          await this.sendExpiryNotification(subscription, daysRemaining);
          results.expiring_soon.push({
            subscription_id: subscription.id,
            days_remaining: daysRemaining,
          });
        }
      }

      // Check expired subscriptions
      const expired = await db.Subscription.getExpired();
      for (const subscription of expired) {
        await this.handleExpiredSubscription(subscription);
        results.expired.push(subscription.id);
      }

      // Check grace period ended
      const gracePeriodEnded = await db.Subscription.getGracePeriodEnded();
      for (const subscription of gracePeriodEnded) {
        await this.suspendServices(subscription);
        results.grace_period_ended.push(subscription.id);
      }

      console.log('Expiry check completed:', results);

      return results;
    } catch (error) {
      console.error('Check expiry error:', error.message);
      throw error;
    }
  }

  /**
   * Send expiry notification
   */
  async sendExpiryNotification(subscription, daysRemaining) {
    try {
      const user = await db.User.findByPk(subscription.user_id);
      const packageData = await db.Package.findByPk(subscription.package_id);

      console.log(`Sending expiry notification to ${user.email}: ${daysRemaining} days remaining`);

      // TODO: Implement email sending
      // await emailService.send({
      //   to: user.email,
      //   template: `subscription-expiring-${daysRemaining}days`,
      //   data: { user, subscription, package: packageData, daysRemaining },
      // });
    } catch (error) {
      console.error('Send expiry notification error:', error.message);
    }
  }

  /**
   * Handle expired subscription
   */
  async handleExpiredSubscription(subscription) {
    try {
      // Apply grace period (7 days)
      await subscription.expire(7);

      // Send expiry notification
      const user = await db.User.findByPk(subscription.user_id);
      console.log(`Subscription expired for user ${user.email}, grace period applied`);

      // TODO: Send email
      // await emailService.send({
      //   to: user.email,
      //   template: 'subscription-expired',
      //   data: { user, subscription },
      // });
    } catch (error) {
      console.error('Handle expired subscription error:', error.message);
    }
  }

  /**
   * Suspend services for subscription
   */
  async suspendServices(subscription) {
    try {
      // Suspend subscription
      await subscription.suspend();

      // Suspend all user instances
      const instances = await db.Instance.findAll({
        where: { user_id: subscription.user_id },
      });

      for (const instance of instances) {
        if (instance.status !== 'suspended') {
          await instance.update({ status: 'suspended' });
        }
      }

      const user = await db.User.findByPk(subscription.user_id);
      console.log(`Services suspended for user ${user.email}`);

      // TODO: Send notification
      // await emailService.send({
      //   to: user.email,
      //   template: 'services-suspended',
      //   data: { user, subscription },
      // });
    } catch (error) {
      console.error('Suspend services error:', error.message);
    }
  }

  /**
   * Reactivate services for subscription
   */
  async reactivateServices(subscription) {
    try {
      // Reactivate subscription
      await subscription.reactivate();

      // Reactivate user instances
      const instances = await db.Instance.findAll({
        where: {
          user_id: subscription.user_id,
          status: 'suspended',
        },
      });

      for (const instance of instances) {
        // Only reactivate if they were previously connected
        await instance.update({ status: 'disconnected' });
      }

      console.log(`Services reactivated for subscription ${subscription.id}`);
    } catch (error) {
      console.error('Reactivate services error:', error.message);
    }
  }

  /**
   * Get user quota
   */
  async getUserQuota(userId) {
    try {
      const subscription = await db.Subscription.getUserActiveSubscription(userId);

      if (!subscription) {
        // Return trial/default quota
        return {
          max_instances: 1,
          max_messages_per_day: 50,
          max_messages_per_month: 350,
          max_olts: 0,
        };
      }

      return subscription.package.features;
    } catch (error) {
      console.error('Get user quota error:', error.message);
      throw error;
    }
  }

  /**
   * Check if user can perform action
   */
  async canPerformAction(userId, action, count = 1) {
    try {
      const subscription = await db.Subscription.getUserActiveSubscription(userId);

      if (!subscription) {
        return false;
      }

      const features = subscription.package.features;

      switch (action) {
        case 'create_instance':
          const instanceCount = await db.Instance.count({
            where: { user_id: userId },
          });
          return instanceCount + count <= features.max_instances;

        case 'send_message':
          // Check daily quota
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const messagesToday = await db.MessageLog.count({
            where: {
              user_id: userId,
              direction: 'outbound',
              created_at: {
                [Op.gte]: today,
              },
            },
          });
          
          return messagesToday + count <= features.max_messages_per_day;

        case 'add_olt':
          const oltCount = await db.OLT.count({
            where: { user_id: userId },
          });
          return oltCount + count <= features.max_olts;

        case 'api_access':
          return features.has_api_access;

        case 'bulk_messaging':
          return features.has_bulk_messaging;

        case 'analytics':
          return features.has_analytics;

        case 'olt_monitoring':
          return features.has_olt_monitoring;

        default:
          return false;
      }
    } catch (error) {
      console.error('Can perform action error:', error.message);
      return false;
    }
  }

  /**
   * Get subscription statistics
   */
  async getStatistics() {
    try {
      const stats = await db.Subscription.getStatistics();
      
      // Get revenue statistics
      const revenue = await db.Transaction.getStatistics();
      
      return {
        subscriptions: stats,
        revenue,
      };
    } catch (error) {
      console.error('Get statistics error:', error.message);
      throw error;
    }
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(subscriptionId, newPackageId) {
    try {
      const subscription = await db.Subscription.findByPk(subscriptionId, {
        include: [{ model: db.Package, as: 'package' }],
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const newPackage = await db.Package.findByPk(newPackageId);
      if (!newPackage) {
        throw new Error('New package not found');
      }

      // Calculate prorated amount
      const daysRemaining = subscription.getDaysRemaining();
      const oldPrice = parseFloat(subscription.package.price);
      const newPrice = parseFloat(newPackage.price);
      
      // Prorated refund from old package
      const dailyOldPrice = oldPrice / subscription.package.duration_days;
      const refundAmount = dailyOldPrice * daysRemaining;
      
      // New package cost
      const dailyNewPrice = newPrice / newPackage.duration_days;
      const upgradeAmount = dailyNewPrice * daysRemaining;
      
      const proratedAmount = upgradeAmount - refundAmount;

      // Update subscription package
      await subscription.update({
        package_id: newPackageId,
      });

      console.log(`Subscription ${subscriptionId} upgraded to ${newPackage.name}`);

      return {
        subscription,
        prorated_amount: proratedAmount,
      };
    } catch (error) {
      console.error('Upgrade subscription error:', error.message);
      throw error;
    }
  }

  /**
   * Downgrade subscription
   */
  async downgradeSubscription(subscriptionId, newPackageId) {
    try {
      const subscription = await db.Subscription.findByPk(subscriptionId);

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const newPackage = await db.Package.findByPk(newPackageId);
      if (!newPackage) {
        throw new Error('New package not found');
      }

      // Schedule downgrade for next renewal
      await subscription.update({
        metadata: {
          ...subscription.metadata,
          scheduled_downgrade: newPackageId,
        },
      });

      console.log(`Downgrade scheduled for subscription ${subscriptionId}`);

      return subscription;
    } catch (error) {
      console.error('Downgrade subscription error:', error.message);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();
