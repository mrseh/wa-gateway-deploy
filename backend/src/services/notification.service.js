/**
 * Notification Service
 */

const db = require('../config/database');
const evolutionApiService = require('./evolutionApi.service');

class NotificationService {
  async sendNotification(userId, templateName, variables) {
    try {
      // Get user's active instance
      const instance = await db.Instance.findOne({
        where: {
          user_id: userId,
          status: 'connected',
        },
        order: [['created_at', 'DESC']],
      });

      if (!instance) {
        console.log(`No active instance for user ${userId}`);
        return { success: false, error: 'No active instance' };
      }

      // Get alert template
      let template = await db.AlertTemplate.findOne({
        where: {
          name: templateName,
          is_active: true,
          [db.Sequelize.Op.or]: [
            { user_id: userId },
            { is_default: true },
          ],
        },
        order: [['user_id', 'DESC']], // User templates have priority
      });

      if (!template) {
        console.log(`Template ${templateName} not found`);
        return { success: false, error: 'Template not found' };
      }

      // Render message
      const message = db.AlertTemplate.render(template.template, variables);

      // Send via Evolution API
      const result = await evolutionApiService.sendTextMessage(
        instance.name,
        instance.api_key,
        variables.phone || instance.user.phone,
        message
      );

      return result;
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMikrotikAlert(userId, eventType, eventData) {
    try {
      const templateMap = {
        pppoe_login: 'pppoe_login',
        pppoe_logout: 'pppoe_logout',
        interface_down: 'interface_down',
        interface_up: 'interface_up',
        high_cpu: 'high_cpu',
        high_memory: 'high_memory',
      };

      const templateName = templateMap[eventType];
      if (!templateName) {
        console.log(`No template for event type: ${eventType}`);
        return { success: false, error: 'Unknown event type' };
      }

      // Get user phone
      const user = await db.User.findByPk(userId);
      if (!user || !user.phone) {
        console.log(`User ${userId} has no phone number`);
        return { success: false, error: 'User has no phone' };
      }

      // Prepare variables
      const variables = {
        ...eventData,
        phone: user.phone,
      };

      return await this.sendNotification(userId, templateName, variables);
    } catch (error) {
      console.error('Send Mikrotik alert error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPONAlert(userId, ponPort, alert) {
    try {
      // Get user phone
      const user = await db.User.findByPk(userId);
      if (!user || !user.phone) {
        return { success: false, error: 'User has no phone' };
      }

      // Build message
      const message = `⚠️ *PON Alert*
━━━━━━━━━━━━━━━
📡 OLT: ${ponPort.olt.name}
🔌 PON Port: ${ponPort.port_name}
⚠️ Alert: ${alert.message}
📊 Value: ${alert.value}
⏰ Time: ${new Date().toLocaleString('id-ID')}
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

      // Send message
      const result = await evolutionApiService.sendTextMessage(
        instance.name,
        instance.api_key,
        user.phone,
        message
      );

      return result;
    } catch (error) {
      console.error('Send PON alert error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
