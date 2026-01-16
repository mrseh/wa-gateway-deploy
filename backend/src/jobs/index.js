const instanceMonitorJob = require('./instanceMonitor.job');
const messageQueueJob = require('./messageQueue.job');
const subscriptionCheckerJob = require('./subscriptionChecker.job');
const paymentCheckerJob = require('./paymentChecker.job');
const logger = require('../config/logger');

/**
 * Job Manager
 * Manages all background jobs
 */

class JobManager {
  constructor() {
    this.jobs = {
      instanceMonitor: instanceMonitorJob,
      messageQueue: messageQueueJob,
      subscriptionChecker: subscriptionCheckerJob,
      paymentChecker: paymentCheckerJob
    };
    
    this.isStarted = false;
  }
  
  /**
   * Start all jobs
   */
  startAll() {
    if (this.isStarted) {
      logger.warn('Jobs already started');
      return;
    }
    
    try {
      logger.info('========================================');
      logger.info('Starting background jobs...');
      logger.info('========================================');
      
      // Start instance monitor
      this.jobs.instanceMonitor.start();
      logger.info('✓ Instance monitor job started');
      
      // Start message queue
      this.jobs.messageQueue.start();
      logger.info('✓ Message queue jobs started');
      
      // Start subscription checker
      this.jobs.subscriptionChecker.start();
      logger.info('✓ Subscription checker job started (runs daily at 3 AM)');
      
      // Start payment checker
      this.jobs.paymentChecker.start();
      logger.info('✓ Payment checker job started (runs hourly)');
      
      this.isStarted = true;
      
      logger.info('========================================');
      logger.info('All background jobs started successfully');
      logger.info('========================================');
    } catch (error) {
      logger.error('Failed to start background jobs:', error);
      throw error;
    }
  }
  
  /**
   * Stop all jobs
   */
  stopAll() {
    if (!this.isStarted) {
      return;
    }
    
    try {
      logger.info('Stopping background jobs...');
      
      // Stop instance monitor
      this.jobs.instanceMonitor.stop();
      
      // Stop message queue
      this.jobs.messageQueue.stop();
      
      this.isStarted = false;
      
      logger.info('All background jobs stopped');
    } catch (error) {
      logger.error('Failed to stop background jobs:', error);
      throw error;
    }
  }
  
  /**
   * Get status of all jobs
   */
  getStatus() {
    return {
      is_started: this.isStarted,
      jobs: {
        instance_monitor: this.jobs.instanceMonitor.isRunning ? 'running' : 'idle',
        message_queue: this.jobs.messageQueue.getStatus()
      }
    };
  }
  
  /**
   * Restart all jobs
   */
  restartAll() {
    this.stopAll();
    this.startAll();
  }
}

// Export singleton
module.exports = new JobManager();
