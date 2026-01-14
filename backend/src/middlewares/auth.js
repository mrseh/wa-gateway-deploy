const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const config = require('../config');
const ApiResponse = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user) {
      return ApiResponse.error(res, 'User not found', 401);
    }

    if (!user.isActive) {
      return ApiResponse.error(res, 'Account deactivated', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.error(res, 'Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Token expired', 401);
    }
    return ApiResponse.error(res, 'Authentication failed', 401);
  }
};

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return ApiResponse.error(res, 'No API key provided', 401);
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const token = await prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token || !token.isActive) {
      return ApiResponse.error(res, 'Invalid API key', 401);
    }

    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return ApiResponse.error(res, 'API key expired', 401);
    }

    // Update usage
    await prisma.apiToken.update({
      where: { id: token.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    req.user = token.user;
    req.apiToken = token;
    next();
  } catch (error) {
    return ApiResponse.error(res, 'API authentication failed', 401);
  }
};

module.exports = { authenticate, apiKeyAuth };
