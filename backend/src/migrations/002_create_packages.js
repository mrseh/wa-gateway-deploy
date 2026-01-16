/**
 * Migration: Create Packages Table
 * Description: Subscription packages with features and pricing
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('packages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      price_monthly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      price_quarterly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      price_yearly: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      discount_quarterly: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Quarterly discount percentage'
      },
      discount_yearly: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Yearly discount percentage'
      },
      trial_days: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Free trial period in days'
      },
      max_instances: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum WhatsApp instances allowed'
      },
      max_messages_per_day: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1000,
        comment: 'Daily message quota'
      },
      max_contacts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10000,
        comment: 'Maximum contacts allowed'
      },
      max_olts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Maximum OLTs for PON monitoring'
      },
      max_pon_ports: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Maximum PON ports to monitor'
      },
      features: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {
          bulk_messaging: false,
          api_access: false,
          webhook_support: true,
          pon_monitoring: false,
          mikrotik_integration: false,
          zabbix_integration: false,
          analytics: false,
          scheduled_reports: false,
          priority_support: false,
          custom_branding: false,
          multi_user: false,
          advanced_analytics: false
        },
        comment: 'Package features configuration'
      },
      limits: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {
          api_rate_limit: 100,
          webhook_rate_limit: 1000,
          file_storage_gb: 1,
          concurrent_connections: 5,
          message_retention_days: 30
        },
        comment: 'Package limits configuration'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'archived'),
        defaultValue: 'active',
        allowNull: false
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether package is visible to public'
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Featured package badge'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Display order'
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
    await queryInterface.addIndex('packages', ['slug'], {
      name: 'idx_packages_slug',
      unique: true
    });

    await queryInterface.addIndex('packages', ['status'], {
      name: 'idx_packages_status'
    });

    await queryInterface.addIndex('packages', ['is_public', 'status'], {
      name: 'idx_packages_public_status'
    });

    await queryInterface.addIndex('packages', ['sort_order'], {
      name: 'idx_packages_sort_order'
    });

    // Add constraints
    await queryInterface.addConstraint('packages', {
      fields: ['price_monthly'],
      type: 'check',
      name: 'check_packages_price_monthly_positive',
      where: {
        price_monthly: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('packages', {
      fields: ['max_instances'],
      type: 'check',
      name: 'check_packages_max_instances_positive',
      where: {
        max_instances: {
          [Sequelize.Op.gt]: 0
        }
      }
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE packages IS 'Subscription packages with features and pricing';
      COMMENT ON COLUMN packages.slug IS 'URL-friendly package identifier';
      COMMENT ON COLUMN packages.features IS 'JSON configuration of enabled features';
      COMMENT ON COLUMN packages.limits IS 'JSON configuration of package limits';
      COMMENT ON COLUMN packages.trial_days IS 'Free trial period in days (0 = no trial)';
    `);

    // Insert default packages
    await queryInterface.bulkInsert('packages', [
      {
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'Starter',
        slug: 'starter',
        description: 'Perfect for small businesses getting started with WhatsApp automation',
        price_monthly: 25.00,
        price_quarterly: 67.50,
        price_yearly: 240.00,
        discount_quarterly: 10,
        discount_yearly: 20,
        trial_days: 7,
        max_instances: 1,
        max_messages_per_day: 1000,
        max_contacts: 5000,
        max_olts: 0,
        max_pon_ports: 0,
        features: JSON.stringify({
          bulk_messaging: true,
          api_access: false,
          webhook_support: true,
          pon_monitoring: false,
          mikrotik_integration: false,
          zabbix_integration: false,
          analytics: true,
          scheduled_reports: false,
          priority_support: false,
          custom_branding: false,
          multi_user: false,
          advanced_analytics: false
        }),
        limits: JSON.stringify({
          api_rate_limit: 50,
          webhook_rate_limit: 500,
          file_storage_gb: 1,
          concurrent_connections: 2,
          message_retention_days: 30
        }),
        status: 'active',
        is_public: true,
        is_featured: false,
        sort_order: 1,
        metadata: JSON.stringify({}),
        created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
        updated_at: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      {
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'Professional',
        slug: 'professional',
        description: 'For growing businesses with advanced automation needs',
        price_monthly: 75.00,
        price_quarterly: 202.50,
        price_yearly: 720.00,
        discount_quarterly: 10,
        discount_yearly: 20,
        trial_days: 14,
        max_instances: 5,
        max_messages_per_day: 10000,
        max_contacts: 50000,
        max_olts: 3,
        max_pon_ports: 50,
        features: JSON.stringify({
          bulk_messaging: true,
          api_access: true,
          webhook_support: true,
          pon_monitoring: true,
          mikrotik_integration: true,
          zabbix_integration: false,
          analytics: true,
          scheduled_reports: true,
          priority_support: true,
          custom_branding: false,
          multi_user: true,
          advanced_analytics: true
        }),
        limits: JSON.stringify({
          api_rate_limit: 200,
          webhook_rate_limit: 2000,
          file_storage_gb: 10,
          concurrent_connections: 10,
          message_retention_days: 90
        }),
        status: 'active',
        is_public: true,
        is_featured: true,
        sort_order: 2,
        metadata: JSON.stringify({}),
        created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
        updated_at: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      {
        id: Sequelize.literal('uuid_generate_v4()'),
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Full-featured solution for large organizations',
        price_monthly: 150.00,
        price_quarterly: 405.00,
        price_yearly: 1440.00,
        discount_quarterly: 10,
        discount_yearly: 20,
        trial_days: 30,
        max_instances: 20,
        max_messages_per_day: 100000,
        max_contacts: 500000,
        max_olts: 20,
        max_pon_ports: 500,
        features: JSON.stringify({
          bulk_messaging: true,
          api_access: true,
          webhook_support: true,
          pon_monitoring: true,
          mikrotik_integration: true,
          zabbix_integration: true,
          analytics: true,
          scheduled_reports: true,
          priority_support: true,
          custom_branding: true,
          multi_user: true,
          advanced_analytics: true
        }),
        limits: JSON.stringify({
          api_rate_limit: 1000,
          webhook_rate_limit: 10000,
          file_storage_gb: 100,
          concurrent_connections: 50,
          message_retention_days: 365
        }),
        status: 'active',
        is_public: true,
        is_featured: false,
        sort_order: 3,
        metadata: JSON.stringify({}),
        created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
        updated_at: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    ]);

    // Enable UUID extension if not exists
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('packages');
  }
};
