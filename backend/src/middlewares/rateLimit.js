const rateLimit = require('express-rate-limit');
const config = require('../config');

const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.maxRequests,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
};

const authLimiter = createRateLimiter({
  max: config.rateLimit.authMax,
  skipSuccessfulRequests: true,
});

const apiLimiter = createRateLimiter();

module.exports = { createRateLimiter, authLimiter, apiLimiter };
