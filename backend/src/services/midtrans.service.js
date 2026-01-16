/**
 * Midtrans Service
 * Handles Midtrans Snap API integration for payments
 */

const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');

class MidtransService {
  constructor() {
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.serverKey = process.env.MIDTRANS_SERVER_KEY;
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY;
    
    // Base URLs
    this.snapUrl = this.isProduction
      ? 'https://app.midtrans.com/snap/v1'
      : 'https://app.sandbox.midtrans.com/snap/v1';
    
    this.apiUrl = this.isProduction
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
    
    // Authorization header
    this.authHeader = Buffer.from(this.serverKey + ':').toString('base64');
  }

  /**
   * Create Snap transaction
   */
  async createTransaction(userId, packageId, durationMonths = 1, discountCode = null) {
    try {
      // Get user and package
      const user = await db.User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const packageData = await db.Package.findByPk(packageId);
      if (!packageData) {
        throw new Error('Package not found');
      }

      if (!packageData.is_active) {
        throw new Error('Package is not active');
      }

      // Calculate amount
      let amount = parseFloat(packageData.price) * durationMonths;
      let discountAmount = 0;

      // Apply discount if provided
      if (discountCode) {
        // TODO: Implement discount code logic
        // For now, just placeholder
        discountAmount = 0;
      }

      const finalAmount = amount - discountAmount;

      // Create transaction record
      const transaction = await db.Transaction.create({
        user_id: userId,
        package_id: packageId,
        amount: finalAmount,
        currency: 'IDR',
        status: 'pending',
        duration_months: durationMonths,
        discount_amount: discountAmount,
        discount_code: discountCode,
      });

      // Prepare Midtrans transaction parameters
      const transactionParams = {
        transaction_details: {
          order_id: transaction.midtrans_order_id,
          gross_amount: Math.round(finalAmount),
        },
        customer_details: {
          first_name: user.name.split(' ')[0],
          last_name: user.name.split(' ').slice(1).join(' ') || user.name,
          email: user.email,
          phone: user.phone || '',
        },
        item_details: [
          {
            id: packageData.id,
            name: packageData.name,
            price: Math.round(parseFloat(packageData.price)),
            quantity: durationMonths,
          },
        ],
        callbacks: {
          finish: `${process.env.APP_URL}/subscription/payment-success`,
          error: `${process.env.APP_URL}/subscription/payment-error`,
          pending: `${process.env.APP_URL}/subscription/payment-pending`,
        },
        expiry: {
          start_time: new Date().toISOString().split('.')[0] + ' +0700',
          unit: 'hours',
          duration: 24,
        },
      };

      // Call Midtrans Snap API
      const response = await axios.post(
        `${this.snapUrl}/transactions`,
        transactionParams,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${this.authHeader}`,
          },
        }
      );

      // Update transaction with Midtrans response
      await transaction.update({
        midtrans_token: response.data.token,
        midtrans_payment_url: response.data.redirect_url,
        midtrans_response: response.data,
      });

      return {
        transaction_id: transaction.id,
        invoice_number: transaction.invoice_number,
        amount: finalAmount,
        snap_token: response.data.token,
        redirect_url: response.data.redirect_url,
      };
    } catch (error) {
      console.error('Midtrans create transaction error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Handle Midtrans notification webhook
   */
  async handleNotification(notification) {
    try {
      // Verify signature
      const isValid = this.verifySignature(notification);
      if (!isValid) {
        throw new Error('Invalid signature');
      }

      const orderId = notification.order_id;
      const transactionStatus = notification.transaction_status;
      const fraudStatus = notification.fraud_status;

      // Get transaction
      const transaction = await db.Transaction.getByMidtransOrderId(orderId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      console.log(`Processing notification for ${orderId}: ${transactionStatus}`);

      // Update transaction based on status
      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          // Payment captured and accepted
          await this.handlePaymentSuccess(transaction, notification);
        } else if (fraudStatus === 'challenge') {
          // Payment needs review
          await transaction.update({
            status: 'processing',
            midtrans_response: notification,
          });
        }
      } else if (transactionStatus === 'settlement') {
        // Payment settled
        await this.handlePaymentSuccess(transaction, notification);
      } else if (transactionStatus === 'pending') {
        // Payment pending
        await transaction.update({
          status: 'pending',
          midtrans_response: notification,
        });
      } else if (
        transactionStatus === 'deny' ||
        transactionStatus === 'expire' ||
        transactionStatus === 'cancel'
      ) {
        // Payment failed
        await this.handlePaymentFailure(transaction, notification);
      }

      return { success: true, transaction };
    } catch (error) {
      console.error('Handle notification error:', error.message);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(transaction, notification) {
    try {
      // Mark transaction as paid
      await transaction.markAsPaid({
        payment_method: notification.payment_type,
        payment_channel: notification.bank || notification.payment_type,
        transaction_id: notification.transaction_id,
        midtrans_response: notification,
      });

      // Get or create subscription
      let subscription = await db.Subscription.findOne({
        where: { transaction_id: transaction.id },
      });

      if (!subscription) {
        // Create new subscription
        subscription = await db.Subscription.create({
          user_id: transaction.user_id,
          package_id: transaction.package_id,
          transaction_id: transaction.id,
          status: 'pending',
        });
      }

      // Get package for duration
      const packageData = await db.Package.findByPk(transaction.package_id);
      const durationDays = packageData.duration_days * transaction.duration_months;

      // Activate subscription
      await subscription.activate(new Date(), durationDays);

      // Send confirmation email
      await this.sendPaymentConfirmation(transaction);

      console.log(`Payment successful for transaction ${transaction.invoice_number}`);

      return subscription;
    } catch (error) {
      console.error('Handle payment success error:', error.message);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(transaction, notification) {
    try {
      let status = 'failed';
      let reason = notification.status_message;

      if (notification.transaction_status === 'expire') {
        status = 'expired';
        reason = 'Payment expired';
      } else if (notification.transaction_status === 'cancel') {
        status = 'cancelled';
        reason = 'Payment cancelled';
      }

      await transaction.update({
        status,
        failure_reason: reason,
        failed_at: new Date(),
        midtrans_response: notification,
      });

      // Send failure notification
      await this.sendPaymentFailure(transaction, reason);

      console.log(`Payment ${status} for transaction ${transaction.invoice_number}`);
    } catch (error) {
      console.error('Handle payment failure error:', error.message);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId) {
    try {
      const transaction = await db.Transaction.findByPk(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const response = await axios.get(
        `${this.apiUrl}/${transaction.midtrans_order_id}/status`,
        {
          headers: {
            'Authorization': `Basic ${this.authHeader}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Check payment status error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(transactionId) {
    try {
      const transaction = await db.Transaction.findByPk(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.isPaid()) {
        throw new Error('Cannot cancel paid transaction');
      }

      const response = await axios.post(
        `${this.apiUrl}/${transaction.midtrans_order_id}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Basic ${this.authHeader}`,
          },
        }
      );

      await transaction.cancel();

      return response.data;
    } catch (error) {
      console.error('Cancel transaction error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Refund transaction
   */
  async refundTransaction(transactionId, amount = null, reason = null) {
    try {
      const transaction = await db.Transaction.findByPk(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!transaction.isPaid()) {
        throw new Error('Cannot refund unpaid transaction');
      }

      const refundAmount = amount || transaction.amount;

      const response = await axios.post(
        `${this.apiUrl}/${transaction.midtrans_order_id}/refund`,
        {
          refund_key: `refund-${Date.now()}`,
          amount: Math.round(parseFloat(refundAmount)),
          reason: reason || 'Refund requested',
        },
        {
          headers: {
            'Authorization': `Basic ${this.authHeader}`,
          },
        }
      );

      await transaction.refund(refundAmount, reason);

      return response.data;
    } catch (error) {
      console.error('Refund transaction error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verify notification signature
   */
  verifySignature(notification) {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
    } = notification;

    const signatureString = `${order_id}${status_code}${gross_amount}${this.serverKey}`;
    const hash = crypto
      .createHash('sha512')
      .update(signatureString)
      .digest('hex');

    return hash === signature_key;
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(transaction) {
    try {
      const user = await db.User.findByPk(transaction.user_id);
      const packageData = await db.Package.findByPk(transaction.package_id);

      // TODO: Implement email sending
      console.log(`Sending payment confirmation to ${user.email}`);
      
      // This would use your email service
      // await emailService.send({
      //   to: user.email,
      //   template: 'payment-received',
      //   data: { user, transaction, package: packageData },
      // });
    } catch (error) {
      console.error('Send payment confirmation error:', error.message);
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailure(transaction, reason) {
    try {
      const user = await db.User.findByPk(transaction.user_id);

      console.log(`Sending payment failure notification to ${user.email}`);
      
      // TODO: Implement email sending
      // await emailService.send({
      //   to: user.email,
      //   template: 'payment-failed',
      //   data: { user, transaction, reason },
      // });
    } catch (error) {
      console.error('Send payment failure error:', error.message);
    }
  }
}

module.exports = new MidtransService();
