const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Email Service
 * Handles email sending with templates and retry logic
 */

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter
 */
function initializeTransporter() {
  if (transporter) {
    return transporter;
  }
  
  transporter = nodemailer.createTransporter({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.auth.user,
      pass: config.smtp.auth.pass
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
  });
  
  // Verify connection
  transporter.verify((error) => {
    if (error) {
      logger.error('SMTP connection error:', error);
    } else {
      logger.info('✓ SMTP server ready');
    }
  });
  
  return transporter;
}

/**
 * Send email with retry logic
 * @param {Object} mailOptions - Email options
 * @param {number} retries - Number of retries
 * @returns {Promise<Object>}
 */
async function sendEmail(mailOptions, retries = 3) {
  const transport = initializeTransporter();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transport.sendMail(mailOptions);
      
      logger.info('Email sent successfully:', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        messageId: info.messageId
      });
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      logger.error(`Email send attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

/**
 * Email templates
 */
const templates = {
  /**
   * Email verification template
   * @param {Object} data - Template data
   * @returns {Object} Email options
   */
  emailVerification: (data) => {
    const verificationUrl = `${config.app.url}/verify-email?token=${data.token}`;
    
    return {
      subject: 'Verify Your Email - WhatsApp Gateway',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to WhatsApp Gateway!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              
              <p>Thank you for registering with WhatsApp Gateway. Please verify your email address to activate your account.</p>
              
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4CAF50;">${verificationUrl}</p>
              
              <p>This verification link will expire in 24 hours.</p>
              
              <p>If you didn't create an account, please ignore this email.</p>
              
              <p>Best regards,<br>WhatsApp Gateway Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} WhatsApp Gateway. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to WhatsApp Gateway!
        
        Hi ${data.name},
        
        Thank you for registering. Please verify your email address by clicking the link below:
        
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, please ignore this email.
        
        Best regards,
        WhatsApp Gateway Team
      `
    };
  },
  
  /**
   * Password reset template
   * @param {Object} data - Template data
   * @returns {Object} Email options
   */
  passwordReset: (data) => {
    const resetUrl = `${config.app.url}/reset-password?token=${data.token}`;
    
    return {
      subject: 'Reset Your Password - WhatsApp Gateway',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #FF9800;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p>This password reset link will expire in 1 hour. If you didn't request this, please ignore this email and your password will remain unchanged.</p>
              </div>
              
              <p>For security reasons, we recommend:</p>
              <ul>
                <li>Using a strong, unique password</li>
                <li>Not sharing your password with anyone</li>
                <li>Changing your password regularly</li>
              </ul>
              
              <p>Best regards,<br>WhatsApp Gateway Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} WhatsApp Gateway. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request
        
        Hi ${data.name},
        
        We received a request to reset your password. Click the link below to create a new password:
        
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this, please ignore this email.
        
        Best regards,
        WhatsApp Gateway Team
      `
    };
  },
  
  /**
   * Welcome email template
   * @param {Object} data - Template data
   * @returns {Object} Email options
   */
  welcome: (data) => {
    return {
      subject: 'Welcome to WhatsApp Gateway!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .features { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .feature { margin: 15px 0; padding-left: 25px; position: relative; }
            .feature:before { content: "✓"; position: absolute; left: 0; color: #4CAF50; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to WhatsApp Gateway!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              
              <p>Your account has been successfully activated! You can now start using WhatsApp Gateway to automate your WhatsApp communication.</p>
              
              <div class="features">
                <h3>What you can do:</h3>
                <div class="feature">Create and manage multiple WhatsApp instances</div>
                <div class="feature">Send and receive messages programmatically</div>
                <div class="feature">Monitor your network with OLT & PON Port tracking</div>
                <div class="feature">Integrate with Mikrotik and Zabbix</div>
                <div class="feature">Access comprehensive analytics and reports</div>
              </div>
              
              <center>
                <a href="${config.app.url}/dashboard" class="button">Go to Dashboard</a>
              </center>
              
              <p>Need help getting started? Check out our <a href="${config.app.url}/docs">documentation</a> or contact our support team.</p>
              
              <p>Best regards,<br>WhatsApp Gateway Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} WhatsApp Gateway. All rights reserved.</p>
              <p><a href="${config.app.url}">Website</a> | <a href="${config.app.url}/docs">Documentation</a> | <a href="${config.app.url}/support">Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to WhatsApp Gateway!
        
        Hi ${data.name},
        
        Your account has been successfully activated! You can now start using WhatsApp Gateway.
        
        Visit your dashboard: ${config.app.url}/dashboard
        
        What you can do:
        - Create and manage multiple WhatsApp instances
        - Send and receive messages programmatically
        - Monitor your network with OLT & PON Port tracking
        - Integrate with Mikrotik and Zabbix
        - Access comprehensive analytics and reports
        
        Need help? Visit our documentation: ${config.app.url}/docs
        
        Best regards,
        WhatsApp Gateway Team
      `
    };
  },
  
  /**
   * Password changed notification
   * @param {Object} data - Template data
   * @returns {Object} Email options
   */
  passwordChanged: (data) => {
    return {
      subject: 'Password Changed - WhatsApp Gateway',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .info { background: #e3f2fd; border: 1px solid #2196F3; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Changed</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              
              <p>This is a confirmation that your password was successfully changed.</p>
              
              <div class="info">
                <strong>ℹ️ Details:</strong>
                <p>Time: ${new Date().toLocaleString()}<br>
                IP Address: ${data.ip || 'Unknown'}</p>
              </div>
              
              <p>If you did not make this change, please contact our support team immediately and secure your account.</p>
              
              <p>For account security, we recommend:</p>
              <ul>
                <li>Using a strong, unique password</li>
                <li>Enabling two-factor authentication</li>
                <li>Regularly reviewing your account activity</li>
              </ul>
              
              <p>Best regards,<br>WhatsApp Gateway Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} WhatsApp Gateway. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Changed
        
        Hi ${data.name},
        
        This is a confirmation that your password was successfully changed.
        
        Time: ${new Date().toLocaleString()}
        IP Address: ${data.ip || 'Unknown'}
        
        If you did not make this change, please contact support immediately.
        
        Best regards,
        WhatsApp Gateway Team
      `
    };
  }
};

/**
 * Send verification email
 * @param {Object} user - User object
 * @param {string} token - Verification token
 * @returns {Promise<Object>}
 */
async function sendVerificationEmail(user, token) {
  try {
    const template = templates.emailVerification({
      name: user.name,
      email: user.email,
      token
    });
    
    const mailOptions = {
      from: `"${config.smtp.from.name}" <${config.smtp.from.email}>`,
      to: user.email,
      ...template
    };
    
    return await sendEmail(mailOptions);
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param {Object} user - User object
 * @param {string} token - Reset token
 * @returns {Promise<Object>}
 */
async function sendPasswordResetEmail(user, token) {
  try {
    const template = templates.passwordReset({
      name: user.name,
      email: user.email,
      token
    });
    
    const mailOptions = {
      from: `"${config.smtp.from.name}" <${config.smtp.from.email}>`,
      to: user.email,
      ...template
    };
    
    return await sendEmail(mailOptions);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
}

/**
 * Send welcome email
 * @param {Object} user - User object
 * @returns {Promise<Object>}
 */
async function sendWelcomeEmail(user) {
  try {
    const template = templates.welcome({
      name: user.name,
      email: user.email
    });
    
    const mailOptions = {
      from: `"${config.smtp.from.name}" <${config.smtp.from.email}>`,
      to: user.email,
      ...template
    };
    
    return await sendEmail(mailOptions);
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
}

/**
 * Send password changed notification
 * @param {Object} user - User object
 * @param {string} ip - IP address
 * @returns {Promise<Object>}
 */
async function sendPasswordChangedEmail(user, ip) {
  try {
    const template = templates.passwordChanged({
      name: user.name,
      email: user.email,
      ip
    });
    
    const mailOptions = {
      from: `"${config.smtp.from.name}" <${config.smtp.from.email}>`,
      to: user.email,
      ...template
    };
    
    return await sendEmail(mailOptions);
  } catch (error) {
    logger.error('Error sending password changed email:', error);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  templates
};
