const Joi = require('joi');
const logger = require('../config/logger');

/**
 * Validation Middleware
 * Handles request validation using Joi schemas
 */

/**
 * Password validation regex
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

/**
 * Phone number validation regex
 * Indonesian format: 62xxx or 08xxx
 */
const PHONE_REGEX = /^(\+?62|0)[0-9]{9,13}$/;

/**
 * Validation schemas
 */
const schemas = {
  // Authentication
  register: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name must not exceed 255 characters'
      }),
    
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Email must be a valid email address'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(PASSWORD_REGEX)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    
    company_name: Joi.string()
      .max(255)
      .optional()
      .allow('', null),
    
    phone: Joi.string()
      .pattern(PHONE_REGEX)
      .optional()
      .allow('', null)
      .messages({
        'string.pattern.base': 'Phone number must be a valid Indonesian number (e.g., 08xxx or 62xxx)'
      })
  }),
  
  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Email must be a valid email address'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'string.empty': 'Password is required'
      })
  }),
  
  verifyEmail: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'string.empty': 'Verification token is required'
      })
  }),
  
  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Email must be a valid email address'
      })
  }),
  
  resetPassword: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'string.empty': 'Reset token is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(PASSWORD_REGEX)
      .required()
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'string.empty': 'Password confirmation is required'
      })
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'string.empty': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(PASSWORD_REGEX)
      .invalid(Joi.ref('currentPassword'))
      .required()
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.invalid': 'New password must be different from current password'
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'string.empty': 'Password confirmation is required'
      })
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'string.empty': 'Refresh token is required'
      })
  }),
  
  // Profile
  updateProfile: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .optional(),
    
    phone: Joi.string()
      .pattern(PHONE_REGEX)
      .optional()
      .allow('', null),
    
    company_name: Joi.string()
      .max(255)
      .optional()
      .allow('', null),
    
    company_address: Joi.string()
      .max(1000)
      .optional()
      .allow('', null),
    
    timezone: Joi.string()
      .max(50)
      .optional(),
    
    language: Joi.string()
      .max(10)
      .optional()
  }),
  
  // Instance
  createInstance: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.empty': 'Instance name is required',
        'string.min': 'Name must be at least 2 characters'
      })
  }),
  
  updateInstance: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .optional(),
    
    settings: Joi.object()
      .optional()
  }),
  
  // Message
  sendMessage: Joi.object({
    instance_id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.empty': 'Instance ID is required',
        'string.guid': 'Invalid instance ID format'
      }),
    
    to: Joi.string()
      .pattern(PHONE_REGEX)
      .required()
      .messages({
        'string.empty': 'Recipient number is required',
        'string.pattern.base': 'Invalid phone number format'
      }),
    
    message: Joi.string()
      .max(4096)
      .required()
      .messages({
        'string.empty': 'Message is required',
        'string.max': 'Message must not exceed 4096 characters'
      })
  }),
  
  // OLT
  createOLT: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .required(),
    
    vendor: Joi.string()
      .valid('ZTE', 'Huawei', 'FiberHome', 'VSOL', 'Other')
      .required(),
    
    model: Joi.string()
      .max(100)
      .optional()
      .allow('', null),
    
    ip_address: Joi.string()
      .ip({ version: ['ipv4'] })
      .required()
      .messages({
        'string.ip': 'Invalid IP address format'
      }),
    
    snmp_community: Joi.string()
      .max(255)
      .required(),
    
    snmp_port: Joi.number()
      .integer()
      .min(1)
      .max(65535)
      .default(161),
    
    location: Joi.string()
      .max(255)
      .optional()
      .allow('', null)
  })
};

/**
 * Validate request data against schema
 * @param {string} schemaName - Name of validation schema
 * @param {string} source - Source of data ('body', 'query', 'params')
 */
const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      logger.error(`Validation schema '${schemaName}' not found`);
      return next();
    }
    
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));
      
      logger.debug('Validation error:', { schemaName, errors });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors
        }
      });
    }
    
    // Replace request data with validated data
    req[source] = value;
    next();
  };
};

/**
 * Custom validators
 */
const validators = {
  /**
   * Validate UUID
   * @param {string} value - UUID to validate
   * @returns {boolean}
   */
  isUUID: (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },
  
  /**
   * Validate phone number
   * @param {string} value - Phone number to validate
   * @returns {boolean}
   */
  isPhone: (value) => {
    return PHONE_REGEX.test(value);
  },
  
  /**
   * Validate strong password
   * @param {string} value - Password to validate
   * @returns {boolean}
   */
  isStrongPassword: (value) => {
    return value.length >= 8 && PASSWORD_REGEX.test(value);
  },
  
  /**
   * Validate email
   * @param {string} value - Email to validate
   * @returns {boolean}
   */
  isEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  /**
   * Validate IP address
   * @param {string} value - IP address to validate
   * @returns {boolean}
   */
  isIPAddress: (value) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(value);
  }
};

/**
 * Sanitize input data
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
function sanitizeInput(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Trim whitespace
      sanitized[key] = value.trim();
      
      // Remove null bytes
      sanitized[key] = sanitized[key].replace(/\0/g, '');
      
      // Normalize email
      if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitized[key].toLowerCase();
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitization middleware
 */
const sanitize = (source = 'body') => {
  return (req, res, next) => {
    if (req[source]) {
      req[source] = sanitizeInput(req[source]);
    }
    next();
  };
};

module.exports = {
  validate,
  validators,
  sanitize,
  schemas,
  PASSWORD_REGEX,
  PHONE_REGEX
};
