const { sequelize, Sequelize } = require('../config/database');
const logger = require('../config/logger');

/**
 * Instance Model
 * Manages WhatsApp instances connected via Evolution API
 */

const Instance = sequelize.define('Instance', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  user_id: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  name: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  instance_name: {
    type: Sequelize.STRING(255),
    allowNull: false,
    unique: true
  },
  phone_number: {
    type: Sequelize.STRING(20),
    allowNull: true
  },
  status: {
    type: Sequelize.ENUM(
      'creating',
      'waiting_qr',
      'connected',
      'disconnected',
      'error',
      'suspended'
    ),
    defaultValue: 'creating',
    allowNull: false
  },
  qr_code: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  qr_code_expires_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  api_key: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  webhook_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  webhook_events: {
    type: Sequelize.ARRAY(Sequelize.STRING),
    defaultValue: [],
    allowNull: false
  },
  connected_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  disconnected_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  last_seen: {
    type: Sequelize.DATE,
    allowNull: true
  },
  connection_state: {
    type: Sequelize.STRING(50),
    allowNull: true
  },
  profile_name: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  profile_picture: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  profile_status: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  settings: {
    type: Sequelize.JSONB,
    defaultValue: {
      auto_reply: false,
      read_messages: false,
      reject_calls: false,
      always_online: false,
      message_delay: 1000
    },
    allowNull: false
  },
  statistics: {
    type: Sequelize.JSONB,
    defaultValue: {
      messages_sent: 0,
      messages_received: 0,
      messages_failed: 0,
      last_message_at: null,
      uptime_percentage: 100,
      connection_drops: 0
    },
    allowNull: false
  },
  quota: {
    type: Sequelize.JSONB,
    defaultValue: {
      daily_messages: 0,
      daily_limit: 1000,
      monthly_messages: 0,
      last_reset: null
    },
    allowNull: false
  },
  last_error: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  last_error_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  error_count: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  auto_reconnect: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  reconnect_attempts: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  metadata: {
    type: Sequelize.JSONB,
    defaultValue: {},
    allowNull: false
  }
}, {
  tableName: 'instances',
  underscored: true,
  timestamps: true,
  paranoid: true
});

/**
 * Associations
 */
Instance.associate = (models) => {
  Instance.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Instance.hasMany(models.MessageLog, {
    foreignKey: 'instance_id',
    as: 'messages'
  });
};

/**
 * Instance Methods
 */

/**
 * Check if instance is connected
 */
Instance.prototype.isConnected = function() {
  return this.status === 'connected';
};

/**
 * Check if instance needs QR code
 */
Instance.prototype.needsQRCode = function() {
  return this.status === 'waiting_qr' || this.status === 'creating';
};

/**
 * Update connection status
 */
Instance.prototype.updateConnectionStatus = async function(status, state = null) {
  this.status = status;
  this.connection_state = state;
  this.last_seen = new Date();
  
  if (status === 'connected') {
    this.connected_at = new Date();
    this.disconnected_at = null;
    this.reconnect_attempts = 0;
  } else if (status === 'disconnected') {
    this.disconnected_at = new Date();
  }
  
  await this.save();
  
  logger.info('Instance status updated:', {
    instanceId: this.id,
    status,
    state
  });
};

/**
 * Update QR code
 */
Instance.prototype.updateQRCode = async function(qrCode) {
  this.qr_code = qrCode;
  this.qr_code_expires_at = new Date(Date.now() + 60 * 1000); // 60 seconds
  this.status = 'waiting_qr';
  await this.save();
};

/**
 * Set as connected
 */
Instance.prototype.setConnected = async function(phoneNumber, profileData = {}) {
  this.phone_number = phoneNumber;
  this.status = 'connected';
  this.connected_at = new Date();
  this.disconnected_at = null;
  this.qr_code = null;
  this.qr_code_expires_at = null;
  this.reconnect_attempts = 0;
  this.error_count = 0;
  
  if (profileData.name) {
    this.profile_name = profileData.name;
  }
  if (profileData.picture) {
    this.profile_picture = profileData.picture;
  }
  if (profileData.status) {
    this.profile_status = profileData.status;
  }
  
  await this.save();
  
  logger.info('Instance connected:', {
    instanceId: this.id,
    phoneNumber
  });
};

/**
 * Set as disconnected
 */
Instance.prototype.setDisconnected = async function(reason = null) {
  this.status = 'disconnected';
  this.disconnected_at = new Date();
  
  if (reason) {
    this.last_error = reason;
    this.last_error_at = new Date();
  }
  
  // Update statistics
  const stats = this.statistics || {};
  stats.connection_drops = (stats.connection_drops || 0) + 1;
  this.statistics = stats;
  
  await this.save();
  
  logger.info('Instance disconnected:', {
    instanceId: this.id,
    reason
  });
};

/**
 * Increment message sent
 */
Instance.prototype.incrementMessageSent = async function() {
  const stats = this.statistics || {};
  stats.messages_sent = (stats.messages_sent || 0) + 1;
  stats.last_message_at = new Date();
  this.statistics = stats;
  
  // Update quota
  const quota = this.quota || {};
  quota.daily_messages = (quota.daily_messages || 0) + 1;
  quota.monthly_messages = (quota.monthly_messages || 0) + 1;
  this.quota = quota;
  
  await this.save();
};

/**
 * Increment message received
 */
Instance.prototype.incrementMessageReceived = async function() {
  const stats = this.statistics || {};
  stats.messages_received = (stats.messages_received || 0) + 1;
  stats.last_message_at = new Date();
  this.statistics = stats;
  
  await this.save();
};

/**
 * Increment message failed
 */
Instance.prototype.incrementMessageFailed = async function() {
  const stats = this.statistics || {};
  stats.messages_failed = (stats.messages_failed || 0) + 1;
  this.statistics = stats;
  
  await this.save();
};

/**
 * Check daily quota
 */
Instance.prototype.checkDailyQuota = function() {
  const quota = this.quota || {};
  const dailyMessages = quota.daily_messages || 0;
  const dailyLimit = quota.daily_limit || 1000;
  
  return {
    used: dailyMessages,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - dailyMessages),
    exceeded: dailyMessages >= dailyLimit
  };
};

/**
 * Reset daily quota
 */
Instance.prototype.resetDailyQuota = async function() {
  const quota = this.quota || {};
  quota.daily_messages = 0;
  quota.last_reset = new Date();
  this.quota = quota;
  
  await this.save();
  
  logger.info('Daily quota reset:', { instanceId: this.id });
};

/**
 * Update settings
 */
Instance.prototype.updateSettings = async function(newSettings) {
  this.settings = {
    ...this.settings,
    ...newSettings
  };
  
  await this.save();
  
  logger.info('Instance settings updated:', {
    instanceId: this.id,
    settings: newSettings
  });
};

/**
 * Log error
 */
Instance.prototype.logError = async function(error) {
  this.last_error = error.message || error;
  this.last_error_at = new Date();
  this.error_count += 1;
  
  await this.save();
  
  logger.error('Instance error:', {
    instanceId: this.id,
    error
  });
};

/**
 * Get safe object (without sensitive data)
 */
Instance.prototype.toSafeObject = function() {
  const { api_key, ...safeData } = this.get({ plain: true });
  return safeData;
};

/**
 * Class Methods
 */

/**
 * Find instance by instance name
 */
Instance.findByInstanceName = async function(instanceName) {
  try {
    return await Instance.findOne({
      where: { instance_name: instanceName }
    });
  } catch (error) {
    logger.error('Error finding instance by name:', error);
    throw error;
  }
};

/**
 * Find user instances
 */
Instance.findByUserId = async function(userId, options = {}) {
  try {
    return await Instance.findAll({
      where: { user_id: userId },
      order: options.order || [['created_at', 'DESC']],
      ...options
    });
  } catch (error) {
    logger.error('Error finding user instances:', error);
    throw error;
  }
};

/**
 * Count user instances
 */
Instance.countUserInstances = async function(userId, status = null) {
  try {
    const where = { user_id: userId };
    
    if (status) {
      where.status = status;
    }
    
    return await Instance.count({ where });
  } catch (error) {
    logger.error('Error counting user instances:', error);
    throw error;
  }
};

/**
 * Get instances needing reconnection
 */
Instance.findNeedingReconnection = async function() {
  try {
    return await Instance.findAll({
      where: {
        status: 'disconnected',
        auto_reconnect: true,
        reconnect_attempts: {
          [Sequelize.Op.lt]: 5
        }
      }
    });
  } catch (error) {
    logger.error('Error finding instances needing reconnection:', error);
    throw error;
  }
};

/**
 * Get instances with expired QR codes
 */
Instance.findWithExpiredQR = async function() {
  try {
    return await Instance.findAll({
      where: {
        status: 'waiting_qr',
        qr_code_expires_at: {
          [Sequelize.Op.lt]: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Error finding instances with expired QR:', error);
    throw error;
  }
};

/**
 * Get instance statistics
 */
Instance.getStatistics = async function(instanceId) {
  try {
    const instance = await Instance.findByPk(instanceId);
    
    if (!instance) {
      return null;
    }
    
    const [messageStats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(created_at) as last_message
      FROM message_logs
      WHERE instance_id = :instanceId
    `, {
      replacements: { instanceId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return {
      ...instance.statistics,
      messages: messageStats[0]
    };
  } catch (error) {
    logger.error('Error getting instance statistics:', error);
    throw error;
  }
};

module.exports = Instance;
