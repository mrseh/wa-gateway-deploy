/**
 * Mikrotik Event Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const MikrotikEvent = sequelize.define('MikrotikEvent', {
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
  }, {
    tableName: 'mikrotik_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['instance_id'] },
      { fields: ['event_type'] },
      { fields: ['router_name'] },
      { fields: ['username'] },
      { fields: ['created_at'] },
    ],
  });

  MikrotikEvent.associate = (models) => {
    MikrotikEvent.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    MikrotikEvent.belongsTo(models.Instance, {
      foreignKey: 'instance_id',
      as: 'instance',
    });
  };

  return MikrotikEvent;
};
