/**
 * Migration: Create Subscriptions Table
 * Description: User subscriptions with package details and billing information
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      package_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'packages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'active',
          'expired',
          'cancelled',
          'suspended',
          'trial'
        ),
        defaultValue: 'pending',
        allowNull: false
      },
      billing_period: {
        type: Sequelize.ENUM('monthly', 'quarterly', 'yearly'),
        allowNull: false,
        defaultValue: 'monthly'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Subscription amount paid'
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'IDR'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Subscription start date'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Subscription expiration date'
      },
      trial_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Trial period end date'
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cancel_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      auto_renew: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      grace_period_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Grace period after expiration'
      },
      last_payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      next_payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Payment method used'
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      usage_stats: {
        type: Sequelize.JSONB,
        defaultValue: {
          instances_used: 0,
          messages_sent: 0,
          storage_used_mb: 0,
          olts_added: 0,
          pon_ports_monitored: 0,
          last_reset: null
        },
        allowNull: false,
        comment: 'Current period usage statistics'
      },
      notifications: {
        type: Sequelize.JSONB,
        defaultValue: {
          expiry_7days: false,
          expiry_3days: false,
          expiry_1day: false,
          expired: false,
          suspended: false
        },
        allowNull: false,
        comment: 'Notification tracking'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Indexes
    await queryInterface.addIndex('subscriptions', ['user_id'], {
      name: 'idx_subscriptions_user_id'
    });

    await queryInterface.addIndex('subscriptions', ['package_id'], {
      name: 'idx_subscriptions_package_id'
    });

    await queryInterface.addIndex('subscriptions', ['status'], {
      name: 'idx_subscriptions_status'
    });

    await queryInterface.addIndex('subscriptions', ['user_id', 'status'], {
      name: 'idx_subscriptions_user_status'
    });

    await queryInterface.addIndex('subscriptions', ['expires_at'], {
      name: 'idx_subscriptions_expires_at'
    });

    await queryInterface.addIndex('subscriptions', ['next_payment_date'], {
      name: 'idx_subscriptions_next_payment_date'
    });

    await queryInterface.addIndex('subscriptions', ['invoice_number'], {
      name: 'idx_subscriptions_invoice_number',
      unique: true,
      where: {
        invoice_number: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    // Add constraints
    await queryInterface.addConstraint('subscriptions', {
      fields: ['amount'],
      type: 'check',
      name: 'check_subscriptions_amount_positive',
      where: {
        amount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Ensure user has only one active subscription
    await queryInterface.addIndex('subscriptions', ['user_id'], {
      name: 'idx_subscriptions_user_active_unique',
      unique: true,
      where: {
        status: {
          [Sequelize.Op.in]: ['active', 'trial']
        }
      }
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE subscriptions IS 'User subscriptions with package details';
      COMMENT ON COLUMN subscriptions.status IS 'Subscription status (pending, active, expired, cancelled, suspended, trial)';
      COMMENT ON COLUMN subscriptions.billing_period IS 'Billing cycle (monthly, quarterly, yearly)';
      COMMENT ON COLUMN subscriptions.usage_stats IS 'Current period usage tracking';
      COMMENT ON COLUMN subscriptions.grace_period_ends_at IS 'Grace period after expiration (3-7 days)';
      COMMENT ON COLUMN subscriptions.notifications IS 'Tracks which notifications have been sent';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscriptions');
  }
};
