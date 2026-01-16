const { sequelize, Sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * User Model
 * Handles user data and authentication operations
 */

const User = sequelize.define('User', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  name: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  phone: {
    type: Sequelize.STRING(20),
    allowNull: true,
    unique: true
  },
  company_name: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  company_address: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  role: {
    type: Sequelize.ENUM('admin', 'user'),
    defaultValue: 'user',
    allowNull: false
  },
  status: {
    type: Sequelize.ENUM('active', 'inactive', 'suspended', 'deleted'),
    defaultValue: 'inactive',
    allowNull: false
  },
  email_verified: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  email_verification_token: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  email_verification_expires: {
    type: Sequelize.DATE,
    allowNull: true
  },
  password_reset_token: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  password_reset_expires: {
    type: Sequelize.DATE,
    allowNull: true
  },
  last_login_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  last_login_ip: {
    type: Sequelize.INET,
    allowNull: true
  },
  login_attempts: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  locked_until: {
    type: Sequelize.DATE,
    allowNull: true
  },
  two_factor_enabled: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  two_factor_secret: {
    type: Sequelize.STRING(255),
    allowNull: true
  },
  avatar_url: {
    type: Sequelize.STRING(500),
    allowNull: true
  },
  timezone: {
    type: Sequelize.STRING(50),
    defaultValue: 'Asia/Jakarta',
    allowNull: false
  },
  language: {
    type: Sequelize.STRING(10),
    defaultValue: 'id',
    allowNull: false
  },
  metadata: {
    type: Sequelize.JSONB,
    defaultValue: {},
    allowNull: false
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeCreate: async (user) => {
      // Hash password before creating user
      if (user.password) {
        user.password = await User.hashPassword(user.password);
      }
    },
    beforeUpdate: async (user) => {
      // Hash password if changed
      if (user.changed('password')) {
        user.password = await User.hashPassword(user.password);
      }
    }
  }
});

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
User.hashPassword = async function(password) {
  const config = require('../config');
  const saltRounds = config.security.bcryptRounds;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>}
 */
User.comparePassword = async function(password, hash) {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate email verification token
 * @returns {string}
 */
User.generateVerificationToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate password reset token
 * @returns {string}
 */
User.generateResetToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Instance Methods
 */

/**
 * Verify password for this user
 * @param {string} password - Plain text password
 * @returns {Promise<boolean>}
 */
User.prototype.verifyPassword = async function(password) {
  return await User.comparePassword(password, this.password);
};

/**
 * Check if account is locked
 * @returns {boolean}
 */
User.prototype.isLocked = function() {
  return this.locked_until && new Date() < this.locked_until;
};

/**
 * Increment login attempts
 * @returns {Promise<void>}
 */
User.prototype.incrementLoginAttempts = async function() {
  this.login_attempts += 1;
  
  // Lock account after 5 failed attempts for 15 minutes
  if (this.login_attempts >= 5) {
    this.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    logger.logSecurity('account_locked', {
      userId: this.id,
      email: this.email,
      attempts: this.login_attempts
    });
  }
  
  await this.save();
};

/**
 * Reset login attempts
 * @returns {Promise<void>}
 */
User.prototype.resetLoginAttempts = async function() {
  this.login_attempts = 0;
  this.locked_until = null;
  await this.save();
};

/**
 * Update last login
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
User.prototype.updateLastLogin = async function(ip) {
  this.last_login_at = new Date();
  this.last_login_ip = ip;
  await this.save();
  
  logger.logAuth('login_success', this, { ip });
};

/**
 * Set email verification token
 * @returns {Promise<string>} Verification token
 */
User.prototype.setEmailVerificationToken = async function() {
  this.email_verification_token = User.generateVerificationToken();
  this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await this.save();
  
  return this.email_verification_token;
};

/**
 * Verify email with token
 * @param {string} token - Verification token
 * @returns {Promise<boolean>}
 */
User.prototype.verifyEmail = async function(token) {
  if (!this.email_verification_token || this.email_verification_token !== token) {
    return false;
  }
  
  if (new Date() > this.email_verification_expires) {
    return false;
  }
  
  this.email_verified = true;
  this.status = 'active';
  this.email_verification_token = null;
  this.email_verification_expires = null;
  await this.save();
  
  logger.logAuth('email_verified', this);
  return true;
};

/**
 * Set password reset token
 * @returns {Promise<string>} Reset token
 */
User.prototype.setPasswordResetToken = async function() {
  this.password_reset_token = User.generateResetToken();
  this.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await this.save();
  
  return this.password_reset_token;
};

/**
 * Reset password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>}
 */
User.prototype.resetPassword = async function(token, newPassword) {
  if (!this.password_reset_token || this.password_reset_token !== token) {
    return false;
  }
  
  if (new Date() > this.password_reset_expires) {
    return false;
  }
  
  this.password = newPassword; // Will be hashed by hook
  this.password_reset_token = null;
  this.password_reset_expires = null;
  await this.save();
  
  logger.logAuth('password_reset', this);
  return true;
};

/**
 * Get safe user data (without sensitive fields)
 * @returns {Object}
 */
User.prototype.toSafeObject = function() {
  const { 
    password, 
    email_verification_token, 
    password_reset_token, 
    two_factor_secret,
    ...safeData 
  } = this.get({ plain: true });
  
  return safeData;
};

/**
 * Class Methods
 */

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<User|null>}
 */
User.findByEmail = async function(email) {
  try {
    return await User.findOne({ 
      where: { 
        email: email.toLowerCase().trim() 
      } 
    });
  } catch (error) {
    logger.error('Error finding user by email:', error);
    throw error;
  }
};

/**
 * Find user by ID with relations
 * @param {string} id - User ID
 * @param {Object} options - Query options
 * @returns {Promise<User|null>}
 */
User.findByIdWithRelations = async function(id, options = {}) {
  try {
    return await User.findByPk(id, {
      include: options.include || [],
      attributes: options.attributes
    });
  } catch (error) {
    logger.error('Error finding user by ID:', error);
    throw error;
  }
};

/**
 * Create new user with validation
 * @param {Object} userData - User data
 * @returns {Promise<User>}
 */
User.createUser = async function(userData) {
  try {
    // Normalize email
    if (userData.email) {
      userData.email = userData.email.toLowerCase().trim();
    }
    
    // Check if email exists
    const existingUser = await User.findByEmail(userData.email);
    if (existingUser) {
      const error = new Error('Email already exists');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }
    
    // Create user
    const user = await User.create(userData);
    
    logger.logAuth('user_created', user);
    return user;
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user with validation
 * @param {string} id - User ID
 * @param {Object} updateData - Update data
 * @returns {Promise<User>}
 */
User.updateUser = async function(id, updateData) {
  try {
    const user = await User.findByPk(id);
    
    if (!user) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    
    // Don't allow updating sensitive fields directly
    delete updateData.password;
    delete updateData.email_verified;
    delete updateData.email_verification_token;
    delete updateData.password_reset_token;
    
    await user.update(updateData);
    
    logger.logAuth('user_updated', user);
    return user;
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete user (soft delete)
 * @param {string} id - User ID
 * @returns {Promise<boolean>}
 */
User.deleteUser = async function(id) {
  try {
    const user = await User.findByPk(id);
    
    if (!user) {
      return false;
    }
    
    user.status = 'deleted';
    await user.save();
    await user.destroy(); // Soft delete
    
    logger.logAuth('user_deleted', user);
    return true;
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
User.getStatistics = async function(userId) {
  try {
    const [results] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM instances WHERE user_id = :userId AND deleted_at IS NULL) as total_instances,
        (SELECT COUNT(*) FROM instances WHERE user_id = :userId AND status = 'connected') as connected_instances,
        (SELECT COUNT(*) FROM message_logs WHERE user_id = :userId AND direction = 'outbound') as messages_sent,
        (SELECT COUNT(*) FROM olts WHERE user_id = :userId AND deleted_at IS NULL) as total_olts,
        (SELECT status FROM subscriptions WHERE user_id = :userId AND status IN ('active', 'trial') LIMIT 1) as subscription_status
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return results[0] || {};
  } catch (error) {
    logger.error('Error getting user statistics:', error);
    throw error;
  }
};

/**
 * Search users with filters
 * @param {Object} filters - Search filters
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
User.searchUsers = async function(filters = {}, options = {}) {
  try {
    const where = {};
    
    // Apply filters
    if (filters.email) {
      where.email = { [Sequelize.Op.iLike]: `%${filters.email}%` };
    }
    
    if (filters.name) {
      where.name = { [Sequelize.Op.iLike]: `%${filters.name}%` };
    }
    
    if (filters.role) {
      where.role = filters.role;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    // Pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    // Execute query
    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: options.order || [['created_at', 'DESC']],
      attributes: { exclude: ['password', 'email_verification_token', 'password_reset_token', 'two_factor_secret'] }
    });
    
    return {
      total: count,
      users: rows,
      limit,
      offset,
      pages: Math.ceil(count / limit)
    };
  } catch (error) {
    logger.error('Error searching users:', error);
    throw error;
  }
};

module.exports = User;
