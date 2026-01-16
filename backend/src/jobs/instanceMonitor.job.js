const cron = require('node-cron');
const Instance = require('../models/Instance');
const evolutionApi = require('../services/evolutionApi.service');
const logger = require('../config/logger');

/**
 * Instance Monitor Job
 * Monitors instance connections and handles reconnections
 */

class InstanceMonitorJob {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }
  
  /**
   * Start the monitoring job
   */
  start() {
    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        logger.debug('Instance monitor already running, skipping...');
        return;
      }
      
      this.isRunning = true;
      
      try {
        await this.checkInstances();
        await this.handleReconnections();
        await this.cleanExpiredQRCodes();
      } catch (error) {
        logger.error('Instance monitor job error:', error);
      } finally {
        this.isRunning = false;
      }
    });
    
    logger.info('Instance monitor job started');
  }
  
  /**
   * Stop the monitoring job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Instance monitor job stopped');
    }
  }
  
  /**
   * Check all instances status
   */
  async checkInstances() {
    try {
      // Get all connected instances
      const instances = await Instance.findAll({
        where: {
          status: 'connected'
        }
      });
      
      logger.info(`Checking ${instances.length} connected instances...`);
      
      for (const instance of instances) {
        try {
          // Get status from Evolution API
          const response = await evolutionApi.getInstanceState(instance.instance_name);
          
          // Update local status
          if (response.state === 'close') {
            await instance.setDisconnected('Connection lost');
            logger.warn('Instance disconnected:', {
              instanceId: instance.id,
              instanceName: instance.instance_name
            });
          } else {
            // Update last seen
            instance.last_seen = new Date();
            await instance.save();
          }
        } catch (error) {
          logger.error('Failed to check instance status:', {
            instanceId: instance.id,
            error: error.message
          });
          
          // Mark as error if multiple failures
          instance.error_count += 1;
          
          if (instance.error_count >= 3) {
            await instance.setDisconnected('Multiple status check failures');
          }
          
          await instance.save();
        }
      }
    } catch (error) {
      logger.error('Failed to check instances:', error);
    }
  }
  
  /**
   * Handle instance reconnections
   */
  async handleReconnections() {
    try {
      // Find instances needing reconnection
      const instances = await Instance.findNeedingReconnection();
      
      if (instances.length === 0) {
        return;
      }
      
      logger.info(`Found ${instances.length} instances for reconnection`);
      
      for (const instance of instances) {
        try {
          logger.info('Attempting to reconnect instance:', {
            instanceId: instance.id,
            instanceName: instance.instance_name,
            attempt: instance.reconnect_attempts + 1
          });
          
          // Increment reconnect attempts
          instance.reconnect_attempts += 1;
          await instance.save();
          
          // Try to restart instance
          await evolutionApi.restartInstance(instance.instance_name);
          
          // Update status
          instance.status = 'creating';
          await instance.save();
          
          logger.info('Instance restart initiated:', {
            instanceId: instance.id
          });
        } catch (error) {
          logger.error('Failed to reconnect instance:', {
            instanceId: instance.id,
            error: error.message
          });
          
          await instance.logError(error);
          
          // Disable auto-reconnect after 5 failed attempts
          if (instance.reconnect_attempts >= 5) {
            instance.auto_reconnect = false;
            await instance.save();
            
            logger.warn('Auto-reconnect disabled after 5 failed attempts:', {
              instanceId: instance.id
            });
            
            // TODO: Send notification to user
          }
        }
      }
    } catch (error) {
      logger.error('Failed to handle reconnections:', error);
    }
  }
  
  /**
   * Clean expired QR codes
   */
  async cleanExpiredQRCodes() {
    try {
      const instances = await Instance.findWithExpiredQR();
      
      if (instances.length === 0) {
        return;
      }
      
      logger.info(`Cleaning ${instances.length} expired QR codes`);
      
      for (const instance of instances) {
        instance.qr_code = null;
        instance.qr_code_expires_at = null;
        
        // Try to get new QR code
        try {
          const response = await evolutionApi.connectInstance(instance.instance_name);
          
          if (response.qrcode) {
            await instance.updateQRCode(response.qrcode);
            logger.info('QR code refreshed:', {
              instanceId: instance.id
            });
          }
        } catch (error) {
          logger.error('Failed to refresh QR code:', {
            instanceId: instance.id,
            error: error.message
          });
        }
        
        await instance.save();
      }
    } catch (error) {
      logger.error('Failed to clean expired QR codes:', error);
    }
  }
  
  /**
   * Update instance statistics
   */
  async updateStatistics() {
    try {
      const instances = await Instance.findAll({
        where: {
          status: 'connected'
        }
      });
      
      for (const instance of instances) {
        try {
          // Calculate uptime percentage
          if (instance.connected_at) {
            const totalTime = Date.now() - instance.connected_at.getTime();
            const downtime = instance.statistics.connection_drops || 0;
            const uptimePercentage = Math.max(0, 100 - (downtime / totalTime * 100000));
            
            const stats = instance.statistics || {};
            stats.uptime_percentage = Math.min(100, uptimePercentage);
            instance.statistics = stats;
            
            await instance.save();
          }
        } catch (error) {
          logger.error('Failed to update instance statistics:', {
            instanceId: instance.id,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('Failed to update statistics:', error);
    }
  }
}

// Export singleton
module.exports = new InstanceMonitorJob();
