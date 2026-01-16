const cron = require('node-cron');
const MessageLog = require('../models/MessageLog');
const Instance = require('../models/Instance');
const evolutionApi = require('../services/evolutionApi.service');
const logger = require('../config/logger');

/**
 * Message Queue Job
 * Handles message retry and quota reset
 */

class MessageQueueJob {
  constructor() {
    this.retryJob = null;
    this.quotaResetJob = null;
    this.cleanupJob = null;
  }
  
  /**
   * Start all jobs
   */
  start() {
    this.startRetryJob();
    this.startQuotaResetJob();
    this.startCleanupJob();
    
    logger.info('Message queue jobs started');
  }
  
  /**
   * Stop all jobs
   */
  stop() {
    if (this.retryJob) {
      this.retryJob.stop();
    }
    
    if (this.quotaResetJob) {
      this.quotaResetJob.stop();
    }
    
    if (this.cleanupJob) {
      this.cleanupJob.stop();
    }
    
    logger.info('Message queue jobs stopped');
  }
  
  /**
   * Retry failed messages
   * Runs every 15 minutes
   */
  startRetryJob() {
    this.retryJob = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.retryFailedMessages();
      } catch (error) {
        logger.error('Message retry job error:', error);
      }
    });
  }
  
  /**
   * Reset daily quota
   * Runs daily at midnight
   */
  startQuotaResetJob() {
    this.quotaResetJob = cron.schedule('0 0 * * *', async () => {
      try {
        await this.resetDailyQuotas();
      } catch (error) {
        logger.error('Quota reset job error:', error);
      }
    });
  }
  
  /**
   * Cleanup old messages
   * Runs weekly on Sunday at 2 AM
   */
  startCleanupJob() {
    this.cleanupJob = cron.schedule('0 2 * * 0', async () => {
      try {
        await this.cleanupOldMessages();
      } catch (error) {
        logger.error('Message cleanup job error:', error);
      }
    });
  }
  
  /**
   * Retry failed messages
   */
  async retryFailedMessages() {
    try {
      const failedMessages = await MessageLog.findFailedForRetry(3);
      
      if (failedMessages.length === 0) {
        logger.debug('No failed messages to retry');
        return;
      }
      
      logger.info(`Retrying ${failedMessages.length} failed messages`);
      
      let retried = 0;
      let failed = 0;
      
      for (const message of failedMessages) {
        try {
          // Get instance
          const instance = await Instance.findByPk(message.instance_id);
          
          if (!instance || !instance.isConnected()) {
            logger.debug('Instance not connected, skipping message:', {
              messageId: message.id,
              instanceId: message.instance_id
            });
            continue;
          }
          
          // Increment retry count
          await message.incrementRetry();
          
          // Retry sending
          let response;
          
          if (message.media_url) {
            response = await evolutionApi.sendMediaMessage(
              instance.instance_name,
              message.to_number,
              message.media_url,
              message.caption,
              message.message_type
            );
          } else if (message.is_group) {
            response = await evolutionApi.sendGroupMessage(
              instance.instance_name,
              message.group_id,
              message.message_content
            );
          } else {
            response = await evolutionApi.sendTextMessage(
              instance.instance_name,
              message.to_number,
              message.message_content
            );
          }
          
          // Update status
          await message.markAsSent(response.message.id);
          await instance.incrementMessageSent();
          
          retried++;
          
          logger.info('Message retried successfully:', {
            messageId: message.id,
            retryCount: message.retry_count
          });
        } catch (error) {
          failed++;
          
          await message.markAsFailed(error);
          
          logger.error('Failed to retry message:', {
            messageId: message.id,
            error: error.message
          });
        }
      }
      
      logger.info('Message retry completed:', {
        total: failedMessages.length,
        retried,
        failed
      });
    } catch (error) {
      logger.error('Failed to retry messages:', error);
    }
  }
  
  /**
   * Reset daily quotas for all instances
   */
  async resetDailyQuotas() {
    try {
      const instances = await Instance.findAll();
      
      logger.info(`Resetting daily quotas for ${instances.length} instances`);
      
      let resetCount = 0;
      
      for (const instance of instances) {
        try {
          await instance.resetDailyQuota();
          resetCount++;
        } catch (error) {
          logger.error('Failed to reset quota for instance:', {
            instanceId: instance.id,
            error: error.message
          });
        }
      }
      
      logger.info(`Daily quota reset completed: ${resetCount} instances`);
    } catch (error) {
      logger.error('Failed to reset daily quotas:', error);
    }
  }
  
  /**
   * Cleanup old messages
   */
  async cleanupOldMessages() {
    try {
      const retentionDays = process.env.MESSAGE_RETENTION_DAYS || 90;
      
      logger.info(`Cleaning up messages older than ${retentionDays} days`);
      
      const deleted = await MessageLog.deleteOldMessages(retentionDays);
      
      logger.info(`Cleanup completed: ${deleted} messages deleted`);
    } catch (error) {
      logger.error('Failed to cleanup old messages:', error);
    }
  }
  
  /**
   * Get job status
   */
  getStatus() {
    return {
      retry_job: this.retryJob ? 'running' : 'stopped',
      quota_reset_job: this.quotaResetJob ? 'running' : 'stopped',
      cleanup_job: this.cleanupJob ? 'running' : 'stopped'
    };
  }
}

// Export singleton
module.exports = new MessageQueueJob();
