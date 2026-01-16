const Instance = require('../models/Instance');
const MessageLog = require('../models/MessageLog');
const evolutionApi = require('../services/evolutionApi.service');
const logger = require('../config/logger');
const { AppError, NotFoundError, QuotaExceededError } = require('../utils/errors');

/**
 * Message Controller
 * Handles message sending and management
 */

/**
 * Send text message
 * @route POST /api/v1/messages/send
 */
const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { instance_id, to, message, quoted_message_id } = req.body;
    
    // Find instance
    const instance = await Instance.findOne({
      where: { id: instance_id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', instance_id);
    }
    
    // Check if connected
    if (!instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Check daily quota
    const quota = instance.checkDailyQuota();
    if (quota.exceeded) {
      throw new QuotaExceededError('daily messages', quota.used, quota.limit);
    }
    
    // Create message log
    const messageLog = await MessageLog.createOutbound({
      userId,
      instanceId: instance.id,
      toNumber: to,
      messageType: 'text',
      messageContent: message,
      fromNumber: instance.phone_number
    });
    
    try {
      // Send via Evolution API
      const response = await evolutionApi.sendTextMessage(
        instance.instance_name,
        to,
        message
      );
      
      // Update message log
      await messageLog.markAsSent(response.message.id);
      
      // Update instance statistics
      await instance.incrementMessageSent();
      
      logger.info('Message sent successfully:', {
        instanceId: instance.id,
        to,
        messageId: response.message.id
      });
      
      res.json({
        success: true,
        message: 'Message sent successfully',
        data: {
          message_id: response.message.id,
          log_id: messageLog.id,
          quota: instance.checkDailyQuota()
        }
      });
    } catch (error) {
      // Mark as failed
      await messageLog.markAsFailed(error);
      await instance.incrementMessageFailed();
      
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Send media message
 * @route POST /api/v1/messages/send-media
 */
const sendMediaMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { instance_id, to, media_url, caption, media_type } = req.body;
    
    // Find instance
    const instance = await Instance.findOne({
      where: { id: instance_id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', instance_id);
    }
    
    if (!instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Check quota
    const quota = instance.checkDailyQuota();
    if (quota.exceeded) {
      throw new QuotaExceededError('daily messages', quota.used, quota.limit);
    }
    
    // Create message log
    const messageLog = await MessageLog.createOutbound({
      userId,
      instanceId: instance.id,
      toNumber: to,
      messageType: media_type || 'image',
      messageContent: caption,
      mediaUrl: media_url,
      caption,
      fromNumber: instance.phone_number
    });
    
    try {
      // Send via Evolution API
      const response = await evolutionApi.sendMediaMessage(
        instance.instance_name,
        to,
        media_url,
        caption,
        media_type
      );
      
      await messageLog.markAsSent(response.message.id);
      await instance.incrementMessageSent();
      
      res.json({
        success: true,
        message: 'Media message sent successfully',
        data: {
          message_id: response.message.id,
          log_id: messageLog.id
        }
      });
    } catch (error) {
      await messageLog.markAsFailed(error);
      await instance.incrementMessageFailed();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Send group message
 * @route POST /api/v1/messages/send-group
 */
const sendGroupMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { instance_id, group_id, message } = req.body;
    
    const instance = await Instance.findOne({
      where: { id: instance_id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', instance_id);
    }
    
    if (!instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Create message log
    const messageLog = await MessageLog.createOutbound({
      userId,
      instanceId: instance.id,
      toNumber: null,
      messageType: 'text',
      messageContent: message,
      fromNumber: instance.phone_number,
      isGroup: true,
      groupId: group_id
    });
    
    try {
      // Send via Evolution API
      const response = await evolutionApi.sendGroupMessage(
        instance.instance_name,
        group_id,
        message
      );
      
      await messageLog.markAsSent(response.message.id);
      await instance.incrementMessageSent();
      
      res.json({
        success: true,
        message: 'Group message sent successfully',
        data: {
          message_id: response.message.id,
          log_id: messageLog.id
        }
      });
    } catch (error) {
      await messageLog.markAsFailed(error);
      await instance.incrementMessageFailed();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages
 * @route GET /api/v1/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      instance_id,
      direction,
      status,
      message_type,
      is_group,
      search,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;
    
    const options = {
      instanceId: instance_id,
      direction,
      status,
      messageType: message_type,
      isGroup: is_group === 'true',
      search,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    const result = await MessageLog.findUserMessages(userId, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single message
 * @route GET /api/v1/messages/:id
 */
const getMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const message = await MessageLog.findOne({
      where: { id, user_id: userId }
    });
    
    if (!message) {
      throw new NotFoundError('Message', id);
    }
    
    res.json({
      success: true,
      data: {
        message: message.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message statistics
 * @route GET /api/v1/messages/statistics
 */
const getMessageStatistics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date, days = 7 } = req.query;
    
    let timeRange = {};
    
    if (start_date && end_date) {
      timeRange = {
        start: new Date(start_date),
        end: new Date(end_date)
      };
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      
      timeRange = {
        start: startDate,
        end: endDate
      };
    }
    
    const [statistics, dailyStats] = await Promise.all([
      MessageLog.getStatistics(userId, timeRange),
      MessageLog.getDailyStats(userId, parseInt(days))
    ]);
    
    res.json({
      success: true,
      data: {
        statistics,
        daily_stats: dailyStats,
        time_range: timeRange
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retry failed message
 * @route POST /api/v1/messages/:id/retry
 */
const retryMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const messageLog = await MessageLog.findOne({
      where: { id, user_id: userId }
    });
    
    if (!messageLog) {
      throw new NotFoundError('Message', id);
    }
    
    if (messageLog.status !== 'failed') {
      throw new AppError('Only failed messages can be retried', 400, 'INVALID_STATUS');
    }
    
    if (messageLog.retry_count >= 3) {
      throw new AppError('Maximum retry attempts reached', 400, 'MAX_RETRIES');
    }
    
    // Get instance
    const instance = await Instance.findByPk(messageLog.instance_id);
    
    if (!instance || !instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Increment retry count
    await messageLog.incrementRetry();
    
    try {
      // Retry sending
      let response;
      
      if (messageLog.media_url) {
        response = await evolutionApi.sendMediaMessage(
          instance.instance_name,
          messageLog.to_number,
          messageLog.media_url,
          messageLog.caption,
          messageLog.message_type
        );
      } else {
        response = await evolutionApi.sendTextMessage(
          instance.instance_name,
          messageLog.to_number,
          messageLog.message_content
        );
      }
      
      // Update status
      await messageLog.markAsSent(response.message.id);
      await instance.incrementMessageSent();
      
      res.json({
        success: true,
        message: 'Message retried successfully',
        data: {
          message_id: response.message.id,
          retry_count: messageLog.retry_count
        }
      });
    } catch (error) {
      await messageLog.markAsFailed(error);
      await instance.incrementMessageFailed();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Delete message
 * @route DELETE /api/v1/messages/:id
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const message = await MessageLog.findOne({
      where: { id, user_id: userId }
    });
    
    if (!message) {
      throw new NotFoundError('Message', id);
    }
    
    message.status = 'deleted';
    await message.save();
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's quota
 * @route GET /api/v1/messages/quota
 */
const getQuota = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { instance_id } = req.query;
    
    if (instance_id) {
      // Get quota for specific instance
      const instance = await Instance.findOne({
        where: { id: instance_id, user_id: userId }
      });
      
      if (!instance) {
        throw new NotFoundError('Instance', instance_id);
      }
      
      res.json({
        success: true,
        data: {
          quota: instance.checkDailyQuota(),
          instance_id: instance.id,
          instance_name: instance.name
        }
      });
    } else {
      // Get quota for all instances
      const instances = await Instance.findByUserId(userId);
      
      const quotas = instances.map(instance => ({
        instance_id: instance.id,
        instance_name: instance.name,
        quota: instance.checkDailyQuota()
      }));
      
      const totalUsed = quotas.reduce((sum, q) => sum + q.quota.used, 0);
      const totalLimit = quotas.reduce((sum, q) => sum + q.quota.limit, 0);
      
      res.json({
        success: true,
        data: {
          total: {
            used: totalUsed,
            limit: totalLimit,
            remaining: totalLimit - totalUsed
          },
          instances: quotas
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  sendMediaMessage,
  sendGroupMessage,
  getMessages,
  getMessage,
  getMessageStatistics,
  retryMessage,
  deleteMessage,
  getQuota
};
