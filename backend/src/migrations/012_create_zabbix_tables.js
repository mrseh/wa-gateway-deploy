const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Create zabbix_events table
    await queryInterface.createTable('zabbix_events', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
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
      event_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      trigger_name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      host_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      severity: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      item_value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      event_time: {
        type: DataTypes.STRING(100),
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
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Create indexes
    await queryInterface.addIndex('zabbix_events', ['user_id']);
    await queryInterface.addIndex('zabbix_events', ['event_id']);
    await queryInterface.addIndex('zabbix_events', ['severity']);
    await queryInterface.addIndex('zabbix_events', ['status']);
    await queryInterface.addIndex('zabbix_events', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('zabbix_events');
  },
};
