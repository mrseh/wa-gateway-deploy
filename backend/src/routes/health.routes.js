const express = require('express');
const { prisma } = require('../config/database');
const ApiResponse = require('../utils/response');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return ApiResponse.error(res, 'Health check failed', 503);
  }
});

module.exports = router;
