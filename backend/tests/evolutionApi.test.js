const request = require('supertest');
const { app } = require('../../src/index');
const Instance = require('../../src/models/Instance');
const MessageLog = require('../../src/models/MessageLog');
const User = require('../../src/models/User');
const evolutionApi = require('../../src/services/evolutionApi.service');

/**
 * Evolution API Integration Tests
 */

// Mock Evolution API service
jest.mock('../../src/services/evolutionApi.service');

describe('Evolution API Integration', () => {
  let testUser;
  let authToken;
  let testInstance;
  
  beforeAll(async () => {
    // Setup test database
    const { sequelize } = require('../../src/config/database');
    await sequelize.sync({ force: true });
    
    // Create test user
    testUser = await User.createUser({
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPass123!',
      email_verified: true,
      status: 'active'
    });
    
    // Login to get token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!'
      });
    
    authToken = loginResponse.body.data.tokens.access_token;
  });
  
  afterAll(async () => {
    const { sequelize } = require('../../src/config/database');
    const redis = require('../../src/config/redis');
    await sequelize.close();
    await redis.quit();
  });
  
  describe('Instance Management', () => {
    describe('POST /api/v1/instances', () => {
      it('should create new instance successfully', async () => {
        // Mock Evolution API response
        evolutionApi.createInstance.mockResolvedValue({
          success: true,
          instance: {
            name: 'test-instance',
            status: 'creating',
            qrcode: 'base64-qr-code-here'
          }
        });
        
        const response = await request(app)
          .post('/api/v1/instances')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'My WhatsApp Instance'
          })
          .expect(201);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.instance).toHaveProperty('id');
        expect(response.body.data.instance.name).toBe('My WhatsApp Instance');
        expect(response.body.data.qr_code).toBeDefined();
        
        testInstance = response.body.data.instance;
      });
      
      it('should fail without authentication', async () => {
        const response = await request(app)
          .post('/api/v1/instances')
          .send({
            name: 'Test Instance'
          })
          .expect(401);
        
        expect(response.body.success).toBe(false);
      });
      
      it('should fail with invalid name', async () => {
        const response = await request(app)
          .post('/api/v1/instances')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'A' // Too short
          })
          .expect(400);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });
    
    describe('GET /api/v1/instances', () => {
      it('should list user instances', async () => {
        const response = await request(app)
          .get('/api/v1/instances')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.instances)).toBe(true);
        expect(response.body.data.instances.length).toBeGreaterThan(0);
      });
    });
    
    describe('GET /api/v1/instances/:id', () => {
      it('should get instance details', async () => {
        const response = await request(app)
          .get(`/api/v1/instances/${testInstance.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.instance.id).toBe(testInstance.id);
        expect(response.body.data.statistics).toBeDefined();
      });
      
      it('should fail for non-existent instance', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        
        const response = await request(app)
          .get(`/api/v1/instances/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
        
        expect(response.body.success).toBe(false);
      });
    });
    
    describe('POST /api/v1/instances/:id/connect', () => {
      it('should get QR code for connection', async () => {
        evolutionApi.connectInstance.mockResolvedValue({
          success: true,
          qrcode: 'new-qr-code-base64',
          state: 'qr'
        });
        
        const response = await request(app)
          .post(`/api/v1/instances/${testInstance.id}/connect`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.qr_code).toBeDefined();
      });
    });
    
    describe('GET /api/v1/instances/:id/status', () => {
      it('should get instance status', async () => {
        evolutionApi.getInstanceState.mockResolvedValue({
          success: true,
          state: 'open',
          instance: {}
        });
        
        const response = await request(app)
          .get(`/api/v1/instances/${testInstance.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBeDefined();
      });
    });
    
    describe('PUT /api/v1/instances/:id', () => {
      it('should update instance settings', async () => {
        evolutionApi.setInstanceSettings.mockResolvedValue({
          success: true
        });
        
        const response = await request(app)
          .put(`/api/v1/instances/${testInstance.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Instance Name',
            settings: {
              reject_calls: true,
              always_online: true
            }
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.instance.name).toBe('Updated Instance Name');
      });
    });
    
    describe('POST /api/v1/instances/:id/restart', () => {
      it('should restart instance', async () => {
        evolutionApi.restartInstance.mockResolvedValue({
          success: true
        });
        
        const response = await request(app)
          .post(`/api/v1/instances/${testInstance.id}/restart`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
    });
  });
  
  describe('Message Sending', () => {
    beforeAll(async () => {
      // Set instance as connected
      const instance = await Instance.findByPk(testInstance.id);
      await instance.setConnected('628123456789');
    });
    
    describe('POST /api/v1/messages/send', () => {
      it('should send text message successfully', async () => {
        evolutionApi.sendTextMessage.mockResolvedValue({
          success: true,
          message: {
            id: 'msg-id-123',
            status: 'sent'
          }
        });
        
        const response = await request(app)
          .post('/api/v1/messages/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            instance_id: testInstance.id,
            to: '628987654321',
            message: 'Test message from automated test'
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.message_id).toBe('msg-id-123');
        expect(response.body.data.log_id).toBeDefined();
      });
      
      it('should fail with invalid phone number', async () => {
        const response = await request(app)
          .post('/api/v1/messages/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            instance_id: testInstance.id,
            to: 'invalid-number',
            message: 'Test message'
          })
          .expect(400);
        
        expect(response.body.success).toBe(false);
      });
      
      it('should fail when instance not connected', async () => {
        // Create disconnected instance
        const disconnectedInstance = await Instance.create({
          user_id: testUser.id,
          name: 'Disconnected Instance',
          instance_name: 'test-disconnected',
          status: 'disconnected'
        });
        
        const response = await request(app)
          .post('/api/v1/messages/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            instance_id: disconnectedInstance.id,
            to: '628987654321',
            message: 'Test message'
          })
          .expect(400);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INSTANCE_NOT_CONNECTED');
      });
    });
    
    describe('POST /api/v1/messages/send-media', () => {
      it('should send media message successfully', async () => {
        evolutionApi.sendMediaMessage.mockResolvedValue({
          success: true,
          message: {
            id: 'msg-media-123',
            status: 'sent'
          }
        });
        
        const response = await request(app)
          .post('/api/v1/messages/send-media')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            instance_id: testInstance.id,
            to: '628987654321',
            media_url: 'https://example.com/image.jpg',
            caption: 'Test image',
            media_type: 'image'
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.message_id).toBeDefined();
      });
    });
    
    describe('GET /api/v1/messages', () => {
      it('should list messages', async () => {
        const response = await request(app)
          .get('/api/v1/messages')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.messages)).toBe(true);
      });
      
      it('should filter messages by instance', async () => {
        const response = await request(app)
          .get(`/api/v1/messages?instance_id=${testInstance.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
    });
    
    describe('GET /api/v1/messages/statistics', () => {
      it('should get message statistics', async () => {
        const response = await request(app)
          .get('/api/v1/messages/statistics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.statistics).toBeDefined();
        expect(response.body.data.daily_stats).toBeDefined();
      });
    });
    
    describe('GET /api/v1/messages/quota', () => {
      it('should get message quota', async () => {
        const response = await request(app)
          .get('/api/v1/messages/quota')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.total).toBeDefined();
      });
    });
  });
  
  describe('Webhook Handling', () => {
    let webhookToken;
    
    beforeAll(async () => {
      const instance = await Instance.findByPk(testInstance.id);
      webhookToken = instance.api_key;
    });
    
    describe('POST /api/v1/webhooks/evolution/:token', () => {
      it('should handle QR code update webhook', async () => {
        const response = await request(app)
          .post(`/api/v1/webhooks/evolution/${webhookToken}`)
          .send({
            event: 'qrcode.updated',
            instance: testInstance.instance_name,
            data: {
              qrcode: 'new-qr-code-base64'
            }
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
      
      it('should handle connection update webhook', async () => {
        const response = await request(app)
          .post(`/api/v1/webhooks/evolution/${webhookToken}`)
          .send({
            event: 'connection.update',
            instance: testInstance.instance_name,
            data: {
              state: 'open',
              instance: {
                wuid: '628123456789@s.whatsapp.net'
              }
            }
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
      
      it('should handle incoming message webhook', async () => {
        const response = await request(app)
          .post(`/api/v1/webhooks/evolution/${webhookToken}`)
          .send({
            event: 'messages.upsert',
            instance: testInstance.instance_name,
            data: {
              messages: [{
                key: {
                  id: 'incoming-msg-123',
                  remoteJid: '628987654321@s.whatsapp.net',
                  fromMe: false
                },
                message: {
                  conversation: 'Hello from webhook test'
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
              }]
            }
          })
          .expect(200);
        
        expect(response.body.success).toBe(true);
      });
    });
  });
  
  describe('Instance Model', () => {
    it('should check if instance is connected', async () => {
      const instance = await Instance.findByPk(testInstance.id);
      expect(instance.isConnected()).toBe(true);
    });
    
    it('should check daily quota', async () => {
      const instance = await Instance.findByPk(testInstance.id);
      const quota = instance.checkDailyQuota();
      
      expect(quota).toHaveProperty('used');
      expect(quota).toHaveProperty('limit');
      expect(quota).toHaveProperty('remaining');
      expect(quota).toHaveProperty('exceeded');
    });
    
    it('should increment message sent', async () => {
      const instance = await Instance.findByPk(testInstance.id);
      const beforeCount = instance.statistics.messages_sent || 0;
      
      await instance.incrementMessageSent();
      await instance.reload();
      
      expect(instance.statistics.messages_sent).toBe(beforeCount + 1);
    });
  });
  
  describe('MessageLog Model', () => {
    it('should create outbound message log', async () => {
      const messageLog = await MessageLog.createOutbound({
        userId: testUser.id,
        instanceId: testInstance.id,
        toNumber: '628987654321',
        messageType: 'text',
        messageContent: 'Test message'
      });
      
      expect(messageLog).toHaveProperty('id');
      expect(messageLog.direction).toBe('outbound');
      expect(messageLog.status).toBe('pending');
    });
    
    it('should mark message as sent', async () => {
      const messageLog = await MessageLog.createOutbound({
        userId: testUser.id,
        instanceId: testInstance.id,
        toNumber: '628987654321',
        messageContent: 'Test message'
      });
      
      await messageLog.markAsSent('test-msg-id-123');
      
      expect(messageLog.status).toBe('sent');
      expect(messageLog.message_id).toBe('test-msg-id-123');
      expect(messageLog.sent_at).toBeDefined();
    });
    
    it('should get message statistics', async () => {
      const stats = await MessageLog.getStatistics(testUser.id);
      
      expect(stats).toHaveProperty('total_messages');
      expect(stats).toHaveProperty('messages_sent');
      expect(stats).toHaveProperty('messages_received');
    });
  });
});
