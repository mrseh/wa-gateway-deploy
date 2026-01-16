/**
 * Payment Controller
 * Handles payment operations and Midtrans webhooks
 */

const midtransService = require('../services/midtrans.service');
const db = require('../config/database');

class PaymentController {
  /**
   * Handle Midtrans notification webhook
   * POST /api/v1/payments/midtrans/notification
   */
  async handleMidtransWebhook(req, res) {
    try {
      const notification = req.body;

      console.log('Midtrans webhook received:', {
        order_id: notification.order_id,
        transaction_status: notification.transaction_status,
        fraud_status: notification.fraud_status,
      });

      // Process notification
      const result = await midtransService.handleNotification(notification);

      res.json({
        success: true,
        message: 'Notification processed',
      });
    } catch (error) {
      console.error('Midtrans webhook error:', error);
      
      // Still return 200 to Midtrans to prevent retry
      res.status(200).json({
        success: false,
        error: {
          message: 'Failed to process notification',
          details: error.message,
        },
      });
    }
  }

  /**
   * Check payment status
   * GET /api/v1/payments/:transactionId/status
   */
  async checkPaymentStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      // Get transaction
      const transaction = await db.Transaction.findOne({
        where: {
          id: transactionId,
          user_id: userId,
        },
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Transaction not found',
          },
        });
      }

      // Check with Midtrans if pending
      if (transaction.isPending()) {
        try {
          const midtransStatus = await midtransService.checkPaymentStatus(transactionId);
          
          // Process the status update
          await midtransService.handleNotification(midtransStatus);
          
          // Refresh transaction
          await transaction.reload();
        } catch (error) {
          console.error('Check Midtrans status error:', error.message);
          // Continue with current transaction status
        }
      }

      res.json({
        success: true,
        data: transaction.toSafeObject(),
      });
    } catch (error) {
      console.error('Check payment status error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to check payment status',
          details: error.message,
        },
      });
    }
  }

  /**
   * Cancel payment
   * POST /api/v1/payments/:transactionId/cancel
   */
  async cancelPayment(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await db.Transaction.findOne({
        where: {
          id: transactionId,
          user_id: userId,
        },
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Transaction not found',
          },
        });
      }

      if (transaction.isPaid()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot cancel paid transaction',
          },
        });
      }

      if (transaction.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Transaction is already cancelled',
          },
        });
      }

      // Cancel with Midtrans
      try {
        await midtransService.cancelTransaction(transactionId);
      } catch (error) {
        console.error('Midtrans cancel error:', error.message);
        // Continue with local cancellation
      }

      // Cancel locally
      await transaction.cancel();

      res.json({
        success: true,
        message: 'Payment cancelled successfully',
      });
    } catch (error) {
      console.error('Cancel payment error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to cancel payment',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get payment methods
   * GET /api/v1/payments/methods
   */
  async getPaymentMethods(req, res) {
    try {
      // Return available payment methods
      const methods = [
        {
          type: 'bank_transfer',
          name: 'Bank Transfer',
          channels: [
            { code: 'bca', name: 'BCA Virtual Account', logo: '/images/banks/bca.png' },
            { code: 'bni', name: 'BNI Virtual Account', logo: '/images/banks/bni.png' },
            { code: 'bri', name: 'BRI Virtual Account', logo: '/images/banks/bri.png' },
            { code: 'mandiri', name: 'Mandiri Virtual Account', logo: '/images/banks/mandiri.png' },
            { code: 'permata', name: 'Permata Virtual Account', logo: '/images/banks/permata.png' },
          ],
        },
        {
          type: 'e_wallet',
          name: 'E-Wallet',
          channels: [
            { code: 'gopay', name: 'GoPay', logo: '/images/wallets/gopay.png' },
            { code: 'shopeepay', name: 'ShopeePay', logo: '/images/wallets/shopeepay.png' },
            { code: 'qris', name: 'QRIS', logo: '/images/wallets/qris.png' },
          ],
        },
        {
          type: 'credit_card',
          name: 'Credit/Debit Card',
          channels: [
            { code: 'credit_card', name: 'Visa/Mastercard/JCB', logo: '/images/cards/visa.png' },
          ],
        },
        {
          type: 'convenience_store',
          name: 'Convenience Store',
          channels: [
            { code: 'indomaret', name: 'Indomaret', logo: '/images/stores/indomaret.png' },
            { code: 'alfamart', name: 'Alfamart', logo: '/images/stores/alfamart.png' },
          ],
        },
      ];

      res.json({
        success: true,
        data: methods,
      });
    } catch (error) {
      console.error('Get payment methods error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch payment methods',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get transaction by invoice
   * GET /api/v1/payments/invoice/:invoiceNumber
   */
  async getByInvoice(req, res) {
    try {
      const { invoiceNumber } = req.params;
      const userId = req.user.id;

      const transaction = await db.Transaction.findOne({
        where: {
          invoice_number: invoiceNumber,
          user_id: userId,
        },
        include: [
          {
            model: db.Package,
            as: 'package',
          },
        ],
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Invoice not found',
          },
        });
      }

      res.json({
        success: true,
        data: transaction.toSafeObject(),
      });
    } catch (error) {
      console.error('Get by invoice error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch invoice',
          details: error.message,
        },
      });
    }
  }

  /**
   * Request refund (Admin only)
   * POST /api/v1/payments/:transactionId/refund
   */
  async requestRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { amount, reason } = req.body;

      const transaction = await db.Transaction.findByPk(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Transaction not found',
          },
        });
      }

      if (!transaction.isPaid()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Can only refund paid transactions',
          },
        });
      }

      if (transaction.status === 'refunded') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Transaction is already refunded',
          },
        });
      }

      // Process refund with Midtrans
      const result = await midtransService.refundTransaction(
        transactionId,
        amount || null,
        reason
      );

      res.json({
        success: true,
        data: result,
        message: 'Refund processed successfully',
      });
    } catch (error) {
      console.error('Request refund error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to process refund',
          details: error.message,
        },
      });
    }
  }

  /**
   * Get payment statistics (Admin only)
   * GET /api/v1/payments/statistics
   */
  async getStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;

      const startDate = start_date ? new Date(start_date) : null;
      const endDate = end_date ? new Date(end_date) : null;

      const stats = await db.Transaction.getStatistics(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get statistics error:', error);
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
   * Retry failed payment
   * POST /api/v1/payments/:transactionId/retry
   */
  async retryPayment(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await db.Transaction.findOne({
        where: {
          id: transactionId,
          user_id: userId,
        },
        include: [
          {
            model: db.Package,
            as: 'package',
          },
        ],
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Transaction not found',
          },
        });
      }

      if (transaction.isPaid()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Transaction is already paid',
          },
        });
      }

      if (transaction.status !== 'failed' && transaction.status !== 'expired') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Can only retry failed or expired transactions',
          },
        });
      }

      // Create new transaction for retry
      const payment = await midtransService.createTransaction(
        userId,
        transaction.package_id,
        transaction.duration_months
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
        message: 'Retry payment initiated',
      });
    } catch (error) {
      console.error('Retry payment error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retry payment',
          details: error.message,
        },
      });
    }
  }
}

module.exports = new PaymentController();
