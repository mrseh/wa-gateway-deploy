/**
 * ONU Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const ONU = sequelize.define('ONU', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
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
  }, {
    tableName: 'onus',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['pon_port_id'] },
      { fields: ['serial_number'] },
      { fields: ['status'] },
    ],
  });

  ONU.associate = (models) => {
    ONU.belongsTo(models.PONPort, {
      foreignKey: 'pon_port_id',
      as: 'pon_port',
    });
  };

  ONU.prototype.getSignalQuality = function() {
    if (!this.rx_power) return 'unknown';
    
    if (this.rx_power >= -20) return 'excellent';
    if (this.rx_power >= -25) return 'good';
    if (this.rx_power >= -28) return 'fair';
    return 'poor';
  };

  return ONU;
};
