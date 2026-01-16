/**
 * Subscription Checker Job
 * Checks for expiring and expired subscriptions
 * Runs daily at 3 AM
 */

const cron = require('node-cron');
const subscriptionService = require('../services/subscription.service');

class SubscriptionCheckerJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the cron job
   */
  start() {
    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      await this.run();
    });

    console.log('Subscription checker job started (runs daily at 3 AM)');
  }

  /**
   * Run the job manually
   */
  async run() {
    if (this.isRunning) {
      console.log('Subscription checker is already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('=== Starting subscription checker job ===');

      const results = await subscriptionService.checkExpiry();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('=== Subscription checker completed ===');
      console.log(`Duration: ${duration}s`);
      console.log(`Expiring soon (notified): ${results.expiring_soon.length}`);
      console.log(`Expired (grace period applied): ${results.expired.length}`);
      console.log(`Grace period ended (suspended): ${results.grace_period_ended.length}`);

    } catch (error) {
      console.error('Subscription checker job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run job immediately (for testing)
   */
  async runNow() {
    console.log('Running subscription checker immediately...');
    await this.run();
  }
}

module.exports = new SubscriptionCheckerJob();
