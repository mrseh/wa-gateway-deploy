// Email service
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email server connection failed:', error);
  } else {
    logger.info('Email server ready');
  }
});

// Send verification email
exports.sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  
  try {
    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Verify your email address',
      html: `
        <h1>Email Verification</h1>
        <p>Thank you for registering with WhatsApp Gateway!</p>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `
    });
    
    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error);
    throw error;
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  
  try {
    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Reset your password',
      html: `
        <h1>Password Reset</h1>
        <p>You requested to reset your password.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
    
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error);
    throw error;
  }
};

// Send welcome email
exports.sendWelcomeEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: 'Welcome to WhatsApp Gateway!',
      html: `
        <h1>Welcome ${name}!</h1>
        <p>Thank you for joining WhatsApp Gateway.</p>
        <p>You can now start creating WhatsApp instances and sending messages.</p>
        <p>Visit your dashboard: <a href="${config.frontendUrl}/dashboard">${config.frontendUrl}/dashboard</a></p>
        <p>If you have any questions, feel free to contact our support team.</p>
      `
    });
    
    logger.info(`Welcome email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send welcome email to ${email}:`, error);
  }
};

module.exports = exports;
