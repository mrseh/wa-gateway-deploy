/**
 * Zabbix Webhook Controller
 * Handles Zabbix monitoring alerts via webhook
 */

const db = require('../config/database');
const notificationService = require('../services/notification.service');
const logger = require('../config/logger');

class ZabbixWebhookController {
  async handleWebhook(req, res) {
    try {
      const { token } = req.params;
      const zabbixData = req.body;

      // Validate token
      const user = await db.User.findOne({
        where: { webhook_token: token },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook token',
        });
      }

      logger.info('Zabbix webhook received', {
        userId: user.id,
        eventId: zabbixData.event_id,
        triggerName: zabbixData.trigger_name,
      });

      // Parse and validate Zabbix data
      if (!zabbixData.trigger_name) {
        return res.status(400).json({
          success: false,
          error: 'Missing trigger_name',
        });
      }

      // Determine event type
      let eventType;
      if (zabbixData.status === 'PROBLEM') {
        eventType = 'problem';
      } else if (zabbixData.status === 'OK' || zabbixData.status === 'RESOLVED') {
        eventType = 'recovery';
      } else {
        eventType = 'update';
      }

      // Log event to database
      const zabbixEvent = await db.sequelize.query(`
        INSERT INTO zabbix_events (
          id, user_id, event_id, trigger_name, host_name, 
          severity, status, item_value, event_time, event_data, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        ) RETURNING *
      `, {
        bind: [
          user.id,
          zabbixData.event_id || '',
          zabbixData.trigger_name,
          zabbixData.host || zabbixData.host_name || 'Unknown',
          zabbixData.severity || 'not_classified',
          zabbixData.status || 'UNKNOWN',
          zabbixData.item_value || zabbixData.value || '',
          zabbixData.event_time || new Date().toISOString(),
          JSON.stringify(zabbixData),
        ],
        type: db.Sequelize.QueryTypes.INSERT,
      });

      // Route to handler based on event type
      let result;
      if (eventType === 'problem') {
        result = await this.handleProblem(user.id, zabbixData);
      } else if (eventType === 'recovery') {
        result = await this.handleRecovery(user.id, zabbixData);
      } else {
        result = { success: false, error: 'Unknown event type' };
      }

      // Update event with notification result
      if (result.success) {
        await db.sequelize.query(`
          UPDATE zabbix_events 
          SET message_sent = true, message_id = $1, updated_at = NOW()
          WHERE event_id = $2 AND user_id = $3
        `, {
          bind: [result.messageId, zabbixData.event_id, user.id],
          type: db.Sequelize.QueryTypes.UPDATE,
        });
      }

      res.json({
        success: true,
        event_type: eventType,
        message_sent: result.success,
      });

    } catch (error) {
      logger.error('Zabbix webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async handleProblem(userId, data) {
    try {
      // Get severity emoji and color
      const severityMap = {
        'disaster': { emoji: '🔴', priority: 'critical' },
        'high': { emoji: '🔴', priority: 'critical' },
        'average': { emoji: '⚠️', priority: 'warning' },
        'warning': { emoji: '⚠️', priority: 'warning' },
        'information': { emoji: 'ℹ️', priority: 'info' },
        'not_classified': { emoji: '❓', priority: 'info' },
      };

      const severity = data.severity?.toLowerCase() || 'not_classified';
      const config = severityMap[severity] || severityMap.not_classified;

      // Build message
      const message = `${config.emoji} *ZABBIX ALERT*
━━━━━━━━━━━━━━━
🚨 ${data.trigger_name}
🖥️ Host: ${data.host || data.host_name || 'Unknown'}
📊 Value: ${data.item_value || data.value || 'N/A'}
⚡ Severity: ${severity.toUpperCase()}
⏰ Time: ${data.event_time || new Date().toLocaleString('id-ID')}
━━━━━━━━━━━━━━━
❗ *Action Required!*`;

      // Get user's active instance
      const instance = await db.Instance.findOne({
        where: {
          user_id: userId,
          status: 'connected',
        },
        order: [['created_at', 'DESC']],
      });

      if (!instance) {
        logger.warn(`No active instance for user ${userId}`);
        return { success: false, error: 'No active instance' };
      }

      // Get user phone
      const user = await db.User.findByPk(userId);
      if (!user || !user.phone) {
        logger.warn(`User ${userId} has no phone number`);
        return { success: false, error: 'No phone number' };
      }

      // Send via Evolution API
      const evolutionApiService = require('../services/evolutionApi.service');
      const result = await evolutionApiService.sendTextMessage(
        instance.name,
        instance.api_key,
        user.phone,
        message
      );

      return result;

    } catch (error) {
      logger.error('Handle Zabbix problem error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleRecovery(userId, data) {
    try {
      const duration = data.duration || 'N/A';

      const message = `✅ *PROBLEM RESOLVED*
━━━━━━━━━━━━━━━
✅ ${data.trigger_name}
🖥️ Host: ${data.host || data.host_name || 'Unknown'}
⏱️ Duration: ${duration}
⏰ Time: ${data.event_time || new Date().toLocaleString('id-ID')}
━━━━━━━━━━━━━━━`;

      // Get user's active instance
      const instance = await db.Instance.findOne({
        where: {
          user_id: userId,
          status: 'connected',
        },
        order: [['created_at', 'DESC']],
      });

      if (!instance) {
        return { success: false, error: 'No active instance' };
      }

      // Get user phone
      const user = await db.User.findByPk(userId);
      if (!user || !user.phone) {
        return { success: false, error: 'No phone number' };
      }

      // Send via Evolution API
      const evolutionApiService = require('../services/evolutionApi.service');
      const result = await evolutionApiService.sendTextMessage(
        instance.name,
        instance.api_key,
        user.phone,
        message
      );

      return result;

    } catch (error) {
      logger.error('Handle Zabbix recovery error:', error);
      return { success: false, error: error.message };
    }
  }

  async getZabbixEvents(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, severity, status } = req.query;

      let whereClause = 'user_id = $1';
      const bindings = [userId];
      let bindIndex = 2;

      if (severity) {
        whereClause += ` AND severity = $${bindIndex}`;
        bindings.push(severity);
        bindIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${bindIndex}`;
        bindings.push(status);
        bindIndex++;
      }

      const [events, countResult] = await Promise.all([
        db.sequelize.query(`
          SELECT * FROM zabbix_events 
          WHERE ${whereClause}
          ORDER BY created_at DESC 
          LIMIT $${bindIndex} OFFSET $${bindIndex + 1}
        `, {
          bind: [...bindings, parseInt(limit), parseInt(offset)],
          type: db.Sequelize.QueryTypes.SELECT,
        }),
        db.sequelize.query(`
          SELECT COUNT(*) as count FROM zabbix_events WHERE ${whereClause}
        `, {
          bind: bindings,
          type: db.Sequelize.QueryTypes.SELECT,
        }),
      ]);

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            total: parseInt(countResult[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });

    } catch (error) {
      logger.error('Get Zabbix events error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getMediaTypeConfig(req, res) {
    try {
      const userId = req.user.id;

      // Generate or get webhook token
      let user = await db.User.findByPk(userId);
      if (!user.webhook_token) {
        const crypto = require('crypto');
        user.webhook_token = crypto.randomBytes(32).toString('hex');
        await user.save();
      }

      const webhookUrl = `${process.env.APP_URL}/api/v1/webhooks/zabbix/${user.webhook_token}`;

      // Zabbix media type configuration (for Zabbix 5.0+)
      const mediaTypeConfig = {
        name: 'WhatsApp Gateway',
        type: 'webhook',
        parameters: [
          { name: 'url', value: webhookUrl },
          { name: 'event_id', value: '{EVENT.ID}' },
          { name: 'trigger_name', value: '{TRIGGER.NAME}' },
          { name: 'host', value: '{HOST.NAME}' },
          { name: 'severity', value: '{TRIGGER.SEVERITY}' },
          { name: 'status', value: '{TRIGGER.STATUS}' },
          { name: 'item_value', value: '{ITEM.LASTVALUE}' },
          { name: 'event_time', value: '{EVENT.TIME}' },
          { name: 'duration', value: '{EVENT.DURATION}' },
        ],
        script: `var params = JSON.parse(value);
var request = new HttpRequest();
request.addHeader('Content-Type: application/json');

var payload = {
  event_id: params.event_id,
  trigger_name: params.trigger_name,
  host: params.host,
  severity: params.severity,
  status: params.status,
  item_value: params.item_value,
  event_time: params.event_time,
  duration: params.duration
};

var response = request.post('${webhookUrl}', JSON.stringify(payload));

if (request.getStatus() !== 200) {
  throw 'Response code: ' + request.getStatus();
}

return response;`,
      };

      res.json({
        success: true,
        data: {
          webhook_url: webhookUrl,
          media_type_config: mediaTypeConfig,
        },
      });

    } catch (error) {
      logger.error('Get media type config error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new ZabbixWebhookController();
