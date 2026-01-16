/**
 * Alert Template Model
 */

const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const AlertTemplate = sequelize.define('AlertTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
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
  }, {
    tableName: 'alert_templates',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['category'] },
      { fields: ['name'] },
      { fields: ['is_active'] },
    ],
  });

  AlertTemplate.associate = (models) => {
    AlertTemplate.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  AlertTemplate.render = function(template, variables) {
    let message = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, variables[key] || '');
    });
    return message;
  };

  return AlertTemplate;
};
