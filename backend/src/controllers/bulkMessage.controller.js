/**
 * Bulk Message Controller
 * Handle bulk message operations
 */

const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csvService = require('../services/csv.service');
const bulkMessageService = require('../services/bulkMessage.service');
const subscriptionService = require('../services/subscription.service');
const logger = require('../config/logger');

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/csv');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bulk-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

class BulkMessageController {
  // Upload and parse CSV
  async uploadCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const filePath = req.file.path;

      // Parse CSV
      const result = await csvService.parseCSV(filePath);

      // Store in session for preview (in production, use Redis)
      req.session = req.session || {};
      req.session.csvData = {
        filePath,
        data: result.data,
        errors: result.errors,
        stats: {
          total: result.total,
          valid: result.valid,
          invalid: result.invalid,
          duplicates: result.duplicates,
        },
        uploadedAt: new Date(),
      };

      res.json({
        success: true,
        data: {
          stats: {
            total: result.total,
            valid: result.valid,
            invalid: result.invalid,
            duplicates: result.duplicates,
          },
          preview: result.data.slice(0, 5), // First 5 records
          errors: result.errors.slice(0, 10), // First 10 errors
        },
      });

      // Clean up file after 1 hour
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 60 * 60 * 1000);

    } catch (error) {
      logger.error('Upload CSV error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Send bulk messages
  async sendBulk(req, res) {
    try {
      const userId = req.user.id;
      const { instance_id, template, batch_name, delay, recipients } = req.body;

      // Validate input
      if (!instance_id || !template || !recipients || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Check instance ownership
      const instance = await db.Instance.findOne({
        where: {
          id: instance_id,
          user_id: userId,
          status: 'connected',
        },
      });

      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Instance not found or not connected',
        });
      }

      // Check quota
      const totalMessages = recipients.length;
      const canSend = await subscriptionService.canPerformAction(
        userId,
        'send_messages',
        totalMessages
      );

      if (!canSend) {
        return res.status(403).json({
          success: false,
          error: 'Message quota exceeded. Please upgrade your subscription.',
        });
      }

      // Validate template
      const templateValidation = csvService.validateTemplate(template, recipients);
      if (!templateValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Template validation failed',
          details: {
            missingVars: templateValidation.missingVars,
          },
        });
      }

      // Create bulk message record
      const [bulkMessage] = await db.sequelize.query(`
        INSERT INTO bulk_messages (
          id, user_id, instance_id, batch_name, template, 
          total_recipients, status, delay_ms, recipients, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), NOW()
        ) RETURNING *
      `, {
        bind: [
          userId,
          instance_id,
          batch_name || `Bulk ${new Date().toISOString()}`,
          template,
          totalMessages,
          delay || 2000,
          JSON.stringify(recipients),
        ],
        type: db.Sequelize.QueryTypes.INSERT,
      });

      const bulkMessageId = bulkMessage[0].id;

      // Add to queue
      const jobId = await bulkMessageService.addBulkMessageJob({
        bulkMessageId,
        userId,
        instanceId: instance_id,
        recipients,
        template,
        delay: delay || 2000,
      });

      logger.info(`Bulk message queued: ${bulkMessageId}, Job: ${jobId}`);

      res.json({
        success: true,
        data: {
          bulk_message_id: bulkMessageId,
          job_id: jobId,
          total_recipients: totalMessages,
          status: 'queued',
        },
        message: 'Bulk message queued successfully',
      });

    } catch (error) {
      logger.error('Send bulk error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get batch status
  async getBatchStatus(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const [bulkMessage] = await db.sequelize.query(`
        SELECT * FROM bulk_messages 
        WHERE id = $1 AND user_id = $2
      `, {
        bind: [batchId, userId],
        type: db.Sequelize.QueryTypes.SELECT,
      });

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          error: 'Batch not found',
        });
      }

      res.json({
        success: true,
        data: bulkMessage,
      });

    } catch (error) {
      logger.error('Get batch status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get batch history
  async getBatchHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const [batches, countResult] = await Promise.all([
        db.sequelize.query(`
          SELECT 
            bm.*,
            i.name as instance_name
          FROM bulk_messages bm
          LEFT JOIN instances i ON bm.instance_id = i.id
          WHERE bm.user_id = $1
          ORDER BY bm.created_at DESC
          LIMIT $2 OFFSET $3
        `, {
          bind: [userId, parseInt(limit), parseInt(offset)],
          type: db.Sequelize.QueryTypes.SELECT,
        }),
        db.sequelize.query(`
          SELECT COUNT(*) as count FROM bulk_messages WHERE user_id = $1
        `, {
          bind: [userId],
          type: db.Sequelize.QueryTypes.SELECT,
        }),
      ]);

      res.json({
        success: true,
        data: {
          batches,
          pagination: {
            total: parseInt(countResult[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });

    } catch (error) {
      logger.error('Get batch history error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get batch details with results
  async getBatchDetails(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const [bulkMessage] = await db.sequelize.query(`
        SELECT 
          bm.*,
          i.name as instance_name
        FROM bulk_messages bm
        LEFT JOIN instances i ON bm.instance_id = i.id
        WHERE bm.id = $1 AND bm.user_id = $2
      `, {
        bind: [batchId, userId],
        type: db.Sequelize.QueryTypes.SELECT,
      });

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          error: 'Batch not found',
        });
      }

      res.json({
        success: true,
        data: bulkMessage,
      });

    } catch (error) {
      logger.error('Get batch details error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Cancel batch
  async cancelBatch(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const [bulkMessage] = await db.sequelize.query(`
        SELECT * FROM bulk_messages 
        WHERE id = $1 AND user_id = $2
      `, {
        bind: [batchId, userId],
        type: db.Sequelize.QueryTypes.SELECT,
      });

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          error: 'Batch not found',
        });
      }

      if (bulkMessage.status === 'completed' || bulkMessage.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: 'Batch cannot be cancelled',
        });
      }

      // Update status
      await db.sequelize.query(`
        UPDATE bulk_messages 
        SET status = 'cancelled', completed_at = NOW()
        WHERE id = $1
      `, {
        bind: [batchId],
        type: db.Sequelize.QueryTypes.UPDATE,
      });

      // Try to cancel job in queue
      // Note: This might not stop already processing messages
      await bulkMessageService.cancelBulkMessage(batchId);

      res.json({
        success: true,
        message: 'Batch cancelled successfully',
      });

    } catch (error) {
      logger.error('Cancel batch error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Download sample CSV
  async downloadSample(req, res) {
    try {
      const csv = csvService.generateSampleCSV();
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bulk-message-sample.csv');
      res.send(csv);

    } catch (error) {
      logger.error('Download sample error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Export results
  async exportResults(req, res) {
    try {
      const { batchId } = req.params;
      const userId = req.user.id;

      const [bulkMessage] = await db.sequelize.query(`
        SELECT * FROM bulk_messages 
        WHERE id = $1 AND user_id = $2
      `, {
        bind: [batchId, userId],
        type: db.Sequelize.QueryTypes.SELECT,
      });

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          error: 'Batch not found',
        });
      }

      // Generate CSV from results
      const results = bulkMessage.results || [];
      let csv = 'Phone,Name,Status,Message ID,Error,Timestamp\n';
      
      results.forEach(result => {
        csv += `${result.phone},"${result.name || ''}",${result.status},${result.messageId || ''},"${result.error || ''}",${result.timestamp}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=bulk-results-${batchId}.csv`);
      res.send(csv);

    } catch (error) {
      logger.error('Export results error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// Export controller and multer upload
const controller = new BulkMessageController();

module.exports = {
  controller,
  upload,
};
