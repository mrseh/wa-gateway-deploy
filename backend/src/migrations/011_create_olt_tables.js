const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Create olts table
    await queryInterface.createTable('olts', {
      id: {
        type: DataTypes.UUID,
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      vendor: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      model: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      snmp_version: {
        type: DataTypes.STRING(10),
        defaultValue: 'v2c',
      },
      snmp_community: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      snmp_port: {
        type: DataTypes.INTEGER,
        defaultValue: 161,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
      },
      last_poll: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      total_pon_ports: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      total_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      online_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      offline_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      location: {
        type: DataTypes.STRING(200),
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // Create pon_ports table
    await queryInterface.createTable('pon_ports', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      olt_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'olts',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      port_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      port_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
      },
      total_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      online_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      offline_onus: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      voltage: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tx_power: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      rx_power: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      utilization: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      bandwidth_in: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      bandwidth_out: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      health_score: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
      },
      threshold_temperature_high: {
        type: DataTypes.FLOAT,
        defaultValue: 70,
      },
      threshold_utilization_high: {
        type: DataTypes.FLOAT,
        defaultValue: 80,
      },
      threshold_rx_power_low: {
        type: DataTypes.FLOAT,
        defaultValue: -28,
      },
      last_poll: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // Create onus table
    await queryInterface.createTable('onus', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      pon_port_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'pon_ports',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      onu_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      serial_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      mac_address: {
        type: DataTypes.STRING(17),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'online',
      },
      rx_power: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tx_power: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      distance: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      voltage: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      customer_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      customer_phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      customer_address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      last_online: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_offline: {
        type: DataTypes.DATE,
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // Create indexes
    await queryInterface.addIndex('olts', ['user_id']);
    await queryInterface.addIndex('olts', ['ip_address']);
    await queryInterface.addIndex('olts', ['status']);

    await queryInterface.addIndex('pon_ports', ['olt_id']);
    await queryInterface.addIndex('pon_ports', ['status']);
    await queryInterface.addIndex('pon_ports', ['health_score']);

    await queryInterface.addIndex('onus', ['pon_port_id']);
    await queryInterface.addIndex('onus', ['serial_number']);
    await queryInterface.addIndex('onus', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('onus');
    await queryInterface.dropTable('pon_ports');
    await queryInterface.dropTable('olts');
  },
};
