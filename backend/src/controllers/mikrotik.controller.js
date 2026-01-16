/**
 * Mikrotik Webhook Controller
 */

const db = require('../config/database');
const notificationService = require('../services/notification.service');
const crypto = require('crypto');

class MikrotikWebhookController {
  async handleWebhook(req, res) {
    try {
      const { token } = req.params;
      const eventData = req.body;

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

      // Validate event data
      if (!eventData.event) {
        return res.status(400).json({
          success: false,
          error: 'Missing event type',
        });
      }

      // Log event
      const mikrotikEvent = await db.MikrotikEvent.create({
        user_id: user.id,
        event_type: eventData.event,
        router_name: eventData.router,
        username: eventData.user,
        ip_address: eventData.ip,
        mac_address: eventData.mac,
        event_data: eventData,
      });

      // Route to handler
      let result;
      switch (eventData.event) {
        case 'pppoe_login':
          result = await this.handlePPPoELogin(user.id, eventData, mikrotikEvent.id);
          break;
        case 'pppoe_logout':
          result = await this.handlePPPoELogout(user.id, eventData, mikrotikEvent.id);
          break;
        case 'interface_down':
          result = await this.handleInterfaceDown(user.id, eventData, mikrotikEvent.id);
          break;
        case 'interface_up':
          result = await this.handleInterfaceUp(user.id, eventData, mikrotikEvent.id);
          break;
        case 'high_cpu':
          result = await this.handleHighCPU(user.id, eventData, mikrotikEvent.id);
          break;
        case 'high_memory':
          result = await this.handleHighMemory(user.id, eventData, mikrotikEvent.id);
          break;
        default:
          result = { success: false, error: 'Unknown event type' };
      }

      // Update event with notification result
      if (result.success) {
        await mikrotikEvent.update({
          message_sent: true,
          message_id: result.messageId,
        });
      }

      res.json({
        success: true,
        event_id: mikrotikEvent.id,
        message_sent: result.success,
      });
    } catch (error) {
      console.error('Mikrotik webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async handlePPPoELogin(userId, data, eventId) {
    try {
      const variables = {
        user: data.user,
        ip: data.ip,
        mac: data.mac,
        router: data.router,
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'pppoe_login',
        variables
      );
    } catch (error) {
      console.error('Handle PPPoE login error:', error);
      return { success: false, error: error.message };
    }
  }

  async handlePPPoELogout(userId, data, eventId) {
    try {
      // Format bandwidth
      const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const kb = bytes / 1024;
        const mb = kb / 1024;
        const gb = mb / 1024;
        
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        if (mb >= 1) return `${mb.toFixed(2)} MB`;
        if (kb >= 1) return `${kb.toFixed(2)} KB`;
        return `${bytes} B`;
      };

      const variables = {
        user: data.user,
        ip: data.ip,
        uptime: data.uptime || 'N/A',
        download: formatBytes(data.download),
        upload: formatBytes(data.upload),
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'pppoe_logout',
        variables
      );
    } catch (error) {
      console.error('Handle PPPoE logout error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleInterfaceDown(userId, data, eventId) {
    try {
      const variables = {
        interface: data.interface,
        router: data.router,
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'interface_down',
        variables
      );
    } catch (error) {
      console.error('Handle interface down error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleInterfaceUp(userId, data, eventId) {
    try {
      const variables = {
        interface: data.interface,
        router: data.router,
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'interface_up',
        variables
      );
    } catch (error) {
      console.error('Handle interface up error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleHighCPU(userId, data, eventId) {
    try {
      const variables = {
        cpu: data.cpu,
        router: data.router,
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'high_cpu',
        variables
      );
    } catch (error) {
      console.error('Handle high CPU error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleHighMemory(userId, data, eventId) {
    try {
      const variables = {
        memory_percent: data.memory_percent,
        router: data.router,
        time: data.time,
      };

      return await notificationService.sendMikrotikAlert(
        userId,
        'high_memory',
        variables
      );
    } catch (error) {
      console.error('Handle high memory error:', error);
      return { success: false, error: error.message };
    }
  }

  async getMikrotikEvents(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, event_type, router } = req.query;

      const where = { user_id: userId };
      if (event_type) where.event_type = event_type;
      if (router) where.router_name = router;

      const events = await db.MikrotikEvent.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: {
          events: events.rows,
          pagination: {
            total: events.count,
            limit: parseInt(limit),
            offset: parseInt(offset),
          },
        },
      });
    } catch (error) {
      console.error('Get Mikrotik events error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async generateScript(req, res) {
    try {
      const userId = req.user.id;
      const { instance_id } = req.query;

      // Generate or get webhook token
      let user = await db.User.findByPk(userId);
      if (!user.webhook_token) {
        user.webhook_token = crypto.randomBytes(32).toString('hex');
        await user.save();
      }

      const mikrotikService = require('../services/mikrotik.service');
      const script = mikrotikService.generateScriptForRouter(
        userId,
        instance_id,
        user.webhook_token
      );

      res.json({
        success: true,
        data: {
          script,
          webhook_url: `${process.env.APP_URL}/api/v1/webhooks/mikrotik/${user.webhook_token}`,
        },
      });
    } catch (error) {
      console.error('Generate script error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new MikrotikWebhookController();
