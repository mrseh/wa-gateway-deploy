/**
 * Payment Checker Job
 * Checks for pending and expired payments
 * Runs every hour
 */

const cron = require('node-cron');
const db = require('../config/database');
const midtransService = require('../services/midtrans.service');

class PaymentCheckerJob {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start the cron job
   */
  start() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      await this.run();
    });

    console.log('Payment checker job started (runs hourly)');
  }

  /**
   * Run the job manually
   */
  async run() {
    if (this.isRunning) {
      console.log('Payment checker is already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('=== Starting payment checker job ===');

      const results = {
        checked: 0,
        updated: 0,
        expired: 0,
        cancelled: 0,
      };

      // Get expired transactions
      const expiredTransactions = await db.Transaction.getExpired();
      
      for (const transaction of expiredTransactions) {
        try {
          results.checked++;

          // Check status with Midtrans
          try {
            const midtransStatus = await midtransService.checkPaymentStatus(
              transaction.id
            );

            // Process status update
            await midtransService.handleNotification(midtransStatus);
            results.updated++;

          } catch (error) {
            // If check fails, mark as expired locally
            await transaction.markAsExpired();
            results.expired++;
          }

        } catch (error) {
          console.error(`Error processing transaction ${transaction.id}:`, error.message);
        }
      }

      // Get pending transactions older than 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const oldPendingTransactions = await db.Transaction.findAll({
        where: {
          status: {
            [db.Sequelize.Op.in]: ['pending', 'processing'],
          },
          created_at: {
            [db.Sequelize.Op.lt]: oneDayAgo,
          },
        },
      });

      // Auto-cancel old pending transactions
      for (const transaction of oldPendingTransactions) {
        try {
          if (!transaction.isExpired()) {
            // Try to cancel with Midtrans
            try {
              await midtransService.cancelTransaction(transaction.id);
            } catch (error) {
              console.error(`Failed to cancel with Midtrans: ${error.message}`);
            }

            // Cancel locally
            await transaction.cancel();
            results.cancelled++;
          }
        } catch (error) {
          console.error(`Error cancelling transaction ${transaction.id}:`, error.message);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('=== Payment checker completed ===');
      console.log(`Duration: ${duration}s`);
      console.log(`Transactions checked: ${results.checked}`);
      console.log(`Status updated: ${results.updated}`);
      console.log(`Marked as expired: ${results.expired}`);
      console.log(`Auto-cancelled: ${results.cancelled}`);

    } catch (error) {
      console.error('Payment checker job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run job immediately (for testing)
   */
  async runNow() {
    console.log('Running payment checker immediately...');
    await this.run();
  }

  /**
   * Check specific transaction
   */
  async checkTransaction(transactionId) {
    try {
      console.log(`Checking transaction ${transactionId}...`);

      const transaction = await db.Transaction.findByPk(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.isPaid()) {
        console.log('Transaction is already paid');
        return transaction;
      }

      // Check with Midtrans
      const midtransStatus = await midtransService.checkPaymentStatus(transactionId);
      
      // Process status
      await midtransService.handleNotification(midtransStatus);
      
      await transaction.reload();
      
      console.log(`Transaction ${transactionId} status: ${transaction.status}`);
      
      return transaction;

    } catch (error) {
      console.error('Check transaction error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentCheckerJob();
