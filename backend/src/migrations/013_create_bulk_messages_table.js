const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Create bulk_messages table
    await queryInterface.createTable('bulk_messages', {
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
      instance_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'instances',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      batch_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      template: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      total_recipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      sent_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      failed_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
      },
      progress: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      delay_ms: {
        type: DataTypes.INTEGER,
        defaultValue: 2000,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      recipients: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      results: {
        type: DataTypes.JSONB,
        defaultValue: [],
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
    await queryInterface.addIndex('bulk_messages', ['user_id']);
    await queryInterface.addIndex('bulk_messages', ['instance_id']);
    await queryInterface.addIndex('bulk_messages', ['status']);
    await queryInterface.addIndex('bulk_messages', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bulk_messages');
  },
};
