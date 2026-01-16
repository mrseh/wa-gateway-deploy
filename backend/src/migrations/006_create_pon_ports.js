/**
 * Migration: Create PON Ports Table
 * Description: PON ports on OLT devices for monitoring
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pon_ports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      olt_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'olts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      port_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      port_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Port identifier (e.g., 0/1/1)'
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
      admin_status: {
        type: Sequelize.ENUM('up', 'down', 'testing'),
        defaultValue: 'up',
        allowNull: false
      },
      oper_status: {
        type: Sequelize.ENUM('up', 'down', 'unknown'),
        defaultValue: 'unknown',
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
      max_onus: {
        type: Sequelize.INTEGER,
        defaultValue: 128,
        allowNull: false,
        comment: 'Maximum ONUs supported'
      },
      utilization: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        allowNull: false,
        comment: 'Port utilization percentage'
      },
      bandwidth_in: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
        comment: 'Inbound bandwidth in bps'
      },
      bandwidth_out: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
        allowNull: false,
        comment: 'Outbound bandwidth in bps'
      },
      temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Port temperature in Celsius'
      },
      voltage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Port voltage'
      },
      tx_power: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Transmit power in dBm'
      },
      rx_power: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Receive power in dBm'
      },
      avg_rx_power: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Average RX power from all ONUs'
      },
      ber: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
        comment: 'Bit Error Rate'
      },
      health_score: {
        type: Sequelize.INTEGER,
        defaultValue: 100,
        allowNull: false,
        comment: 'Port health score (0-100)'
      },
      thresholds: {
        type: Sequelize.JSONB,
        defaultValue: {
          utilization_warning: 70,
          utilization_critical: 90,
          temperature_warning: 60,
          temperature_critical: 70,
          rx_power_min: -27,
          rx_power_max: -8,
          offline_onus_percentage: 20
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
      last_metrics: {
        type: Sequelize.JSONB,
        defaultValue: {},
        allowNull: false,
        comment: 'Latest metrics snapshot'
      },
      statistics: {
        type: Sequelize.JSONB,
        defaultValue: {
          total_packets_in: 0,
          total_packets_out: 0,
          total_bytes_in: 0,
          total_bytes_out: 0,
          errors_in: 0,
          errors_out: 0,
          discards_in: 0,
          discards_out: 0,
          uptime_seconds: 0,
          last_reset: null
        },
        allowNull: false
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
    await queryInterface.addIndex('pon_ports', ['olt_id'], {
      name: 'idx_pon_ports_olt_id'
    });

    await queryInterface.addIndex('pon_ports', ['olt_id', 'port_number'], {
      name: 'idx_pon_ports_olt_port_unique',
      unique: true
    });

    await queryInterface.addIndex('pon_ports', ['status'], {
      name: 'idx_pon_ports_status'
    });

    await queryInterface.addIndex('pon_ports', ['oper_status'], {
      name: 'idx_pon_ports_oper_status'
    });

    await queryInterface.addIndex('pon_ports', ['health_score'], {
      name: 'idx_pon_ports_health_score'
    });

    await queryInterface.addIndex('pon_ports', ['utilization'], {
      name: 'idx_pon_ports_utilization'
    });

    await queryInterface.addIndex('pon_ports', ['last_poll_at'], {
      name: 'idx_pon_ports_last_poll_at'
    });

    // Add constraints
    await queryInterface.addConstraint('pon_ports', {
      fields: ['utilization'],
      type: 'check',
      name: 'check_pon_ports_utilization_range',
      where: {
        utilization: {
          [Sequelize.Op.between]: [0, 100]
        }
      }
    });

    await queryInterface.addConstraint('pon_ports', {
      fields: ['health_score'],
      type: 'check',
      name: 'check_pon_ports_health_score_range',
      where: {
        health_score: {
          [Sequelize.Op.between]: [0, 100]
        }
      }
    });

    await queryInterface.addConstraint('pon_ports', {
      fields: ['total_onus'],
      type: 'check',
      name: 'check_pon_ports_total_onus_positive',
      where: {
        total_onus: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Enable TimescaleDB extension for time-series data
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    `);

    // Create hypertable for PON port metrics (time-series data)
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS pon_port_metrics (
        time TIMESTAMPTZ NOT NULL,
        pon_port_id UUID NOT NULL,
        online_onus INTEGER DEFAULT 0,
        offline_onus INTEGER DEFAULT 0,
        utilization DECIMAL(5,2) DEFAULT 0,
        bandwidth_in BIGINT DEFAULT 0,
        bandwidth_out BIGINT DEFAULT 0,
        temperature DECIMAL(5,2),
        voltage DECIMAL(5,2),
        tx_power DECIMAL(5,2),
        rx_power DECIMAL(5,2),
        avg_rx_power DECIMAL(5,2),
        ber DECIMAL(10,6),
        health_score INTEGER DEFAULT 100,
        metadata JSONB DEFAULT '{}'
      );
      
      SELECT create_hypertable('pon_port_metrics', 'time', if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_pon_port_metrics_pon_port_id_time 
      ON pon_port_metrics (pon_port_id, time DESC);
    `);

    // Add comments
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE pon_ports IS 'PON ports on OLT devices for monitoring';
      COMMENT ON COLUMN pon_ports.port_name IS 'Port identifier (e.g., 0/1/1, GPON0/1/1)';
      COMMENT ON COLUMN pon_ports.utilization IS 'Port utilization percentage (0-100)';
      COMMENT ON COLUMN pon_ports.health_score IS 'Port health score based on various metrics (0-100)';
      COMMENT ON COLUMN pon_ports.thresholds IS 'Alert threshold configuration for this port';
      COMMENT ON COLUMN pon_ports.statistics IS 'Cumulative statistics for the port';
      
      COMMENT ON TABLE pon_port_metrics IS 'Time-series metrics for PON ports (TimescaleDB hypertable)';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('DROP TABLE IF NOT EXISTS pon_port_metrics CASCADE');
    await queryInterface.dropTable('pon_ports');
  }
};
