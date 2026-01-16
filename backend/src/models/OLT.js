/**
 * OLT Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const OLT = sequelize.define('OLT', {
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
  }, {
    tableName: 'olts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['ip_address'] },
      { fields: ['status'] },
    ],
  });

  OLT.associate = (models) => {
    OLT.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    OLT.hasMany(models.PONPort, {
      foreignKey: 'olt_id',
      as: 'pon_ports',
    });
  };

  OLT.prototype.testConnection = async function() {
    const snmp = require('net-snmp');
    const session = snmp.createSession(this.ip_address, this.snmp_community);

    return new Promise((resolve, reject) => {
      const oid = '1.3.6.1.2.1.1.1.0'; // sysDescr
      session.get([oid], (error, varbinds) => {
        session.close();
        if (error) {
          reject(error);
        } else {
          resolve({
            success: true,
            sysDescr: varbinds[0].value.toString(),
          });
        }
      });
    });
  };

  return OLT;
};
