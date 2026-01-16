/**
 * Bulk Message Queue Service
 * Process bulk message sending using BullMQ
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('../config/database');
const evolutionApiService = require('./evolutionApi.service');
const csvService = require('./csv.service');
const logger = require('../config/logger');

// Create Redis connection
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Create queue
const bulkMessageQueue = new Queue('bulk-messages', { connection });

// Worker to process bulk messages
const bulkMessageWorker = new Worker(
  'bulk-messages',
  async (job) => {
    const { bulkMessageId, userId, instanceId, recipients, template, delay } = job.data;

    logger.info(`Processing bulk message job: ${bulkMessageId}`);

    try {
      // Get instance
      const instance = await db.Instance.findByPk(instanceId);
      if (!instance) {
        throw new Error('Instance not found');
      }

      // Check instance status
      if (instance.status !== 'connected') {
        throw new Error('Instance is not connected');
      }

      // Update bulk message status
      await db.sequelize.query(`
        UPDATE bulk_messages 
        SET status = 'processing', started_at = NOW()
        WHERE id = $1
      `, {
        bind: [bulkMessageId],
        type: db.Sequelize.QueryTypes.UPDATE,
      });

      let sent = 0;
      let failed = 0;
      const results = [];

      // Process each recipient
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        try {
          // Update progress
          const progress = ((i + 1) / recipients.length) * 100;
          await job.updateProgress(progress);

          // Replace template variables
          const message = csvService.replaceVariables(template, recipient);

          // Send message
          const result = await evolutionApiService.sendTextMessage(
            instance.name,
            instance.api_key,
            recipient.phone,
            message
          );

          if (result.success) {
            sent++;
            results.push({
              phone: recipient.phone,
              name: recipient.name,
              status: 'sent',
              messageId: result.messageId,
              timestamp: new Date(),
            });
          } else {
            failed++;
            results.push({
              phone: recipient.phone,
              name: recipient.name,
              status: 'failed',
              error: result.error,
              timestamp: new Date(),
            });
          }

          // Log message
          await db.sequelize.query(`
            INSERT INTO message_logs (
              id, user_id, instance_id, direction, to_number, 
              message_content, status, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, 'outbound', $3, $4, $5, NOW(), NOW()
            )
          `, {
            bind: [
              userId,
              instanceId,
              recipient.phone,
              message,
              result.success ? 'sent' : 'failed',
            ],
            type: db.Sequelize.QueryTypes.INSERT,
          });

          // Update bulk message progress
          await db.sequelize.query(`
            UPDATE bulk_messages 
            SET sent_count = $1, failed_count = $2, progress = $3, results = $4
            WHERE id = $5
          `, {
            bind: [sent, failed, progress, JSON.stringify(results), bulkMessageId],
            type: db.Sequelize.QueryTypes.UPDATE,
          });

          // Delay before next message
          if (i < recipients.length - 1 && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (error) {
          failed++;
          logger.error(`Failed to send to ${recipient.phone}:`, error);
          
          results.push({
            phone: recipient.phone,
            name: recipient.name,
            status: 'failed',
            error: error.message,
            timestamp: new Date(),
          });
        }
      }

      // Mark as completed
      await db.sequelize.query(`
        UPDATE bulk_messages 
        SET status = 'completed', 
            sent_count = $1, 
            failed_count = $2, 
            progress = 100,
            completed_at = NOW(),
            results = $3
        WHERE id = $4
      `, {
        bind: [sent, failed, JSON.stringify(results), bulkMessageId],
        type: db.Sequelize.QueryTypes.UPDATE,
      });

      logger.info(`Bulk message completed: ${bulkMessageId} - Sent: ${sent}, Failed: ${failed}`);

      return {
        bulkMessageId,
        sent,
        failed,
        total: recipients.length,
      };

    } catch (error) {
      logger.error(`Bulk message job failed: ${bulkMessageId}`, error);

      // Mark as failed
      await db.sequelize.query(`
        UPDATE bulk_messages 
        SET status = 'failed', 
            error_message = $1,
            completed_at = NOW()
        WHERE id = $2
      `, {
        bind: [error.message, bulkMessageId],
        type: db.Sequelize.QueryTypes.UPDATE,
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // Process 3 bulk jobs simultaneously
    limiter: {
      max: 5, // Max 5 jobs
      duration: 1000, // per second
    },
  }
);

// Event handlers
bulkMessageWorker.on('completed', (job, returnvalue) => {
  logger.info(`Bulk message job completed:`, returnvalue);
});

bulkMessageWorker.on('failed', (job, error) => {
  logger.error(`Bulk message job failed:`, error);
});

bulkMessageWorker.on('progress', (job, progress) => {
  logger.info(`Job ${job.id} progress: ${progress}%`);
});

// Function to add job to queue
async function addBulkMessageJob(bulkMessageData) {
  const job = await bulkMessageQueue.add(
    'send-bulk',
    bulkMessageData,
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep for 7 days
      },
    }
  );

  return job.id;
}

// Function to get job status
async function getBulkMessageStatus(jobId) {
  const job = await bulkMessageQueue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: jobId,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
  };
}

// Function to cancel job
async function cancelBulkMessage(jobId) {
  const job = await bulkMessageQueue.getJob(jobId);
  
  if (!job) {
    return false;
  }

  await job.remove();
  return true;
}

module.exports = {
  bulkMessageQueue,
  bulkMessageWorker,
  addBulkMessageJob,
  getBulkMessageStatus,
  cancelBulkMessage,
};
