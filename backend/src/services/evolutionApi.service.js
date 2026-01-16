const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');
const { ExternalServiceError } = require('../utils/errors');

/**
 * Evolution API Service
 * Handles all communication with Evolution API v2.x
 */

class EvolutionAPIService {
  constructor() {
    this.baseURL = config.evolutionApi.url;
    this.apiKey = config.evolutionApi.apiKey;
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      timeout: 30000
    });
    
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Evolution API Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Evolution API Request Error:', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Evolution API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      async (error) => {
        logger.error('Evolution API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // Retry logic for network errors
        if (error.config && !error.config.__retryCount) {
          error.config.__retryCount = 0;
        }
        
        if (error.config && error.config.__retryCount < 3) {
          error.config.__retryCount++;
          
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, error.config.__retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.client(error.config);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Make API request with error handling
   * @private
   */
  async _request(method, endpoint, data = null, customHeaders = {}) {
    try {
      const response = await this.client({
        method,
        url: endpoint,
        data,
        headers: customHeaders
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status || 500;
      
      logger.error('Evolution API Error:', {
        endpoint,
        method,
        error: errorMessage,
        statusCode
      });
      
      throw new ExternalServiceError(
        'Evolution API',
        errorMessage,
        statusCode
      );
    }
  }
  
  /**
   * Instance Management
   */
  
  /**
   * Create new instance
   * @param {string} instanceName - Unique instance name
   * @param {string} webhookUrl - Webhook URL for events
   * @param {Object} settings - Instance settings
   */
  async createInstance(instanceName, webhookUrl, settings = {}) {
    try {
      const payload = {
        instanceName,
        token: instanceName, // Use instance name as token
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          events: [
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE',
            'GROUPS_UPSERT',
            'GROUP_UPDATE',
            'GROUP_PARTICIPANTS_UPDATE',
            'CALL'
          ],
          webhook_by_events: true
        },
        settings: {
          reject_call: settings.reject_calls || false,
          msg_call: settings.call_message || 'This number does not accept calls.',
          groups_ignore: settings.ignore_groups || false,
          always_online: settings.always_online || false,
          read_messages: settings.read_messages || false,
          read_status: settings.read_status || false,
          sync_full_history: settings.sync_history || false
        },
        ...settings
      };
      
      const response = await this._request('POST', '/instance/create', payload);
      
      logger.info('Instance created:', { instanceName });
      
      return {
        success: true,
        instance: {
          name: response.data.instance?.instanceName || instanceName,
          status: response.data.instance?.state || 'creating',
          qrcode: response.data.qrcode || null,
          hash: response.data.hash || null
        }
      };
    } catch (error) {
      logger.error('Failed to create instance:', error);
      throw error;
    }
  }
  
  /**
   * Get instance connection state
   * @param {string} instanceName - Instance name
   */
  async getInstanceState(instanceName) {
    try {
      const response = await this._request(
        'GET',
        `/instance/connectionState/${instanceName}`
      );
      
      return {
        success: true,
        state: response.data.state,
        instance: response.data.instance
      };
    } catch (error) {
      logger.error('Failed to get instance state:', error);
      throw error;
    }
  }
  
  /**
   * Connect instance (get QR code)
   * @param {string} instanceName - Instance name
   */
  async connectInstance(instanceName) {
    try {
      const response = await this._request(
        'GET',
        `/instance/connect/${instanceName}`
      );
      
      return {
        success: true,
        qrcode: response.data.qrcode || response.data.base64,
        pairingCode: response.data.pairingCode || null,
        state: response.data.state
      };
    } catch (error) {
      logger.error('Failed to connect instance:', error);
      throw error;
    }
  }
  
  /**
   * Restart instance
   * @param {string} instanceName - Instance name
   */
  async restartInstance(instanceName) {
    try {
      const response = await this._request(
        'PUT',
        `/instance/restart/${instanceName}`
      );
      
      logger.info('Instance restarted:', { instanceName });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to restart instance:', error);
      throw error;
    }
  }
  
  /**
   * Logout instance
   * @param {string} instanceName - Instance name
   */
  async logoutInstance(instanceName) {
    try {
      const response = await this._request(
        'DELETE',
        `/instance/logout/${instanceName}`
      );
      
      logger.info('Instance logged out:', { instanceName });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to logout instance:', error);
      throw error;
    }
  }
  
  /**
   * Delete instance
   * @param {string} instanceName - Instance name
   */
  async deleteInstance(instanceName) {
    try {
      const response = await this._request(
        'DELETE',
        `/instance/delete/${instanceName}`
      );
      
      logger.info('Instance deleted:', { instanceName });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to delete instance:', error);
      throw error;
    }
  }
  
  /**
   * Fetch all instances
   */
  async fetchInstances() {
    try {
      const response = await this._request('GET', '/instance/fetchInstances');
      
      return {
        success: true,
        instances: response.data || []
      };
    } catch (error) {
      logger.error('Failed to fetch instances:', error);
      throw error;
    }
  }
  
  /**
   * Set instance settings
   * @param {string} instanceName - Instance name
   * @param {Object} settings - Settings to update
   */
  async setInstanceSettings(instanceName, settings) {
    try {
      const response = await this._request(
        'POST',
        `/settings/set/${instanceName}`,
        settings
      );
      
      logger.info('Instance settings updated:', { instanceName, settings });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to update instance settings:', error);
      throw error;
    }
  }
  
  /**
   * Message Operations
   */
  
  /**
   * Send text message
   * @param {string} instanceName - Instance name
   * @param {string} number - Recipient number (format: 628xxx)
   * @param {string} text - Message text
   */
  async sendTextMessage(instanceName, number, text) {
    try {
      const payload = {
        number: this._formatPhoneNumber(number),
        text: text,
        delay: 1000
      };
      
      const response = await this._request(
        'POST',
        `/message/sendText/${instanceName}`,
        payload
      );
      
      logger.info('Text message sent:', { instanceName, number });
      
      return {
        success: true,
        message: {
          id: response.data.key?.id,
          status: response.data.status,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      logger.error('Failed to send text message:', error);
      throw error;
    }
  }
  
  /**
   * Send media message
   * @param {string} instanceName - Instance name
   * @param {string} number - Recipient number
   * @param {string} mediaUrl - Media URL
   * @param {string} caption - Media caption
   * @param {string} mediaType - Media type (image, video, audio, document)
   */
  async sendMediaMessage(instanceName, number, mediaUrl, caption = '', mediaType = 'image') {
    try {
      const payload = {
        number: this._formatPhoneNumber(number),
        caption: caption,
        media: mediaUrl
      };
      
      let endpoint;
      switch (mediaType) {
        case 'image':
          endpoint = `/message/sendMedia/${instanceName}`;
          break;
        case 'video':
          endpoint = `/message/sendMedia/${instanceName}`;
          payload.mediatype = 'video';
          break;
        case 'audio':
          endpoint = `/message/sendWhatsAppAudio/${instanceName}`;
          break;
        case 'document':
          endpoint = `/message/sendMedia/${instanceName}`;
          payload.mediatype = 'document';
          break;
        default:
          endpoint = `/message/sendMedia/${instanceName}`;
      }
      
      const response = await this._request('POST', endpoint, payload);
      
      logger.info('Media message sent:', { instanceName, number, mediaType });
      
      return {
        success: true,
        message: {
          id: response.data.key?.id,
          status: response.data.status
        }
      };
    } catch (error) {
      logger.error('Failed to send media message:', error);
      throw error;
    }
  }
  
  /**
   * Send contact message
   * @param {string} instanceName - Instance name
   * @param {string} number - Recipient number
   * @param {Array} contacts - Array of contacts
   */
  async sendContactMessage(instanceName, number, contacts) {
    try {
      const payload = {
        number: this._formatPhoneNumber(number),
        contact: contacts
      };
      
      const response = await this._request(
        'POST',
        `/message/sendContact/${instanceName}`,
        payload
      );
      
      return {
        success: true,
        message: {
          id: response.data.key?.id
        }
      };
    } catch (error) {
      logger.error('Failed to send contact:', error);
      throw error;
    }
  }
  
  /**
   * Send location message
   * @param {string} instanceName - Instance name
   * @param {string} number - Recipient number
   * @param {Object} location - {latitude, longitude, name, address}
   */
  async sendLocationMessage(instanceName, number, location) {
    try {
      const payload = {
        number: this._formatPhoneNumber(number),
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name || '',
        address: location.address || ''
      };
      
      const response = await this._request(
        'POST',
        `/message/sendLocation/${instanceName}`,
        payload
      );
      
      return {
        success: true,
        message: {
          id: response.data.key?.id
        }
      };
    } catch (error) {
      logger.error('Failed to send location:', error);
      throw error;
    }
  }
  
  /**
   * Group Operations
   */
  
  /**
   * Fetch groups
   * @param {string} instanceName - Instance name
   */
  async fetchGroups(instanceName) {
    try {
      const response = await this._request(
        'GET',
        `/group/fetchAllGroups/${instanceName}`,
        { getParticipants: 'true' }
      );
      
      return {
        success: true,
        groups: response.data || []
      };
    } catch (error) {
      logger.error('Failed to fetch groups:', error);
      throw error;
    }
  }
  
  /**
   * Send message to group
   * @param {string} instanceName - Instance name
   * @param {string} groupId - Group ID
   * @param {string} text - Message text
   */
  async sendGroupMessage(instanceName, groupId, text) {
    try {
      const payload = {
        groupId: groupId,
        text: text
      };
      
      const response = await this._request(
        'POST',
        `/message/sendText/${instanceName}`,
        payload
      );
      
      return {
        success: true,
        message: {
          id: response.data.key?.id
        }
      };
    } catch (error) {
      logger.error('Failed to send group message:', error);
      throw error;
    }
  }
  
  /**
   * Profile Operations
   */
  
  /**
   * Get profile info
   * @param {string} instanceName - Instance name
   */
  async fetchProfile(instanceName) {
    try {
      const response = await this._request(
        'GET',
        `/chat/fetchProfile/${instanceName}`
      );
      
      return {
        success: true,
        profile: response.data
      };
    } catch (error) {
      logger.error('Failed to fetch profile:', error);
      throw error;
    }
  }
  
  /**
   * Update profile name
   * @param {string} instanceName - Instance name
   * @param {string} name - New name
   */
  async updateProfileName(instanceName, name) {
    try {
      const response = await this._request(
        'POST',
        `/chat/updateProfileName/${instanceName}`,
        { name }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to update profile name:', error);
      throw error;
    }
  }
  
  /**
   * Update profile picture
   * @param {string} instanceName - Instance name
   * @param {string} pictureUrl - Picture URL
   */
  async updateProfilePicture(instanceName, pictureUrl) {
    try {
      const response = await this._request(
        'POST',
        `/chat/updateProfilePicture/${instanceName}`,
        { picture: pictureUrl }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to update profile picture:', error);
      throw error;
    }
  }
  
  /**
   * Utility Methods
   */
  
  /**
   * Format phone number
   * @private
   */
  _formatPhoneNumber(number) {
    // Remove all non-numeric characters
    let formatted = number.replace(/\D/g, '');
    
    // If starts with 0, replace with 62
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    
    // If doesn't start with 62, add it
    if (!formatted.startsWith('62')) {
      formatted = '62' + formatted;
    }
    
    return formatted;
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this._request('GET', '/');
      return {
        success: true,
        status: 'healthy',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new EvolutionAPIService();
