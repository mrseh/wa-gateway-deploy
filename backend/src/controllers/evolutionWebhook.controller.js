const Instance = require('../models/Instance');
const MessageLog = require('../models/MessageLog');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

/**
 * Evolution API Webhook Controller
 * Handles webhook events from Evolution API
 */

/**
 * Main webhook handler
 * @route POST /api/v1/webhooks/evolution/:token
 */
const handleWebhook = async (req, res, next) => {
  try {
    const { token } = req.params;
    const event = req.body;
    
    logger.debug('Webhook received:', {
      token,
      event: event.event,
      instance: event.instance
    });
    
    // Find instance by webhook token
    const instance = await Instance.findOne({
      where: { api_key: token }
    });
    
    if (!instance) {
      logger.warn('Webhook received for unknown instance:', { token });
      // Return 200 to prevent Evolution API from retrying
      return res.status(200).json({ success: true });
    }
    
    // Route to specific handler based on event type
    switch (event.event) {
      case 'qrcode.updated':
      case 'QRCODE_UPDATED':
        await handleQRCodeUpdate(instance, event);
        break;
        
      case 'connection.update':
      case 'CONNECTION_UPDATE':
        await handleConnectionUpdate(instance, event);
        break;
        
      case 'messages.upsert':
      case 'MESSAGES_UPSERT':
        await handleNewMessage(instance, event);
        break;
        
      case 'messages.update':
      case 'MESSAGES_UPDATE':
        await handleMessageUpdate(instance, event);
        break;
        
      case 'send.message':
      case 'SEND_MESSAGE':
        await handleSentMessage(instance, event);
        break;
        
      case 'groups.upsert':
      case 'GROUPS_UPSERT':
        await handleGroupUpdate(instance, event);
        break;
        
      case 'call':
      case 'CALL':
        await handleCall(instance, event);
        break;
        
      default:
        logger.debug('Unhandled webhook event:', event.event);
    }
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * Handle QR code update
 */
async function handleQRCodeUpdate(instance, event) {
  try {
    const qrCode = event.data?.qrcode || event.qrcode;
    
    if (qrCode) {
      await instance.updateQRCode(qrCode);
      
      logger.info('QR code updated:', {
        instanceId: instance.id,
        instanceName: instance.instance_name
      });
      
      // TODO: Emit real-time event to frontend via WebSocket
    }
  } catch (error) {
    logger.error('Failed to handle QR code update:', error);
  }
}

/**
 * Handle connection update
 */
async function handleConnectionUpdate(instance, event) {
  try {
    const data = event.data || {};
    const state = data.state || event.state;
    
    logger.info('Connection update received:', {
      instanceId: instance.id,
      state,
      data
    });
    
    // Map Evolution API states to our status
    let status;
    let phoneNumber = null;
    
    switch (state) {
      case 'open':
      case 'connected':
        status = 'connected';
        phoneNumber = data.instance?.profilePictureUrl || 
                     data.instance?.wuid?.split('@')[0] ||
                     instance.phone_number;
        
        // Set as connected
        await instance.setConnected(phoneNumber, {
          name: data.instance?.profileName,
          picture: data.instance?.profilePictureUrl,
          status: data.instance?.profileStatus
        });
        
        logger.info('Instance connected:', {
          instanceId: instance.id,
          phoneNumber
        });
        break;
        
      case 'close':
      case 'connecting':
        status = 'disconnected';
        await instance.setDisconnected(data.reason || 'Connection closed');
        break;
        
      case 'qr':
        status = 'waiting_qr';
        await instance.updateConnectionStatus('waiting_qr', state);
        break;
        
      default:
        status = 'disconnected';
        await instance.updateConnectionStatus(status, state);
    }
    
    // TODO: Emit real-time event to frontend
    // TODO: Send notification to user if disconnected
  } catch (error) {
    logger.error('Failed to handle connection update:', error);
    await instance.logError(error);
  }
}

/**
 * Handle new message (incoming)
 */
async function handleNewMessage(instance, event) {
  try {
    const data = event.data || {};
    const messages = data.messages || [];
    
    for (const msg of messages) {
      // Skip if message is from self
      if (msg.key?.fromMe) {
        continue;
      }
      
      const messageType = msg.messageType || 'conversation';
      const isGroup = msg.key?.remoteJid?.includes('@g.us');
      
      // Extract message content based on type
      let content = '';
      let mediaUrl = null;
      let caption = null;
      
      if (msg.message) {
        if (msg.message.conversation) {
          content = msg.message.conversation;
        } else if (msg.message.extendedTextMessage) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage) {
          caption = msg.message.imageMessage.caption;
          mediaUrl = msg.message.imageMessage.url;
        } else if (msg.message.videoMessage) {
          caption = msg.message.videoMessage.caption;
          mediaUrl = msg.message.videoMessage.url;
        } else if (msg.message.documentMessage) {
          caption = msg.message.documentMessage.caption;
          mediaUrl = msg.message.documentMessage.url;
        }
      }
      
      // Check if already logged
      const existing = await MessageLog.findByMessageId(msg.key?.id);
      if (existing) {
        continue;
      }
      
      // Create message log
      await MessageLog.createInbound({
        userId: instance.user_id,
        instanceId: instance.id,
        messageId: msg.key?.id,
        fromNumber: msg.key?.remoteJid?.split('@')[0],
        messageType: mapMessageType(messageType),
        messageContent: content,
        mediaUrl,
        caption,
        isGroup,
        groupId: isGroup ? msg.key?.remoteJid : null,
        timestamp: new Date(msg.messageTimestamp * 1000)
      });
      
      // Update instance statistics
      await instance.incrementMessageReceived();
      
      logger.info('Incoming message logged:', {
        instanceId: instance.id,
        messageId: msg.key?.id,
        from: msg.key?.remoteJid
      });
    }
  } catch (error) {
    logger.error('Failed to handle new message:', error);
  }
}

/**
 * Handle message status update
 */
async function handleMessageUpdate(instance, event) {
  try {
    const data = event.data || {};
    const updates = data.messages || [];
    
    for (const update of updates) {
      const messageId = update.key?.id;
      
      if (!messageId) {
        continue;
      }
      
      // Find message log
      const messageLog = await MessageLog.findByMessageId(messageId);
      
      if (!messageLog) {
        continue;
      }
      
      // Update status based on update type
      if (update.update?.status === 3) {
        // Delivered
        await messageLog.markAsDelivered();
      } else if (update.update?.status === 4) {
        // Read
        await messageLog.markAsRead();
      }
      
      logger.debug('Message status updated:', {
        messageId,
        status: update.update?.status
      });
    }
  } catch (error) {
    logger.error('Failed to handle message update:', error);
  }
}

/**
 * Handle sent message confirmation
 */
async function handleSentMessage(instance, event) {
  try {
    const data = event.data || {};
    const message = data.message || {};
    
    const messageId = message.key?.id;
    
    if (!messageId) {
      return;
    }
    
    // Find pending message log
    const messageLog = await MessageLog.findOne({
      where: {
        instance_id: instance.id,
        to_number: message.key?.remoteJid?.split('@')[0],
        status: 'pending'
      },
      order: [['created_at', 'DESC']]
    });
    
    if (messageLog) {
      await messageLog.markAsSent(messageId);
      
      logger.debug('Sent message confirmed:', {
        instanceId: instance.id,
        messageId
      });
    }
  } catch (error) {
    logger.error('Failed to handle sent message:', error);
  }
}

/**
 * Handle group update
 */
async function handleGroupUpdate(instance, event) {
  try {
    const data = event.data || {};
    
    logger.debug('Group update received:', {
      instanceId: instance.id,
      data
    });
    
    // TODO: Store group information in database
    // TODO: Handle group participant updates
  } catch (error) {
    logger.error('Failed to handle group update:', error);
  }
}

/**
 * Handle incoming call
 */
async function handleCall(instance, event) {
  try {
    const data = event.data || {};
    
    logger.info('Call received:', {
      instanceId: instance.id,
      from: data.from,
      isVideo: data.isVideo
    });
    
    // Check if reject_calls is enabled
    if (instance.settings?.reject_calls) {
      logger.info('Call auto-rejected (reject_calls enabled)');
      // Evolution API will automatically reject based on settings
    }
    
    // TODO: Log call event
    // TODO: Send notification to user
  } catch (error) {
    logger.error('Failed to handle call:', error);
  }
}

/**
 * Map Evolution API message types to our types
 */
function mapMessageType(evolutionType) {
  const typeMap = {
    'conversation': 'text',
    'extendedTextMessage': 'text',
    'imageMessage': 'image',
    'videoMessage': 'video',
    'audioMessage': 'audio',
    'documentMessage': 'document',
    'stickerMessage': 'sticker',
    'locationMessage': 'location',
    'contactMessage': 'contact',
    'contactsArrayMessage': 'contact'
  };
  
  return typeMap[evolutionType] || 'text';
}

/**
 * Test webhook endpoint
 * @route GET /api/v1/webhooks/evolution/test
 */
const testWebhook = async (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  handleWebhook,
  testWebhook
};
