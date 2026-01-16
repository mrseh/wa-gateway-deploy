/**
 * Bulk Message Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const BulkMessage = sequelize.define('BulkMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
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
      defaultValue: 'pending', // pending, processing, completed, failed, cancelled
    },
    progress: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    delay_ms: {
      type: DataTypes.INTEGER,
      defaultValue: 2000, // 2 seconds between messages
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
  }, {
    tableName: 'bulk_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['instance_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  });

  BulkMessage.associate = (models) => {
    BulkMessage.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    BulkMessage.belongsTo(models.Instance, {
      foreignKey: 'instance_id',
      as: 'instance',
    });
  };

  return BulkMessage;
};
