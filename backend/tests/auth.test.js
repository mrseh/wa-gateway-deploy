const request = require('supertest');
const { app } = require('../../src/index');
const User = require('../../src/models/User');
const jwtService = require('../../src/services/jwt.service');
const emailService = require('../../src/services/email.service');

/**
 * Authentication Tests
 * Unit and integration tests for authentication system
 */

// Mock email service
jest.mock('../../src/services/email.service');

describe('Authentication System', () => {
  let testUser;
  let authToken;
  
  beforeAll(async () => {
    // Setup test database
    const { sequelize } = require('../../src/config/database');
    await sequelize.sync({ force: true });
  });
  
  afterAll(async () => {
    // Cleanup
    const { sequelize } = require('../../src/config/database');
    const redis = require('../../src/config/redis');
    await sequelize.close();
    await redis.quit();
  });
  
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
        company_name: 'Test Company'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.verification_required).toBe(true);
      
      // Verify email service was called
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
      
      testUser = response.body.data.user;
    });
    
    it('should fail with duplicate email', async () => {
      const userData = {
        name: 'Another User',
        email: 'test@example.com', // Same email
        password: 'SecurePass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });
    
    it('should fail with weak password', async () => {
      const userData = {
        name: 'Test User 2',
        email: 'test2@example.com',
        password: 'weak' // Too weak
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
    
    it('should fail with invalid email', async () => {
      const userData = {
        name: 'Test User 3',
        email: 'invalid-email',
        password: 'SecurePass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email successfully', async () => {
      // Get user and set verification token
      const user = await User.findByEmail('test@example.com');
      const token = await user.setEmailVerificationToken();
      
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email_verified).toBe(true);
      expect(response.body.data.user.status).toBe('active');
    });
    
    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
  
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.tokens).toHaveProperty('access_token');
      expect(response.body.data.tokens).toHaveProperty('refresh_token');
      
      authToken = response.body.data.tokens.access_token;
    });
    
    it('should fail with wrong password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    
    it('should fail with non-existent email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
    
    it('should lock account after 5 failed attempts', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword!'
      };
      
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send(credentials);
      }
      
      // 6th attempt should return account locked
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(423);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
      
      // Reset for other tests
      const user = await User.findByEmail(credentials.email);
      await user.resetLoginAttempts();
    });
  });
  
  describe('GET /api/v1/auth/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.statistics).toBeDefined();
    });
    
    it('should fail without auth token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
    
    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
  
  describe('PUT /api/v1/auth/profile', () => {
    it('should update user profile', async () => {
      const updates = {
        name: 'Updated Name',
        company_name: 'Updated Company'
      };
      
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe(updates.name);
      expect(response.body.data.user.company_name).toBe(updates.company_name);
    });
  });
  
  describe('POST /api/v1/auth/change-password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'SecurePass123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toHaveProperty('access_token');
      
      // Update auth token for subsequent tests
      authToken = response.body.data.tokens.access_token;
      
      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewSecurePass123!'
        })
        .expect(200);
      
      expect(loginResponse.body.success).toBe(true);
    });
    
    it('should fail with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!'
      };
      
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });
  });
  
  describe('POST /api/v1/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
    
    it('should not reveal if email does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      // Same response as if email exists (security)
    });
  });
  
  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Get user and set reset token
      const user = await User.findByEmail('test@example.com');
      const token = await user.setPasswordResetToken();
      
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token,
          password: 'ResetPass123!',
          confirmPassword: 'ResetPass123!'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'ResetPass123!'
        })
        .expect(200);
      
      expect(loginResponse.body.success).toBe(true);
    });
  });
  
  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verify token is blacklisted
      const meResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
      
      expect(meResponse.body.error.code).toBe('TOKEN_BLACKLISTED');
    });
  });
  
  describe('JWT Service', () => {
    it('should generate token pair', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      };
      
      const tokens = jwtService.generateTokenPair(user);
      
      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(tokens).toHaveProperty('expires_in');
      expect(tokens).toHaveProperty('token_type', 'Bearer');
    });
    
    it('should verify access token', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      };
      
      const token = jwtService.generateAccessToken(user);
      const decoded = await jwtService.verifyAccessToken(token);
      
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });
    
    it('should blacklist token', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      };
      
      const token = jwtService.generateAccessToken(user);
      await jwtService.blacklistToken(token);
      
      const isBlacklisted = await jwtService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });
  });
  
  describe('User Model', () => {
    it('should hash password before saving', async () => {
      const userData = {
        name: 'Test User 4',
        email: 'test4@example.com',
        password: 'PlainPassword123!'
      };
      
      const user = await User.createUser(userData);
      
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // Bcrypt hash pattern
    });
    
    it('should verify password correctly', async () => {
      const user = await User.findByEmail('test4@example.com');
      
      const isValid = await user.verifyPassword('PlainPassword123!');
      expect(isValid).toBe(true);
      
      const isInvalid = await user.verifyPassword('WrongPassword!');
      expect(isInvalid).toBe(false);
    });
  });
});
