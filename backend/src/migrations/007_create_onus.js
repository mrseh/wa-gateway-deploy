/**
 * Migration: Create ONUs Table
 * Description: Optical Network Units connected to PON ports
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('onus', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      pon_port_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'pon_ports',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      onu_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ONU index on PON port'
      },
      onu_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'ONU identifier from OLT'
      },
      serial_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ONU serial number'
      },
      mac_address: {
        type: Sequelize.MACADDR,
        allowNull: true
      },
      customer_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      customer_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      customer_address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      service_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Customer service ID from billing system'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('online', 'offline', 'los', 'dying_gasp', 'unknown'),
        defaultValue: 'unknown',
        allowNull: false
      },
      admin_status: {
        type: Sequelize.ENUM('enabled', 'disabled'),
        defaultValue: 'enabled',
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ONU model'
      },
      vendor: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'ONU vendor'
      },
      firmware_version: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      hardware_version: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      distance: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Distance from OLT in meters'
      },
      rx_power: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Receive power in dBm'
      },
      tx_power: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Transmit power in dBm'
      },
      voltage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'ONU voltage'
      },
      temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'ONU temperature in Celsius'
      },
      uptime: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
        comment: 'Uptime in seconds'
      },
      last_online_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_offline_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      offline_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of times ONU went offline'
      },
      signal_quality: {
        type: Sequelize.ENUM('excellent', 'good', 'fair', 'poor', 'bad'),
        allowNull: true,
        comment: 'Signal quality indicator'
      },
      health_score: {
        type: Sequelize.INTEGER,
        defaultValue: 100,
        allowNull: false,
        comment: 'ONU health score (0-100)'
      },
      interfaces: {
        type: Sequelize.JSONB,
        defaultValue: [],
        allowNull: false,
        comment: 'Ethernet interfaces configuration'
      },
      statistics: {
        type: Sequelize.JSONB,
        defaultValue: {
          bytes_in: 0,
          bytes_out: 0,
          packets_in: 0,
          packets_out: 0,
          errors_in: 0,
          errors_out: 0,
          last_reset: null
        },
        allowNull: false
      },
      thresholds: {
        type: Sequelize.JSONB,
        defaultValue: {
          rx_power_min: -27,
          rx_power_max: -8,
          temperature_max: 70
        },
        allowNull: false
      },
      alerts_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      last_poll_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_alarm: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      last_alarm_at: {
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
    await queryInterface.addIndex('onus', ['pon_port_id'], {
      name: 'idx_onus_pon_port_id'
    });

    await queryInterface.addIndex('onus', ['pon_port_id', 'onu_index'], {
      name: 'idx_onus_pon_port_onu_index_unique',
      unique: true
    });

    await queryInterface.addIndex('onus', ['serial_number'], {
      name: 'idx_onus_serial_number'
    });

    await queryInterface.addIndex('onus', ['mac_address'], {
      name: 'idx_onus_mac_address'
    });

    await queryInterface.addIndex('onus', ['status'], {
      name: 'idx_onus_status'
    });

    await queryInterface.addIndex('onus', ['customer_name'], {
      name: 'idx_onus_customer_name'
    });

    await queryInterface.addIndex('onus', ['service_id'], {
      name: 'idx_onus_service_id'
    });

    await queryInterface.addIndex('onus', ['signal_quality'], {
      name: 'idx_onus_signal_quality'
    });

    await queryInterface.addIndex('onus', ['health_score'], {
      name: 'idx_onus_health_score'
    });

    await queryInterface.addIndex('onus', ['last_online_at'], {
      name: 'idx_onus_last_online_at'
    });

    // Add constraints
    await queryInterface.addConstraint('onus', {
      fields: ['health_score'],
      type: 'check',
      name: 'check_onus_health_score_range',
      where: {
        health_score: {
          [Sequelize.Op.between]: [0, 100]
        }
      }
    });

    await queryInterface.addConstraint('onus', {
      fields: ['offline_count'],
      type: 'check',
      name: 'check_onus_offline_count_positive',
      where: {
        offline_count: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Create time-series table for ONU metrics
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS onu_metrics (
        time TIMESTAMPTZ NOT NULL,
        onu_id UUID NOT NULL,
        status VARCHAR(20),
        rx_power DECIMAL(5,2),
        tx_power DECIMAL(5,2),
        voltage DECIMAL(5,2),
        temperature DECIMAL(5,2),
        distance INTEGER,
        uptime BIGINT,
        health_score INTEGER DEFAULT 100,
        metadata JSONB DEFAULT '{}'
      );
      
      SELECT create_hypertable('onu_metrics', 'time', if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_onu_metrics_onu_id_time 
      ON onu_metrics (onu_id, time DESC);
    `);

    // Create ONU events table for tracking status changes
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS onu_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        onu_id UUID NOT NULL REFERENCES onus(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_onu_events_onu_id 
      ON onu_events (onu_id);
      
      CREATE INDEX IF NOT EXISTS idx_onu_events_event_type 
      ON onu_events (event_type);
      
      CREATE INDEX IF NOT EXISTS idx_onu_events_created_at 
      ON onu_events (created_at DESC);
    `);

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE onus IS 'Optical Network Units connected to PON ports';
      COMMENT ON COLUMN onus.onu_index IS 'ONU index on PON port (1-128)';
      COMMENT ON COLUMN onus.status IS 'ONU connection status (online, offline, los, dying_gasp)';
      COMMENT ON COLUMN onus.rx_power IS 'Receive power in dBm (typical range: -27 to -8)';
      COMMENT ON COLUMN onus.signal_quality IS 'Signal quality indicator based on RX power';
      COMMENT ON COLUMN onus.health_score IS 'ONU health score (0-100)';
      COMMENT ON COLUMN onus.offline_count IS 'Counter for offline events';
      
      COMMENT ON TABLE onu_metrics IS 'Time-series metrics for ONUs (TimescaleDB hypertable)';
      COMMENT ON TABLE onu_events IS 'Event log for ONU status changes and alarms';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS onu_events CASCADE');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS onu_metrics CASCADE');
    await queryInterface.dropTable('onus');
  }
};
