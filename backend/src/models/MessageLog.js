const { sequelize, Sequelize } = require('../config/database');
const logger = require('../config/logger');

/**
 * MessageLog Model
 * Tracks all messages sent and received through instances
 */

const MessageLog = sequelize.define('MessageLog', {
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
    }
  },
  instance_id: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: 'instances',
      key: 'id'
    }
  },
  message_id: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  direction: {
    type: Sequelize.ENUM('inbound', 'outbound'),
    allowNull: false
  },
  from_number: {
    type: Sequelize.STRING(50),
    allowNull: true
  },
  to_number: {
    type: Sequelize.STRING(50),
    allowNull: true
  },
  message_type: {
    type: Sequelize.ENUM(
      'text',
      'image',
      'video',
      'audio',
      'document',
      'sticker',
      'location',
      'contact',
      'template'
    ),
    defaultValue: 'text',
    allowNull: false
  },
  message_content: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  media_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  media_mime_type: {
    type: Sequelize.STRING(100),
    allowNull: true
  },
  media_size: {
    type: Sequelize.BIGINT,
    allowNull: true
  },
  caption: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  quoted_message_id: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  is_group: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  group_id: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  group_name: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  status: {
    type: Sequelize.ENUM(
      'pending',
      'sent',
      'delivered',
      'read',
      'failed',
      'deleted'
    ),
    defaultValue: 'pending',
    allowNull: false
  },
  error_code: {
    type: Sequelize.STRING(50),
    allowNull: true
  },
  error_message: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  sent_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  delivered_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  read_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  retry_count: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  is_bulk: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  bulk_id: {
    type: Sequelize.UUID,
    allowNull: true
  },
  template_id: {
    type: Sequelize.UUID,
    allowNull: true
  },
  template_variables: {
    type: Sequelize.JSONB,
    defaultValue: {},
    allowNull: false
  },
  cost: {
    type: Sequelize.DECIMAL(10, 4),
    defaultValue: 0,
    allowNull: false
  },
  metadata: {
    type: Sequelize.JSONB,
    defaultValue: {},
    allowNull: false
  }
}, {
  tableName: 'message_logs',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['instance_id'] },
    { fields: ['message_id'] },
    { fields: ['direction'] },
    { fields: ['status'] },
    { fields: ['message_type'] },
    { fields: ['from_number'] },
    { fields: ['to_number'] },
    { fields: ['bulk_id'] },
    { fields: ['group_id'] },
    { fields: ['created_at'] },
    { fields: ['user_id', 'direction', 'status'] },
    { fields: ['instance_id', 'created_at'] }
  ]
});

/**
 * Associations
 */
MessageLog.associate = (models) => {
  MessageLog.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  MessageLog.belongsTo(models.Instance, {
    foreignKey: 'instance_id',
    as: 'instance'
  });
};

/**
 * Instance Methods
 */

/**
 * Mark as sent
 */
MessageLog.prototype.markAsSent = async function(messageId = null) {
  this.status = 'sent';
  this.sent_at = new Date();
  
  if (messageId) {
    this.message_id = messageId;
  }
  
  await this.save();
  
  logger.debug('Message marked as sent:', {
    id: this.id,
    messageId: this.message_id
  });
};

/**
 * Mark as delivered
 */
MessageLog.prototype.markAsDelivered = async function() {
  this.status = 'delivered';
  this.delivered_at = new Date();
  await this.save();
};

/**
 * Mark as read
 */
MessageLog.prototype.markAsRead = async function() {
  this.status = 'read';
  this.read_at = new Date();
  await this.save();
};

/**
 * Mark as failed
 */
MessageLog.prototype.markAsFailed = async function(error) {
  this.status = 'failed';
  this.error_message = error.message || error;
  this.error_code = error.code || 'UNKNOWN_ERROR';
  await this.save();
  
  logger.error('Message marked as failed:', {
    id: this.id,
    error: this.error_message
  });
};

/**
 * Increment retry count
 */
MessageLog.prototype.incrementRetry = async function() {
  this.retry_count += 1;
  await this.save();
};

/**
 * Get safe object
 */
MessageLog.prototype.toSafeObject = function() {
  return this.get({ plain: true });
};

/**
 * Class Methods
 */

/**
 * Create outbound message log
 */
MessageLog.createOutbound = async function(data) {
  try {
    return await MessageLog.create({
      user_id: data.userId,
      instance_id: data.instanceId,
      direction: 'outbound',
      to_number: data.toNumber,
      from_number: data.fromNumber || null,
      message_type: data.messageType || 'text',
      message_content: data.messageContent || null,
      media_url: data.mediaUrl || null,
      caption: data.caption || null,
      is_group: data.isGroup || false,
      group_id: data.groupId || null,
      is_bulk: data.isBulk || false,
      bulk_id: data.bulkId || null,
      metadata: data.metadata || {}
    });
  } catch (error) {
    logger.error('Error creating outbound message log:', error);
    throw error;
  }
};

/**
 * Create inbound message log
 */
MessageLog.createInbound = async function(data) {
  try {
    return await MessageLog.create({
      user_id: data.userId,
      instance_id: data.instanceId,
      message_id: data.messageId,
      direction: 'inbound',
      from_number: data.fromNumber,
      to_number: data.toNumber || null,
      message_type: data.messageType || 'text',
      message_content: data.messageContent || null,
      media_url: data.mediaUrl || null,
      caption: data.caption || null,
      is_group: data.isGroup || false,
      group_id: data.groupId || null,
      group_name: data.groupName || null,
      status: 'delivered',
      sent_at: data.timestamp || new Date(),
      delivered_at: data.timestamp || new Date(),
      metadata: data.metadata || {}
    });
  } catch (error) {
    logger.error('Error creating inbound message log:', error);
    throw error;
  }
};

/**
 * Find message by message ID
 */
MessageLog.findByMessageId = async function(messageId) {
  try {
    return await MessageLog.findOne({
      where: { message_id: messageId }
    });
  } catch (error) {
    logger.error('Error finding message by ID:', error);
    throw error;
  }
};

/**
 * Get user messages
 */
MessageLog.findUserMessages = async function(userId, options = {}) {
  try {
    const where = { user_id: userId };
    
    if (options.instanceId) {
      where.instance_id = options.instanceId;
    }
    
    if (options.direction) {
      where.direction = options.direction;
    }
    
    if (options.status) {
      where.status = options.status;
    }
    
    if (options.messageType) {
      where.message_type = options.messageType;
    }
    
    if (options.isGroup !== undefined) {
      where.is_group = options.isGroup;
    }
    
    if (options.search) {
      where[Sequelize.Op.or] = [
        { message_content: { [Sequelize.Op.iLike]: `%${options.search}%` } },
        { from_number: { [Sequelize.Op.iLike]: `%${options.search}%` } },
        { to_number: { [Sequelize.Op.iLike]: `%${options.search}%` } }
      ];
    }
    
    if (options.startDate && options.endDate) {
      where.created_at = {
        [Sequelize.Op.between]: [options.startDate, options.endDate]
      };
    }
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const { count, rows } = await MessageLog.findAndCountAll({
      where,
      limit,
      offset,
      order: options.order || [['created_at', 'DESC']],
      include: options.include || []
    });
    
    return {
      total: count,
      messages: rows,
      limit,
      offset,
      pages: Math.ceil(count / limit)
    };
  } catch (error) {
    logger.error('Error finding user messages:', error);
    throw error;
  }
};

/**
 * Get message statistics
 */
MessageLog.getStatistics = async function(userId, timeRange = {}) {
  try {
    const where = { user_id: userId };
    
    if (timeRange.start && timeRange.end) {
      where.created_at = {
        [Sequelize.Op.between]: [timeRange.start, timeRange.end]
      };
    }
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as messages_sent,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as messages_received,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN is_group THEN 1 ELSE 0 END) as group_messages,
        COUNT(DISTINCT instance_id) as active_instances,
        MAX(created_at) as last_message_at
      FROM message_logs
      WHERE user_id = :userId
        ${timeRange.start ? 'AND created_at >= :start' : ''}
        ${timeRange.end ? 'AND created_at <= :end' : ''}
    `, {
      replacements: {
        userId,
        start: timeRange.start,
        end: timeRange.end
      },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return stats[0] || {};
  } catch (error) {
    logger.error('Error getting message statistics:', error);
    throw error;
  }
};

/**
 * Get daily message counts
 */
MessageLog.getDailyStats = async function(userId, days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [stats] = await sequelize.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM message_logs
      WHERE user_id = :userId
        AND created_at >= :startDate
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, {
      replacements: { userId, startDate },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return stats;
  } catch (error) {
    logger.error('Error getting daily stats:', error);
    throw error;
  }
};

/**
 * Get failed messages for retry
 */
MessageLog.findFailedForRetry = async function(maxRetries = 3) {
  try {
    return await MessageLog.findAll({
      where: {
        status: 'failed',
        retry_count: {
          [Sequelize.Op.lt]: maxRetries
        },
        created_at: {
          [Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      limit: 100
    });
  } catch (error) {
    logger.error('Error finding failed messages:', error);
    throw error;
  }
};

/**
 * Delete old messages
 */
MessageLog.deleteOldMessages = async function(retentionDays = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const deleted = await MessageLog.destroy({
      where: {
        created_at: {
          [Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    logger.info(`Deleted ${deleted} old messages`);
    return deleted;
  } catch (error) {
    logger.error('Error deleting old messages:', error);
    throw error;
  }
};

module.exports = MessageLog;
