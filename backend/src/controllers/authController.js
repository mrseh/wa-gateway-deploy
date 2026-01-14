// Authentication controller
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { asyncHandler, AppError } = require('../middlewares/errorHandler');
const config = require('../config');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

// @desc    Register new user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { email, password, name, phone, companyName } = req.body;
  
  // Check if registration is enabled
  if (!config.features.enableRegistration) {
    throw new AppError('Registration is currently disabled', 403, 'REGISTRATION_DISABLED');
  }
  
  // Validate input
  if (!email || !password || !name) {
    throw new AppError('Please provide email, password, and name', 400, 'VALIDATION_ERROR');
  }
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone,
      companyName,
      verificationToken,
      verificationExpiresAt,
      isVerified: !config.features.enableEmailVerification
    },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      createdAt: true
    }
  });
  
  // Send verification email
  if (config.features.enableEmailVerification) {
    await emailService.sendVerificationEmail(user.email, verificationToken);
  }
  
  res.status(201).json({
    success: true,
    data: {
      user,
      message: config.features.enableEmailVerification 
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. You can now login.'
    }
  });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400, 'VALIDATION_ERROR');
  }
  
  // Find user
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: {
      subscriptions: {
        where: { status: 'active' },
        include: { package: true }
      }
    }
  });
  
  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  
  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  
  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
  }
  
  // Check if email is verified
  if (config.features.enableEmailVerification && !user.isVerified) {
    throw new AppError('Please verify your email first', 403, 'EMAIL_NOT_VERIFIED');
  }
  
  // Generate tokens
  const accessToken = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  
  // Save refresh token
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });
  
  // Update login stats
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 }
    }
  });
  
  // Remove sensitive data
  delete user.passwordHash;
  delete user.verificationToken;
  delete user.resetToken;
  
  res.json({
    success: true,
    data: {
      user,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900 // 15 minutes in seconds
      }
    }
  });
});

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh
// @access  Public
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw new AppError('Refresh token required', 400, 'NO_REFRESH_TOKEN');
  }
  
  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch (error) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
  
  // Find session
  const session = await prisma.session.findFirst({
    where: {
      userId: decoded.userId,
      refreshToken,
      expiresAt: { gt: new Date() }
    }
  });
  
  if (!session) {
    throw new AppError('Session not found or expired', 401, 'SESSION_NOT_FOUND');
  }
  
  // Generate new access token
  const accessToken = generateToken(decoded.userId);
  
  res.json({
    success: true,
    data: {
      accessToken,
      expiresIn: 900 // 15 minutes in seconds
    }
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    // Delete session
    await prisma.session.deleteMany({
      where: {
        userId: req.user.id,
        refreshToken
      }
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw new AppError('Please provide email', 400, 'VALIDATION_ERROR');
  }
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  // Don't reveal if user exists
  if (!user) {
    return res.json({
      success: true,
      data: {
        message: 'If an account exists with that email, a password reset link has been sent.'
      }
    });
  }
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  // Save token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires
    }
  });
  
  // Send reset email
  await emailService.sendPasswordResetEmail(user.email, resetToken);
  
  res.json({
    success: true,
    data: {
      message: 'If an account exists with that email, a password reset link has been sent.'
    }
  });
});

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    throw new AppError('Please provide token and new password', 400, 'VALIDATION_ERROR');
  }
  
  // Find user with valid token
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gt: new Date() }
    }
  });
  
  if (!user) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }
  
  // Hash new password
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Update password and clear token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null
    }
  });
  
  // Delete all sessions
  await prisma.session.deleteMany({
    where: { userId: user.id }
  });
  
  res.json({
    success: true,
    data: {
      message: 'Password reset successful. Please login with your new password.'
    }
  });
});

// @desc    Verify email
// @route   POST /api/v1/auth/verify-email
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    throw new AppError('Verification token required', 400, 'NO_TOKEN');
  }
  
  // Find user with valid token
  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationExpiresAt: { gt: new Date() }
    }
  });
  
  if (!user) {
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
  }
  
  // Verify user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationExpiresAt: null
    }
  });
  
  res.json({
    success: true,
    data: {
      message: 'Email verified successfully. You can now login.'
    }
  });
});

// @desc    Resend verification email
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw new AppError('Email required', 400, 'VALIDATION_ERROR');
  }
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return res.json({
      success: true,
      data: {
        message: 'If an account exists with that email, a verification email has been sent.'
      }
    });
  }
  
  if (user.isVerified) {
    throw new AppError('Email already verified', 400, 'ALREADY_VERIFIED');
  }
  
  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationExpiresAt
    }
  });
  
  // Send email
  await emailService.sendVerificationEmail(user.email, verificationToken);
  
  res.json({
    success: true,
    data: {
      message: 'Verification email sent. Please check your inbox.'
    }
  });
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      companyName: true,
      isVerified: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      subscriptions: {
        where: { status: 'active' },
        include: {
          package: true
        }
      }
    }
  });
  
  res.json({
    success: true,
    data: { user }
  });
});
