const User = require('../models/User');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

/**
 * Authentication Controller
 * Handles user authentication operations
 */

/**
 * Register new user
 * @route POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, company_name, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    
    if (existingUser) {
      throw new AppError('Email already registered', 400, 'EMAIL_EXISTS');
    }
    
    // Create user
    const user = await User.createUser({
      name,
      email,
      password,
      company_name,
      phone,
      status: 'inactive' // Will be activated after email verification
    });
    
    // Generate verification token
    const verificationToken = await user.setEmailVerificationToken();
    
    // Send verification email
    try {
      await emailService.sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }
    
    logger.logAuth('user_registered', user, { ip: req.ip });
    
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: user.toSafeObject(),
        verification_required: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip;
    
    // Find user
    const user = await User.findByEmail(email);
    
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    // Check if account is locked
    if (user.isLocked()) {
      const remainingTime = Math.ceil((user.locked_until - new Date()) / 1000 / 60);
      throw new AppError(
        `Account is locked due to too many failed login attempts. Try again in ${remainingTime} minutes.`,
        423,
        'ACCOUNT_LOCKED',
        { locked_until: user.locked_until, remaining_minutes: remainingTime }
      );
    }
    
    // Check if account is deleted or suspended
    if (user.status === 'deleted') {
      throw new AppError('Account has been deleted', 403, 'ACCOUNT_DELETED');
    }
    
    if (user.status === 'suspended') {
      throw new AppError('Account has been suspended', 403, 'ACCOUNT_SUSPENDED');
    }
    
    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      await user.incrementLoginAttempts();
      
      logger.logAuth('login_failed', user, { ip, reason: 'invalid_password' });
      
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    
    // Update last login
    await user.updateLastLogin(ip);
    
    // Generate tokens
    const tokens = jwtService.generateTokenPair(user);
    
    // Store refresh token
    const refreshDecoded = jwtService.decodeToken(tokens.refresh_token);
    const expiresIn = refreshDecoded.exp - Math.floor(Date.now() / 1000);
    await jwtService.storeRefreshToken(user.id, tokens.refresh_token, expiresIn);
    
    logger.logAuth('login_success', user, { ip });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 * @route POST /api/v1/auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    // Find user by verification token
    const user = await User.findOne({
      where: {
        email_verification_token: token
      }
    });
    
    if (!user) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }
    
    // Verify email
    const verified = await user.verifyEmail(token);
    
    if (!verified) {
      throw new AppError('Verification token has expired', 400, 'TOKEN_EXPIRED');
    }
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
    }
    
    logger.logAuth('email_verified', user);
    
    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now active.',
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend verification email
 * @route POST /api/v1/auth/resend-verification
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If your email is registered, you will receive a verification email.'
      });
      return;
    }
    
    if (user.email_verified) {
      throw new AppError('Email is already verified', 400, 'ALREADY_VERIFIED');
    }
    
    // Generate new verification token
    const verificationToken = await user.setEmailVerificationToken();
    
    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken);
    
    logger.logAuth('verification_resent', user);
    
    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findByEmail(email);
    
    // Don't reveal if email exists
    if (!user) {
      res.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.'
      });
      return;
    }
    
    // Generate reset token
    const resetToken = await user.setPasswordResetToken();
    
    // Send reset email
    await emailService.sendPasswordResetEmail(user, resetToken);
    
    logger.logAuth('password_reset_requested', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Password reset link sent. Please check your email.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route POST /api/v1/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    
    // Find user by reset token
    const user = await User.findOne({
      where: {
        password_reset_token: token
      }
    });
    
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }
    
    // Reset password
    const reset = await user.resetPassword(token, password);
    
    if (!reset) {
      throw new AppError('Reset token has expired', 400, 'TOKEN_EXPIRED');
    }
    
    // Blacklist all existing tokens
    await jwtService.blacklistUserTokens(user.id);
    
    // Send confirmation email
    try {
      await emailService.sendPasswordChangedEmail(user, req.ip);
    } catch (emailError) {
      logger.error('Failed to send password changed email:', emailError);
    }
    
    logger.logAuth('password_reset', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password (authenticated)
 * @route POST /api/v1/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    
    // Verify current password
    const isPasswordValid = await user.verifyPassword(currentPassword);
    
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }
    
    // Update password
    user.password = newPassword; // Will be hashed by hook
    await user.save();
    
    // Blacklist all existing tokens
    await jwtService.blacklistUserTokens(user.id);
    
    // Generate new tokens
    const tokens = jwtService.generateTokenPair(user);
    
    // Store new refresh token
    const refreshDecoded = jwtService.decodeToken(tokens.refresh_token);
    const expiresIn = refreshDecoded.exp - Math.floor(Date.now() / 1000);
    await jwtService.storeRefreshToken(user.id, tokens.refresh_token, expiresIn);
    
    // Send confirmation email
    try {
      await emailService.sendPasswordChangedEmail(user, req.ip);
    } catch (emailError) {
      logger.error('Failed to send password changed email:', emailError);
    }
    
    logger.logAuth('password_changed', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Password changed successfully',
      data: {
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/v1/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const user = req.user; // Attached by verifyRefreshToken middleware
    const oldRefreshToken = req.refreshToken;
    
    // Rotate refresh token
    const tokens = await jwtService.rotateRefreshToken(user, oldRefreshToken);
    
    logger.logAuth('token_refreshed', user);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const user = req.user;
    const token = req.token;
    
    // Blacklist current access token
    await jwtService.blacklistToken(token);
    
    // Delete stored refresh token
    await jwtService.deleteRefreshToken(user.id);
    
    logger.logAuth('logout', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices
 * @route POST /api/v1/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Blacklist all user tokens
    await jwtService.blacklistUserTokens(user.id);
    
    logger.logAuth('logout_all', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/v1/auth/me
 */
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Get user statistics
    const statistics = await User.getStatistics(user.id);
    
    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        statistics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/v1/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const updates = req.body;
    
    // Update user
    await user.update(updates);
    
    logger.logAuth('profile_updated', user);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete account
 * @route DELETE /api/v1/auth/account
 */
const deleteAccount = async (req, res, next) => {
  try {
    const user = req.user;
    const { password } = req.body;
    
    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    
    if (!isPasswordValid) {
      throw new AppError('Password is incorrect', 401, 'INVALID_PASSWORD');
    }
    
    // Soft delete user
    await User.deleteUser(user.id);
    
    // Blacklist all tokens
    await jwtService.blacklistUserTokens(user.id);
    
    logger.logAuth('account_deleted', user, { ip: req.ip });
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify token (check if valid)
 * @route POST /api/v1/auth/verify-token
 */
const verifyToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    // Check if blacklisted
    if (await jwtService.isTokenBlacklisted(token)) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_BLACKLISTED');
    }
    
    // Verify token
    const decoded = await jwtService.verifyAccessToken(token);
    
    // Get user
    const user = await User.findByPk(decoded.userId);
    
    if (!user || user.status !== 'active') {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: user.toSafeObject(),
        decoded: {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          exp: decoded.exp,
          iat: decoded.iat
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
  updateProfile,
  deleteAccount,
  verifyToken
};
