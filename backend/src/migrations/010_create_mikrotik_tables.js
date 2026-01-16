const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Add webhook_token to users table
    await queryInterface.addColumn('users', 'webhook_token', {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    });

    // Create mikrotik_events table
    await queryInterface.createTable('mikrotik_events', {
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
      instance_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'instances',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      event_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      router_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      router_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      mac_address: {
        type: DataTypes.STRING(17),
        allowNull: true,
      },
      event_data: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      message_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      message_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
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

    // Create alert_templates table
    await queryInterface.createTable('alert_templates', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
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
      category: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      emoji: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      template: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      variables: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
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
    await queryInterface.addIndex('mikrotik_events', ['user_id']);
    await queryInterface.addIndex('mikrotik_events', ['event_type']);
    await queryInterface.addIndex('mikrotik_events', ['router_name']);
    await queryInterface.addIndex('mikrotik_events', ['created_at']);
    
    await queryInterface.addIndex('alert_templates', ['user_id']);
    await queryInterface.addIndex('alert_templates', ['category']);
    await queryInterface.addIndex('alert_templates', ['is_active']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('mikrotik_events');
    await queryInterface.dropTable('alert_templates');
    await queryInterface.removeColumn('users', 'webhook_token');
  },
};
