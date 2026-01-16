/**
 * Package Model
 * Manages subscription packages/plans with features
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Package = sequelize.define('Package', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: 'Package duration in days',
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        max_instances: 1,
        max_messages_per_day: 100,
        max_messages_per_month: 3000,
        max_olts: 0,
        has_api_access: false,
        has_webhook: true,
        has_bulk_messaging: false,
        has_analytics: false,
        has_olt_monitoring: false,
        has_priority_support: false,
        has_custom_domain: false,
      },
      comment: 'Package features in JSON format',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_trial: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Is this a trial package',
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order',
    },
    stripe_price_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Stripe Price ID for recurring billing',
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional metadata',
    },
  }, {
    tableName: 'packages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['name'], unique: true },
      { fields: ['is_active'] },
      { fields: ['sort_order'] },
      { fields: ['is_trial'] },
    ],
  });

  /**
   * Model associations
   */
  Package.associate = (models) => {
    Package.hasMany(models.Subscription, {
      foreignKey: 'package_id',
      as: 'subscriptions',
    });
  };

  /**
   * Instance Methods
   */

  /**
   * Get feature value
   */
  Package.prototype.getFeature = function(featureName) {
    return this.features[featureName];
  };

  /**
   * Check if feature is enabled
   */
  Package.prototype.hasFeature = function(featureName) {
    return !!this.features[featureName];
  };

  /**
   * Calculate price with discount
   */
  Package.prototype.calculatePrice = function(months = 1, discountPercent = 0) {
    const basePrice = parseFloat(this.price);
    const totalPrice = basePrice * months;
    const discountAmount = (totalPrice * discountPercent) / 100;
    return totalPrice - discountAmount;
  };

  /**
   * Get formatted price
   */
  Package.prototype.getFormattedPrice = function() {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(this.price);
  };

  /**
   * Check if package is trial
   */
  Package.prototype.isTrial = function() {
    return this.is_trial === true;
  };

  /**
   * Get safe object (for API responses)
   */
  Package.prototype.toSafeObject = function() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: parseFloat(this.price),
      duration_days: this.duration_days,
      features: this.features,
      is_active: this.is_active,
      is_trial: this.is_trial,
      sort_order: this.sort_order,
      formatted_price: this.getFormattedPrice(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  };

  /**
   * Class Methods
   */

  /**
   * Get all active packages
   */
  Package.getActivePackages = async function() {
    return await Package.findAll({
      where: {
        is_active: true,
      },
      order: [['sort_order', 'ASC'], ['price', 'ASC']],
    });
  };

  /**
   * Get package by name
   */
  Package.getByName = async function(name) {
    return await Package.findOne({
      where: { name },
    });
  };

  /**
   * Get trial package
   */
  Package.getTrialPackage = async function() {
    return await Package.findOne({
      where: {
        is_trial: true,
        is_active: true,
      },
    });
  };

  /**
   * Get package with subscriptions count
   */
  Package.getWithStats = async function(packageId) {
    const packageData = await Package.findByPk(packageId, {
      include: [
        {
          model: sequelize.models.Subscription,
          as: 'subscriptions',
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [
            sequelize.fn('COUNT', sequelize.col('subscriptions.id')),
            'subscription_count',
          ],
        ],
      },
      group: ['Package.id'],
    });

    return packageData;
  };

  /**
   * Create default packages
   */
  Package.createDefaults = async function() {
    const packages = [
      {
        name: 'Trial',
        description: 'Try our service for free',
        price: 0,
        duration_days: 7,
        features: {
          max_instances: 1,
          max_messages_per_day: 50,
          max_messages_per_month: 350,
          max_olts: 0,
          has_api_access: false,
          has_webhook: true,
          has_bulk_messaging: false,
          has_analytics: false,
          has_olt_monitoring: false,
          has_priority_support: false,
          has_custom_domain: false,
        },
        is_active: true,
        is_trial: true,
        sort_order: 0,
      },
      {
        name: 'Starter',
        description: 'Perfect for small businesses',
        price: 50000,
        duration_days: 30,
        features: {
          max_instances: 2,
          max_messages_per_day: 500,
          max_messages_per_month: 15000,
          max_olts: 1,
          has_api_access: true,
          has_webhook: true,
          has_bulk_messaging: true,
          has_analytics: true,
          has_olt_monitoring: false,
          has_priority_support: false,
          has_custom_domain: false,
        },
        is_active: true,
        is_trial: false,
        sort_order: 1,
      },
      {
        name: 'Professional',
        description: 'For growing businesses',
        price: 150000,
        duration_days: 30,
        features: {
          max_instances: 5,
          max_messages_per_day: 2000,
          max_messages_per_month: 60000,
          max_olts: 5,
          has_api_access: true,
          has_webhook: true,
          has_bulk_messaging: true,
          has_analytics: true,
          has_olt_monitoring: true,
          has_priority_support: false,
          has_custom_domain: false,
        },
        is_active: true,
        is_trial: false,
        sort_order: 2,
      },
      {
        name: 'Business',
        description: 'For large enterprises',
        price: 350000,
        duration_days: 30,
        features: {
          max_instances: 15,
          max_messages_per_day: 10000,
          max_messages_per_month: 300000,
          max_olts: 15,
          has_api_access: true,
          has_webhook: true,
          has_bulk_messaging: true,
          has_analytics: true,
          has_olt_monitoring: true,
          has_priority_support: true,
          has_custom_domain: true,
        },
        is_active: true,
        is_trial: false,
        sort_order: 3,
      },
    ];

    for (const pkg of packages) {
      await Package.findOrCreate({
        where: { name: pkg.name },
        defaults: pkg,
      });
    }

    console.log('Default packages created/updated');
  };

  return Package;
};
