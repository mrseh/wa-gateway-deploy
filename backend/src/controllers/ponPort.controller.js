/**
 * PON Port Controller
 */

const db = require('../config/database');

class PONPortController {
  async getPONPort(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ponPort = await db.PONPort.findOne({
        where: { id },
        include: [
          {
            model: db.OLT,
            as: 'olt',
            where: { user_id: userId },
          },
          {
            model: db.ONU,
            as: 'onus',
          },
        ],
      });

      if (!ponPort) {
        return res.status(404).json({
          success: false,
          error: 'PON Port not found',
        });
      }

      res.json({
        success: true,
        data: ponPort,
      });
    } catch (error) {
      console.error('Get PON Port error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getPONPortMetrics(req, res) {
    try {
      const { id } = req.params;
      const { period = '24h' } = req.query;
      const userId = req.user.id;

      const ponPort = await db.PONPort.findOne({
        where: { id },
        include: [
          {
            model: db.OLT,
            as: 'olt',
            where: { user_id: userId },
          },
        ],
      });

      if (!ponPort) {
        return res.status(404).json({
          success: false,
          error: 'PON Port not found',
        });
      }

      // Calculate time range
      const now = new Date();
      let startTime;
      
      switch (period) {
        case '1h':
          startTime = new Date(now - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now - 24 * 60 * 60 * 1000);
      }

      // Mock time-series data (in production, query from InfluxDB)
      const metrics = {
        period,
        start_time: startTime,
        end_time: now,
        data_points: [],
      };

      // Generate sample data points
      const interval = period === '1h' ? 5 * 60 * 1000 : 60 * 60 * 1000;
      for (let t = startTime.getTime(); t <= now.getTime(); t += interval) {
        metrics.data_points.push({
          timestamp: new Date(t),
          utilization: Math.random() * 60 + 20,
          temperature: Math.random() * 10 + 45,
          rx_power: Math.random() * 5 - 25,
          online_onus: Math.floor(Math.random() * 3) + ponPort.online_onus - 1,
        });
      }

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Get PON Port metrics error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updatePONPortThresholds(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const {
        threshold_temperature_high,
        threshold_utilization_high,
        threshold_rx_power_low,
      } = req.body;

      const ponPort = await db.PONPort.findOne({
        where: { id },
        include: [
          {
            model: db.OLT,
            as: 'olt',
            where: { user_id: userId },
          },
        ],
      });

      if (!ponPort) {
        return res.status(404).json({
          success: false,
          error: 'PON Port not found',
        });
      }

      await ponPort.update({
        threshold_temperature_high: threshold_temperature_high || ponPort.threshold_temperature_high,
        threshold_utilization_high: threshold_utilization_high || ponPort.threshold_utilization_high,
        threshold_rx_power_low: threshold_rx_power_low || ponPort.threshold_rx_power_low,
      });

      res.json({
        success: true,
        data: ponPort,
        message: 'Thresholds updated successfully',
      });
    } catch (error) {
      console.error('Update thresholds error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getPONPortONUs(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const ponPort = await db.PONPort.findOne({
        where: { id },
        include: [
          {
            model: db.OLT,
            as: 'olt',
            where: { user_id: userId },
          },
          {
            model: db.ONU,
            as: 'onus',
            order: [['onu_index', 'ASC']],
          },
        ],
      });

      if (!ponPort) {
        return res.status(404).json({
          success: false,
          error: 'PON Port not found',
        });
      }

      res.json({
        success: true,
        data: ponPort.onus,
      });
    } catch (error) {
      console.error('Get PON Port ONUs error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new PONPortController();
