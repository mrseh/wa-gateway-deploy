/**
 * Migration: Create OLTs Table
 * Description: Optical Line Terminal devices for PON monitoring
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('olts', {
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
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      vendor: {
        type: Sequelize.ENUM('ZTE', 'Huawei', 'FiberHome', 'VSOL', 'Other'),
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: false
      },
      snmp_version: {
        type: Sequelize.ENUM('v1', 'v2c', 'v3'),
        defaultValue: 'v2c',
        allowNull: false
      },
      snmp_community: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'SNMP community string (encrypted)'
      },
      snmp_port: {
        type: Sequelize.INTEGER,
        defaultValue: 161,
        allowNull: false
      },
      snmp_timeout: {
        type: Sequelize.INTEGER,
        defaultValue: 5000,
        allowNull: false,
        comment: 'SNMP timeout in milliseconds'
      },
      snmp_retries: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'error', 'maintenance'),
        defaultValue: 'active',
        allowNull: false
      },
      connection_status: {
        type: Sequelize.ENUM('online', 'offline', 'unknown'),
        defaultValue: 'unknown',
        allowNull: false
      },
      last_poll_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_success_poll_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      poll_interval: {
        type: Sequelize.INTEGER,
        defaultValue: 300,
        allowNull: false,
        comment: 'Polling interval in seconds'
      },
      total_pon_ports: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      total_onus: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      online_onus: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      offline_onus: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      system_info: {
        type: Sequelize.JSONB,
        defaultValue: {
          hostname: null,
          system_description: null,
          uptime: null,
          firmware_version: null,
          serial_number: null
        },
        allowNull: false
      },
      health_score: {
        type: Sequelize.INTEGER,
        defaultValue: 100,
        allowNull: false,
        comment: 'Overall health score (0-100)'
      },
      alerts_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      alert_contacts: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: [],
        allowNull: false,
        comment: 'Phone numbers for alert notifications'
      },
      thresholds: {
        type: Sequelize.JSONB,
        defaultValue: {
          onu_offline_percentage: 20,
          pon_utilization: 80,
          rx_power_min: -27,
          rx_power_max: -8,
          temperature_max: 70
        },
        allowNull: false
      },
      oids: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
        comment: 'Vendor-specific OID mappings'
      },
      error_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_error_at: {
        type: Sequelize.DATE,
        allowNull: true
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
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Indexes
    await queryInterface.addIndex('olts', ['user_id'], {
      name: 'idx_olts_user_id'
    });

    await queryInterface.addIndex('olts', ['ip_address'], {
      name: 'idx_olts_ip_address'
    });

    await queryInterface.addIndex('olts', ['status'], {
      name: 'idx_olts_status'
    });

    await queryInterface.addIndex('olts', ['connection_status'], {
      name: 'idx_olts_connection_status'
    });

    await queryInterface.addIndex('olts', ['user_id', 'status'], {
      name: 'idx_olts_user_status'
    });

    await queryInterface.addIndex('olts', ['last_poll_at'], {
      name: 'idx_olts_last_poll_at'
    });

    await queryInterface.addIndex('olts', ['vendor'], {
      name: 'idx_olts_vendor'
    });

    // Unique constraint for user + IP address
    await queryInterface.addIndex('olts', ['user_id', 'ip_address'], {
      name: 'idx_olts_user_ip_unique',
      unique: true
    });

    // Add constraints
    await queryInterface.addConstraint('olts', {
      fields: ['health_score'],
      type: 'check',
      name: 'check_olts_health_score_range',
      where: {
        health_score: {
          [Sequelize.Op.between]: [0, 100]
        }
      }
    });

    await queryInterface.addConstraint('olts', {
      fields: ['poll_interval'],
      type: 'check',
      name: 'check_olts_poll_interval_positive',
      where: {
        poll_interval: {
          [Sequelize.Op.gt]: 0
        }
      }
    });

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE olts IS 'Optical Line Terminal devices for PON monitoring';
      COMMENT ON COLUMN olts.vendor IS 'OLT vendor (ZTE, Huawei, FiberHome, VSOL, Other)';
      COMMENT ON COLUMN olts.snmp_community IS 'SNMP community string (should be encrypted)';
      COMMENT ON COLUMN olts.health_score IS 'Overall OLT health score (0-100)';
      COMMENT ON COLUMN olts.thresholds IS 'Alert threshold configuration';
      COMMENT ON COLUMN olts.oids IS 'Vendor-specific SNMP OID mappings';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('olts');
  }
};
