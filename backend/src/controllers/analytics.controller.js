/**
 * Analytics Controller
 * Provide comprehensive analytics and reports
 */

const db = require('../config/database');
const { QueryTypes } = require('sequelize');
const logger = require('../config/logger');

class AnalyticsController {
  async getDashboardAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { range = '7d' } = req.query;

      const timeRange = this.parseTimeRange(range);

      const [
        messageStats,
        instanceStats,
        oltStats,
        recentAlerts,
        quotaUsage,
      ] = await Promise.all([
        this.getMessageAnalytics(userId, timeRange),
        this.getInstanceAnalytics(userId),
        this.getOLTAnalytics(userId, timeRange),
        this.getRecentAlerts(userId, 10),
        this.getQuotaUsage(userId),
      ]);

      res.json({
        success: true,
        data: {
          messages: messageStats,
          instances: instanceStats,
          olts: oltStats,
          alerts: recentAlerts,
          quota: quotaUsage,
          period: range,
          generated_at: new Date(),
        },
      });

    } catch (error) {
      logger.error('Dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getMessageAnalytics(userId, timeRange) {
    try {
      // Total messages sent
      const [totalResult] = await db.sequelize.query(`
        SELECT COUNT(*) as count
        FROM message_logs
        WHERE user_id = $1
          AND direction = 'outbound'
          AND created_at BETWEEN $2 AND $3
      `, {
        bind: [userId, timeRange.start, timeRange.end],
        type: QueryTypes.SELECT,
      });

      // Delivered messages
      const [deliveredResult] = await db.sequelize.query(`
        SELECT COUNT(*) as count
        FROM message_logs
        WHERE user_id = $1
          AND direction = 'outbound'
          AND status IN ('delivered', 'read')
          AND created_at BETWEEN $2 AND $3
      `, {
        bind: [userId, timeRange.start, timeRange.end],
        type: QueryTypes.SELECT,
      });

      const totalSent = parseInt(totalResult.count);
      const delivered = parseInt(deliveredResult.count);
      const failed = totalSent - delivered;
      const successRate = totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(2) : 0;

      // Messages by day
      const messagesByDay = await db.sequelize.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM message_logs
        WHERE user_id = $1
          AND direction = 'outbound'
          AND created_at BETWEEN $2 AND $3
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, {
        bind: [userId, timeRange.start, timeRange.end],
        type: QueryTypes.SELECT,
      });

      // Messages by instance
      const messagesByInstance = await db.sequelize.query(`
        SELECT 
          i.name,
          COUNT(*) as count,
          SUM(CASE WHEN m.status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered
        FROM message_logs m
        JOIN instances i ON m.instance_id = i.id
        WHERE m.user_id = $1
          AND m.direction = 'outbound'
          AND m.created_at BETWEEN $2 AND $3
        GROUP BY i.id, i.name
        ORDER BY count DESC
      `, {
        bind: [userId, timeRange.start, timeRange.end],
        type: QueryTypes.SELECT,
      });

      // Peak hours
      const messagesByHour = await db.sequelize.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM message_logs
        WHERE user_id = $1
          AND direction = 'outbound'
          AND created_at BETWEEN $2 AND $3
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour ASC
      `, {
        bind: [userId, timeRange.start, timeRange.end],
        type: QueryTypes.SELECT,
      });

      return {
        total_sent: totalSent,
        delivered,
        failed,
        success_rate: parseFloat(successRate),
        messages_by_day: messagesByDay,
        messages_by_instance: messagesByInstance,
        messages_by_hour: messagesByHour,
      };

    } catch (error) {
      logger.error('Get message analytics error:', error);
      return null;
    }
  }

  async getInstanceAnalytics(userId) {
    try {
      const [stats] = await db.sequelize.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
          SUM(CASE WHEN status = 'disconnected' THEN 1 ELSE 0 END) as disconnected
        FROM instances
        WHERE user_id = $1
      `, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      return stats;

    } catch (error) {
      logger.error('Get instance analytics error:', error);
      return null;
    }
  }

  async getOLTAnalytics(userId, timeRange) {
    try {
      const [stats] = await db.sequelize.query(`
        SELECT 
          COUNT(DISTINCT o.id) as total_olts,
          COUNT(DISTINCT p.id) as total_pon_ports,
          SUM(o.total_onus) as total_onus,
          SUM(o.online_onus) as online_onus,
          SUM(o.offline_onus) as offline_onus,
          AVG(p.health_score) as avg_health_score
        FROM olts o
        LEFT JOIN pon_ports p ON o.id = p.olt_id
        WHERE o.user_id = $1
      `, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      return stats;

    } catch (error) {
      logger.error('Get OLT analytics error:', error);
      return null;
    }
  }

  async getRecentAlerts(userId, limit = 10) {
    try {
      const alerts = await db.sequelize.query(`
        SELECT * FROM (
          SELECT 
            'mikrotik' as source,
            event_type as type,
            router_name as name,
            created_at
          FROM mikrotik_events
          WHERE user_id = $1
          
          UNION ALL
          
          SELECT 
            'zabbix' as source,
            severity as type,
            host_name as name,
            created_at
          FROM zabbix_events
          WHERE user_id = $1
        ) combined
        ORDER BY created_at DESC
        LIMIT $2
      `, {
        bind: [userId, limit],
        type: QueryTypes.SELECT,
      });

      return alerts;

    } catch (error) {
      logger.error('Get recent alerts error:', error);
      return [];
    }
  }

  async getQuotaUsage(userId) {
    try {
      // Get subscription
      const [subscription] = await db.sequelize.query(`
        SELECT s.*, p.max_instances, p.max_messages_per_day, 
               p.max_messages_per_month, p.max_olts
        FROM subscriptions s
        JOIN packages p ON s.package_id = p.id
        WHERE s.user_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      if (!subscription) {
        return null;
      }

      // Count instances
      const [instanceCount] = await db.sequelize.query(`
        SELECT COUNT(*) as count FROM instances WHERE user_id = $1
      `, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      // Count messages today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [messagesToday] = await db.sequelize.query(`
        SELECT COUNT(*) as count 
        FROM message_logs 
        WHERE user_id = $1 
          AND direction = 'outbound'
          AND created_at >= $2
      `, {
        bind: [userId, today],
        type: QueryTypes.SELECT,
      });

      // Count messages this month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const [messagesMonth] = await db.sequelize.query(`
        SELECT COUNT(*) as count 
        FROM message_logs 
        WHERE user_id = $1 
          AND direction = 'outbound'
          AND created_at >= $2
      `, {
        bind: [userId, monthStart],
        type: QueryTypes.SELECT,
      });

      // Count OLTs
      const [oltCount] = await db.sequelize.query(`
        SELECT COUNT(*) as count FROM olts WHERE user_id = $1
      `, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      return {
        instances: {
          used: parseInt(instanceCount.count),
          limit: subscription.max_instances,
          percentage: (parseInt(instanceCount.count) / subscription.max_instances) * 100,
        },
        messages_today: {
          used: parseInt(messagesToday.count),
          limit: subscription.max_messages_per_day,
          percentage: (parseInt(messagesToday.count) / subscription.max_messages_per_day) * 100,
        },
        messages_month: {
          used: parseInt(messagesMonth.count),
          limit: subscription.max_messages_per_month,
          percentage: (parseInt(messagesMonth.count) / subscription.max_messages_per_month) * 100,
        },
        olts: {
          used: parseInt(oltCount.count),
          limit: subscription.max_olts,
          percentage: subscription.max_olts > 0 ? (parseInt(oltCount.count) / subscription.max_olts) * 100 : 0,
        },
      };

    } catch (error) {
      logger.error('Get quota usage error:', error);
      return null;
    }
  }

  parseTimeRange(range) {
    const end = new Date();
    let start = new Date();

    switch (range) {
      case '1d':
        start.setDate(end.getDate() - 1);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      default:
        start.setDate(end.getDate() - 7);
    }

    return { start, end };
  }

  async getMessageReport(req, res) {
    try {
      const userId = req.user.id;
      const { start_date, end_date } = req.query;

      const timeRange = {
        start: start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: end_date ? new Date(end_date) : new Date(),
      };

      const analytics = await this.getMessageAnalytics(userId, timeRange);

      res.json({
        success: true,
        data: analytics,
      });

    } catch (error) {
      logger.error('Get message report error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new AnalyticsController();
