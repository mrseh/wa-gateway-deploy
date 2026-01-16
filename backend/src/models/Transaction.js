/**
 * Transaction Model
 * Manages payment transactions with Midtrans integration
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    package_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'packages',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'IDR',
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled',
        'refunded',
        'expired'
      ),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'E.g., bank_transfer, credit_card, e-wallet',
    },
    payment_channel: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'E.g., bca, mandiri, gopay',
    },
    // Midtrans fields
    midtrans_order_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    midtrans_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    midtrans_payment_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Snap payment URL',
    },
    midtrans_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Snap token',
    },
    midtrans_redirect_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    midtrans_response: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Full Midtrans response',
    },
    // Payment details
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Payment expiry time',
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refunded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    refund_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Additional info
    duration_months: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discount_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['package_id'] },
      { fields: ['invoice_number'], unique: true },
      { fields: ['midtrans_order_id'], unique: true },
      { fields: ['status'] },
      { fields: ['paid_at'] },
      { fields: ['created_at'] },
    ],
  });

  /**
   * Model associations
   */
  Transaction.associate = (models) => {
    Transaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    Transaction.belongsTo(models.Package, {
      foreignKey: 'package_id',
      as: 'package',
    });

    Transaction.hasOne(models.Subscription, {
      foreignKey: 'transaction_id',
      as: 'subscription',
    });
  };

  /**
   * Hooks
   */
  Transaction.beforeCreate(async (transaction) => {
    if (!transaction.invoice_number) {
      transaction.invoice_number = await Transaction.generateInvoiceNumber();
    }
    
    if (!transaction.midtrans_order_id) {
      transaction.midtrans_order_id = `ORDER-${transaction.id}-${Date.now()}`;
    }
    
    // Set default expiry (24 hours)
    if (!transaction.expires_at) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 24);
      transaction.expires_at = expiryDate;
    }
  });

  /**
   * Instance Methods
   */

  /**
   * Check if transaction is paid
   */
  Transaction.prototype.isPaid = function() {
    return this.status === 'paid' && this.paid_at !== null;
  };

  /**
   * Check if transaction is pending
   */
  Transaction.prototype.isPending = function() {
    return this.status === 'pending' || this.status === 'processing';
  };

  /**
   * Check if transaction is expired
   */
  Transaction.prototype.isExpired = function() {
    if (this.status === 'expired') return true;
    
    if (this.expires_at) {
      return new Date() > new Date(this.expires_at);
    }
    
    return false;
  };

  /**
   * Mark as paid
   */
  Transaction.prototype.markAsPaid = async function(paymentData = {}) {
    this.status = 'paid';
    this.paid_at = new Date();
    this.payment_method = paymentData.payment_method || this.payment_method;
    this.payment_channel = paymentData.payment_channel || this.payment_channel;
    this.midtrans_transaction_id = paymentData.transaction_id || this.midtrans_transaction_id;
    
    if (paymentData.midtrans_response) {
      this.midtrans_response = {
        ...this.midtrans_response,
        ...paymentData.midtrans_response,
      };
    }
    
    await this.save();
    return this;
  };

  /**
   * Mark as failed
   */
  Transaction.prototype.markAsFailed = async function(reason = null) {
    this.status = 'failed';
    this.failed_at = new Date();
    this.failure_reason = reason;
    
    await this.save();
    return this;
  };

  /**
   * Mark as expired
   */
  Transaction.prototype.markAsExpired = async function() {
    this.status = 'expired';
    await this.save();
    return this;
  };

  /**
   * Cancel transaction
   */
  Transaction.prototype.cancel = async function() {
    this.status = 'cancelled';
    await this.save();
    return this;
  };

  /**
   * Process refund
   */
  Transaction.prototype.refund = async function(amount = null, reason = null) {
    this.status = 'refunded';
    this.refunded_at = new Date();
    this.refund_amount = amount || this.amount;
    this.refund_reason = reason;
    
    await this.save();
    return this;
  };

  /**
   * Get formatted amount
   */
  Transaction.prototype.getFormattedAmount = function() {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount);
  };

  /**
   * Get safe object
   */
  Transaction.prototype.toSafeObject = function() {
    return {
      id: this.id,
      user_id: this.user_id,
      package_id: this.package_id,
      invoice_number: this.invoice_number,
      amount: parseFloat(this.amount),
      formatted_amount: this.getFormattedAmount(),
      currency: this.currency,
      status: this.status,
      payment_method: this.payment_method,
      payment_channel: this.payment_channel,
      midtrans_payment_url: this.midtrans_payment_url,
      midtrans_token: this.midtrans_token,
      paid_at: this.paid_at,
      expires_at: this.expires_at,
      duration_months: this.duration_months,
      discount_amount: parseFloat(this.discount_amount),
      discount_code: this.discount_code,
      is_paid: this.isPaid(),
      is_pending: this.isPending(),
      is_expired: this.isExpired(),
      package: this.package ? this.package.toSafeObject() : null,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  };

  /**
   * Class Methods
   */

  /**
   * Generate invoice number
   */
  Transaction.generateInvoiceNumber = async function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count transactions today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await Transaction.count({
      where: {
        created_at: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay],
        },
      },
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    
    return `INV-${year}${month}${day}-${sequence}`;
  };

  /**
   * Get by invoice number
   */
  Transaction.getByInvoice = async function(invoiceNumber) {
    return await Transaction.findOne({
      where: { invoice_number: invoiceNumber },
      include: [
        {
          model: sequelize.models.User,
          as: 'user',
        },
        {
          model: sequelize.models.Package,
          as: 'package',
        },
      ],
    });
  };

  /**
   * Get by Midtrans order ID
   */
  Transaction.getByMidtransOrderId = async function(orderId) {
    return await Transaction.findOne({
      where: { midtrans_order_id: orderId },
      include: [
        {
          model: sequelize.models.User,
          as: 'user',
        },
        {
          model: sequelize.models.Package,
          as: 'package',
        },
      ],
    });
  };

  /**
   * Get user transactions
   */
  Transaction.getUserTransactions = async function(userId, limit = 10, offset = 0) {
    return await Transaction.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: sequelize.models.Package,
          as: 'package',
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
  };

  /**
   * Get pending transactions
   */
  Transaction.getPending = async function() {
    return await Transaction.findAll({
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['pending', 'processing'],
        },
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'user',
        },
      ],
    });
  };

  /**
   * Get expired transactions
   */
  Transaction.getExpired = async function() {
    const now = new Date();
    
    return await Transaction.findAll({
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['pending', 'processing'],
        },
        expires_at: {
          [sequelize.Sequelize.Op.lt]: now,
        },
      },
    });
  };

  /**
   * Get statistics
   */
  Transaction.getStatistics = async function(startDate = null, endDate = null) {
    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.created_at = {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      };
    }
    
    const stats = await Transaction.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      ],
      where: whereClause,
      group: ['status'],
    });

    const result = {
      total_transactions: 0,
      total_revenue: 0,
      paid: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    stats.forEach(stat => {
      const count = parseInt(stat.getDataValue('count'));
      const amount = parseFloat(stat.getDataValue('total_amount') || 0);
      
      result.total_transactions += count;
      
      if (stat.status === 'paid') {
        result.total_revenue += amount;
        result.paid = { count, amount };
      } else if (stat.status in result) {
        result[stat.status] = { count, amount };
      }
    });

    return result;
  };

  return Transaction;
};
