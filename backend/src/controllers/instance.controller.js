const Instance = require('../models/Instance');
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi.service');
const logger = require('../config/logger');
const crypto = require('../utils/crypto');
const { AppError, NotFoundError, QuotaExceededError } = require('../utils/errors');
const config = require('../config');

/**
 * Instance Controller
 * Manages WhatsApp instances
 */

/**
 * Get all user instances
 * @route GET /api/v1/instances
 */
const getInstances = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, search } = req.query;
    
    const options = {
      where: { user_id: userId }
    };
    
    if (status) {
      options.where.status = status;
    }
    
    if (search) {
      const { Op } = require('sequelize');
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone_number: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const instances = await Instance.findAll(options);
    
    res.json({
      success: true,
      data: {
        instances: instances.map(i => i.toSafeObject()),
        total: instances.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single instance
 * @route GET /api/v1/instances/:id
 */
const getInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Get statistics
    const statistics = await Instance.getStatistics(id);
    
    res.json({
      success: true,
      data: {
        instance: instance.toSafeObject(),
        statistics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new instance
 * @route POST /api/v1/instances
 */
const createInstance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    
    // Check subscription quota
    // TODO: Check user subscription and instance quota
    const instanceCount = await Instance.countUserInstances(userId);
    const maxInstances = 10; // This should come from subscription
    
    if (instanceCount >= maxInstances) {
      throw new QuotaExceededError('instances', instanceCount, maxInstances);
    }
    
    // Generate unique instance name
    const instanceName = `${userId.substring(0, 8)}_${Date.now()}`;
    
    // Generate webhook URL
    const webhookToken = crypto.generateToken(32);
    const webhookUrl = `${config.app.apiUrl}/api/v1/webhooks/evolution/${webhookToken}`;
    
    // Create instance in database
    const instance = await Instance.create({
      user_id: userId,
      name,
      instance_name: instanceName,
      webhook_url: webhookUrl,
      api_key: webhookToken,
      status: 'creating'
    });
    
    try {
      // Create instance in Evolution API
      const evolutionResponse = await evolutionApi.createInstance(
        instanceName,
        webhookUrl,
        req.body.settings || {}
      );
      
      // Update instance with QR code
      if (evolutionResponse.instance.qrcode) {
        await instance.updateQRCode(evolutionResponse.instance.qrcode);
      }
      
      logger.info('Instance created successfully:', {
        instanceId: instance.id,
        instanceName
      });
      
      res.status(201).json({
        success: true,
        message: 'Instance created successfully',
        data: {
          instance: instance.toSafeObject(),
          qr_code: evolutionResponse.instance.qrcode
        }
      });
    } catch (evolutionError) {
      // If Evolution API fails, delete the instance
      await instance.destroy();
      throw evolutionError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update instance
 * @route PUT /api/v1/instances/:id
 */
const updateInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, settings } = req.body;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Update instance
    if (name) {
      instance.name = name;
    }
    
    if (settings) {
      await instance.updateSettings(settings);
      
      // Update settings in Evolution API
      try {
        await evolutionApi.setInstanceSettings(instance.instance_name, settings);
      } catch (error) {
        logger.error('Failed to update Evolution API settings:', error);
      }
    }
    
    await instance.save();
    
    res.json({
      success: true,
      message: 'Instance updated successfully',
      data: {
        instance: instance.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete instance
 * @route DELETE /api/v1/instances/:id
 */
const deleteInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Delete from Evolution API
    try {
      await evolutionApi.deleteInstance(instance.instance_name);
    } catch (error) {
      logger.error('Failed to delete from Evolution API:', error);
      // Continue with database deletion even if Evolution API fails
    }
    
    // Soft delete from database
    await instance.destroy();
    
    logger.info('Instance deleted:', { instanceId: id });
    
    res.json({
      success: true,
      message: 'Instance deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connect instance (get QR code)
 * @route POST /api/v1/instances/:id/connect
 */
const connectInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Get QR code from Evolution API
    const response = await evolutionApi.connectInstance(instance.instance_name);
    
    // Update instance with QR code
    if (response.qrcode) {
      await instance.updateQRCode(response.qrcode);
    }
    
    res.json({
      success: true,
      data: {
        qr_code: response.qrcode,
        pairing_code: response.pairingCode,
        expires_at: instance.qr_code_expires_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect instance
 * @route POST /api/v1/instances/:id/disconnect
 */
const disconnectInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Logout from Evolution API
    await evolutionApi.logoutInstance(instance.instance_name);
    
    // Update instance status
    await instance.setDisconnected('Manual disconnect by user');
    
    res.json({
      success: true,
      message: 'Instance disconnected successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restart instance
 * @route POST /api/v1/instances/:id/restart
 */
const restartInstance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Restart in Evolution API
    await evolutionApi.restartInstance(instance.instance_name);
    
    // Update status
    instance.status = 'creating';
    await instance.save();
    
    res.json({
      success: true,
      message: 'Instance restarting...'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get instance status
 * @route GET /api/v1/instances/:id/status
 */
const getInstanceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    // Get status from Evolution API
    try {
      const evolutionStatus = await evolutionApi.getInstanceState(instance.instance_name);
      
      // Update local status
      if (evolutionStatus.state) {
        await instance.updateConnectionStatus(
          evolutionStatus.state === 'open' ? 'connected' : 'disconnected',
          evolutionStatus.state
        );
      }
      
      res.json({
        success: true,
        data: {
          status: instance.status,
          connection_state: instance.connection_state,
          last_seen: instance.last_seen,
          connected_at: instance.connected_at,
          evolution_state: evolutionStatus.state
        }
      });
    } catch (error) {
      // If Evolution API fails, return local status
      res.json({
        success: true,
        data: {
          status: instance.status,
          connection_state: instance.connection_state,
          last_seen: instance.last_seen,
          connected_at: instance.connected_at
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get instance profile
 * @route GET /api/v1/instances/:id/profile
 */
const getInstanceProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    if (!instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Fetch profile from Evolution API
    const profile = await evolutionApi.fetchProfile(instance.instance_name);
    
    // Update local profile
    instance.profile_name = profile.profile?.name || instance.profile_name;
    instance.profile_picture = profile.profile?.picture || instance.profile_picture;
    instance.profile_status = profile.profile?.status || instance.profile_status;
    await instance.save();
    
    res.json({
      success: true,
      data: {
        profile: {
          name: instance.profile_name,
          picture: instance.profile_picture,
          status: instance.profile_status,
          phone: instance.phone_number
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get instance groups
 * @route GET /api/v1/instances/:id/groups
 */
const getInstanceGroups = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    if (!instance.isConnected()) {
      throw new AppError('Instance is not connected', 400, 'INSTANCE_NOT_CONNECTED');
    }
    
    // Fetch groups from Evolution API
    const response = await evolutionApi.fetchGroups(instance.instance_name);
    
    res.json({
      success: true,
      data: {
        groups: response.groups,
        total: response.groups.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get instance logs
 * @route GET /api/v1/instances/:id/logs
 */
const getInstanceLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0, direction, status } = req.query;
    
    const instance = await Instance.findOne({
      where: { id, user_id: userId }
    });
    
    if (!instance) {
      throw new NotFoundError('Instance', id);
    }
    
    const MessageLog = require('../models/MessageLog');
    
    const result = await MessageLog.findUserMessages(userId, {
      instanceId: id,
      direction,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInstances,
  getInstance,
  createInstance,
  updateInstance,
  deleteInstance,
  connectInstance,
  disconnectInstance,
  restartInstance,
  getInstanceStatus,
  getInstanceProfile,
  getInstanceGroups,
  getInstanceLogs
};
