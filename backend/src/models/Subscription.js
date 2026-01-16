/**
 * Subscription Model
 * Manages user subscriptions with status, expiry, and grace period
 */

const { DataTypes, Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
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
    transaction_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'expired', 'cancelled', 'suspended'),
      allowNull: false,
      defaultValue: 'pending',
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Auto-renew subscription',
    },
    grace_period_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Grace period end date',
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['package_id'] },
      { fields: ['transaction_id'] },
      { fields: ['status'] },
      { fields: ['end_date'] },
      { fields: ['auto_renew'] },
      { fields: ['grace_period_until'] },
    ],
  });

  /**
   * Model associations
   */
  Subscription.associate = (models) => {
    Subscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    Subscription.belongsTo(models.Package, {
      foreignKey: 'package_id',
      as: 'package',
    });

    Subscription.belongsTo(models.Transaction, {
      foreignKey: 'transaction_id',
      as: 'transaction',
    });
  };

  /**
   * Instance Methods
   */

  /**
   * Check if subscription is active
   */
  Subscription.prototype.isActive = function() {
    if (this.status !== 'active') return false;
    
    const now = new Date();
    return now <= new Date(this.end_date);
  };

  /**
   * Check if in grace period
   */
  Subscription.prototype.isInGracePeriod = function() {
    if (!this.grace_period_until) return false;
    
    const now = new Date();
    return now <= new Date(this.grace_period_until);
  };

  /**
   * Check if expired
   */
  Subscription.prototype.isExpired = function() {
    if (this.status === 'expired') return true;
    
    const now = new Date();
    if (this.end_date && now > new Date(this.end_date)) {
      if (this.isInGracePeriod()) {
        return false; // Still in grace period
      }
      return true;
    }
    return false;
  };

  /**
   * Get days remaining
   */
  Subscription.prototype.getDaysRemaining = function() {
    if (!this.end_date) return 0;
    
    const now = new Date();
    const end = new Date(this.end_date);
    const diff = end - now;
    
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  /**
   * Activate subscription
   */
  Subscription.prototype.activate = async function(startDate = null, durationDays = null) {
    const start = startDate || new Date();
    const duration = durationDays || this.package.duration_days;
    
    const end = new Date(start);
    end.setDate(end.getDate() + duration);
    
    this.status = 'active';
    this.start_date = start;
    this.end_date = end;
    this.grace_period_until = null;
    
    await this.save();
    
    return this;
  };

  /**
   * Renew subscription
   */
  Subscription.prototype.renew = async function(durationDays = null) {
    const duration = durationDays || this.package.duration_days;
    
    // If expired, start from now, otherwise extend from end_date
    const startFrom = this.isExpired() ? new Date() : new Date(this.end_date);
    
    const newEndDate = new Date(startFrom);
    newEndDate.setDate(newEndDate.getDate() + duration);
    
    this.status = 'active';
    if (this.isExpired()) {
      this.start_date = new Date();
    }
    this.end_date = newEndDate;
    this.grace_period_until = null;
    
    await this.save();
    
    return this;
  };

  /**
   * Expire subscription (apply grace period)
   */
  Subscription.prototype.expire = async function(gracePeriodDays = 7) {
    this.status = 'expired';
    
    if (gracePeriodDays > 0) {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
      this.grace_period_until = gracePeriodEnd;
    }
    
    await this.save();
    
    return this;
  };

  /**
   * Cancel subscription
   */
  Subscription.prototype.cancel = async function(reason = null) {
    this.status = 'cancelled';
    this.cancelled_at = new Date();
    this.cancellation_reason = reason;
    this.auto_renew = false;
    
    await this.save();
    
    return this;
  };

  /**
   * Suspend subscription
   */
  Subscription.prototype.suspend = async function() {
    this.status = 'suspended';
    await this.save();
    return this;
  };

  /**
   * Reactivate subscription
   */
  Subscription.prototype.reactivate = async function() {
    if (this.isExpired() && !this.isInGracePeriod()) {
      throw new Error('Cannot reactivate expired subscription without renewal');
    }
    
    this.status = 'active';
    await this.save();
    return this;
  };

  /**
   * Get safe object
   */
  Subscription.prototype.toSafeObject = function() {
    return {
      id: this.id,
      user_id: this.user_id,
      package_id: this.package_id,
      status: this.status,
      start_date: this.start_date,
      end_date: this.end_date,
      auto_renew: this.auto_renew,
      grace_period_until: this.grace_period_until,
      days_remaining: this.getDaysRemaining(),
      is_active: this.isActive(),
      is_expired: this.isExpired(),
      is_in_grace_period: this.isInGracePeriod(),
      package: this.package ? this.package.toSafeObject() : null,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  };

  /**
   * Class Methods
   */

  /**
   * Get user's active subscription
   */
  Subscription.getUserActiveSubscription = async function(userId) {
    return await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active',
      },
      include: [
        {
          model: sequelize.models.Package,
          as: 'package',
        },
      ],
      order: [['end_date', 'DESC']],
    });
  };

  /**
   * Get user's latest subscription
   */
  Subscription.getUserLatestSubscription = async function(userId) {
    return await Subscription.findOne({
      where: {
        user_id: userId,
      },
      include: [
        {
          model: sequelize.models.Package,
          as: 'package',
        },
      ],
      order: [['created_at', 'DESC']],
    });
  };

  /**
   * Get subscriptions expiring soon
   */
  Subscription.getExpiringSoon = async function(days = 7) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await Subscription.findAll({
      where: {
        status: 'active',
        end_date: {
          [Op.between]: [now, futureDate],
        },
      },
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
   * Get expired subscriptions
   */
  Subscription.getExpired = async function() {
    const now = new Date();
    
    return await Subscription.findAll({
      where: {
        status: 'active',
        end_date: {
          [Op.lt]: now,
        },
      },
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
   * Get subscriptions in grace period
   */
  Subscription.getInGracePeriod = async function() {
    const now = new Date();
    
    return await Subscription.findAll({
      where: {
        status: 'expired',
        grace_period_until: {
          [Op.gte]: now,
        },
      },
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
   * Get subscriptions with ended grace period
   */
  Subscription.getGracePeriodEnded = async function() {
    const now = new Date();
    
    return await Subscription.findAll({
      where: {
        status: 'expired',
        grace_period_until: {
          [Op.lt]: now,
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
   * Get statistics
   */
  Subscription.getStatistics = async function() {
    const stats = await Subscription.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
    });

    const result = {
      total: 0,
      active: 0,
      expired: 0,
      cancelled: 0,
      suspended: 0,
      pending: 0,
    };

    stats.forEach(stat => {
      result[stat.status] = parseInt(stat.getDataValue('count'));
      result.total += parseInt(stat.getDataValue('count'));
    });

    return result;
  };

  return Subscription;
};
