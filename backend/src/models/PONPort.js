/**
 * PON Port Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const PONPort = sequelize.define('PONPort', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
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
  }, {
    tableName: 'pon_ports',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['olt_id'] },
      { fields: ['status'] },
      { fields: ['health_score'] },
    ],
  });

  PONPort.associate = (models) => {
    PONPort.belongsTo(models.OLT, {
      foreignKey: 'olt_id',
      as: 'olt',
    });

    PONPort.hasMany(models.ONU, {
      foreignKey: 'pon_port_id',
      as: 'onus',
    });
  };

  PONPort.prototype.calculateHealthScore = function() {
    let score = 100;

    // Utilization (30%)
    if (this.utilization > 90) score -= 30;
    else if (this.utilization > 80) score -= 20;
    else if (this.utilization > 70) score -= 10;

    // Temperature (20%)
    if (this.temperature > 70) score -= 20;
    else if (this.temperature > 60) score -= 10;

    // RX Power (30%)
    if (this.rx_power && this.rx_power < -30) score -= 30;
    else if (this.rx_power && this.rx_power < -28) score -= 15;

    // Offline ONUs (20%)
    if (this.total_onus > 0) {
      const offlineRatio = this.offline_onus / this.total_onus;
      if (offlineRatio > 0.3) score -= 20;
      else if (offlineRatio > 0.2) score -= 10;
    }

    return Math.max(0, score);
  };

  return PONPort;
};
