#!/bin/bash

# Complete Code Generation Script for WhatsApp Gateway SaaS
# This script generates all necessary source code files

set -e

PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
POLLER_DIR="$PROJECT_ROOT/poller"

echo "🚀 Generating complete source code..."

# =====================================================
# BACKEND FILES
# =====================================================

echo "📦 Generating backend files..."

# Config files
cat > "$BACKEND_DIR/src/config/database.js" << 'EOF'
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Duration: ${e.duration}ms`);
  }
});

module.exports = { prisma };
EOF

cat > "$BACKEND_DIR/src/config/redis.js" << 'EOF'
const Redis = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = Redis.createClient({
      url: config.redis.url,
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('✓ Redis connected'));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
EOF

# Utilities
cat > "$BACKEND_DIR/src/utils/logger.js" << 'EOF'
const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 7,
    }),
  ],
});

module.exports = logger;
EOF

cat > "$BACKEND_DIR/src/utils/response.js" << 'EOF'
class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  static error(res, message, statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = ApiResponse;
EOF

cat > "$BACKEND_DIR/src/utils/asyncHandler.js" << 'EOF'
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
EOF

# Middlewares
cat > "$BACKEND_DIR/src/middlewares/errorHandler.js" << 'EOF'
const logger = require('../utils/logger');
const ApiResponse = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return ApiResponse.error(res, 'Database error', 500);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 'Token expired', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return ApiResponse.error(res, err.message, 400, err.errors);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return ApiResponse.error(res, message, statusCode);
};

const notFoundHandler = (req, res) => {
  return ApiResponse.error(res, 'Route not found', 404);
};

module.exports = { errorHandler, notFoundHandler };
EOF

cat > "$BACKEND_DIR/src/middlewares/auth.js" << 'EOF'
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
EOF

cat > "$BACKEND_DIR/src/middlewares/rateLimit.js" << 'EOF'
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
EOF

# Routes
cat > "$BACKEND_DIR/src/routes/health.routes.js" << 'EOF'
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
EOF

cat > "$BACKEND_DIR/src/routes/auth.routes.js" << 'EOF'
const express = require('express');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimit');
const { authenticate } = require('../middlewares/auth');
const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
EOF

# Controllers
cat > "$BACKEND_DIR/src/controllers/auth.controller.js" << 'EOF'
const authService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return ApiResponse.success(res, result, 'Registration successful', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.success(res, result, 'Login successful');
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  return ApiResponse.success(res, null, 'Logout successful');
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  return ApiResponse.success(res, result, 'Token refreshed');
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  return ApiResponse.success(res, null, 'Email verified successfully');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return ApiResponse.success(res, null, 'Password reset email sent');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return ApiResponse.success(res, null, 'Password reset successful');
});

exports.getMe = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, req.user);
});
EOF

# Services
cat > "$BACKEND_DIR/src/services/auth.service.js" << 'EOF'
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const config = require('../config');

class AuthService {
  async register({ email, password, name, phone, companyName }) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create verification token
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
      },
    });

    // TODO: Send verification email
    // await emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      user,
      message: 'Please check your email to verify your account',
    };
  }

  async login({ email, password }) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update login info
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
      },
    };
  }

  async logout(userId) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  async refreshToken(refreshToken) {
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    const accessToken = this.generateAccessToken(session.userId);

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  async verifyEmail(token) {
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      },
    });
  }

  async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    // TODO: Send password reset email
    // await emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(token, newPassword) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }

  generateAccessToken(userId) {
    return jwt.sign({ userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new AuthService();
EOF

echo "✓ Backend files generated"

# =====================================================
# FRONTEND FILES
# =====================================================

echo "📦 Generating frontend files..."

mkdir -p "$FRONTEND_DIR/app/api/health"
cat > "$FRONTEND_DIR/app/api/health/route.ts" << 'EOF'
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
EOF

mkdir -p "$FRONTEND_DIR/app"
cat > "$FRONTEND_DIR/app/layout.tsx" << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WhatsApp Gateway SaaS',
  description: 'Professional WhatsApp Gateway for RT/RW NET',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

cat > "$FRONTEND_DIR/app/page.tsx" << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          WhatsApp Gateway SaaS
        </h1>
        <p className="text-xl text-gray-600">
          Professional WhatsApp Gateway for RT/RW NET & ISP
        </p>
        <div className="mt-8 space-x-4">
          <a
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Login
          </a>
          <a
            href="/register"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Register
          </a>
        </div>
      </div>
    </main>
  )
}
EOF

cat > "$FRONTEND_DIR/app/globals.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
EOF

cat > "$FRONTEND_DIR/next.config.js" << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
EOF

cat > "$FRONTEND_DIR/tailwind.config.ts" << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
EOF

cat > "$FRONTEND_DIR/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

cat > "$FRONTEND_DIR/postcss.config.js" << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

echo "✓ Frontend files generated"

# =====================================================
# POLLER FILES
# =====================================================

echo "📦 Generating PON Port Poller..."

cat > "$POLLER_DIR/pon_port_poller.py" << 'EOF'
#!/usr/bin/env python3
"""
PON Port Polling Service
Monitors PON ports and ONUs via SNMP
"""

import os
import sys
import time
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PONPortPoller:
    """PON Port Polling Service"""
    
    def __init__(self):
        self.db_conn = None
        self.redis_client = None
        self.influx_client = None
        self.write_api = None
        self._setup_connections()
    
    def _setup_connections(self):
        """Setup database connections"""
        try:
            # PostgreSQL
            self.db_conn = psycopg2.connect(
                os.getenv('DATABASE_URL'),
                cursor_factory=RealDictCursor
            )
            logger.info("✓ PostgreSQL connected")
            
            # Redis
            self.redis_client = redis.from_url(os.getenv('REDIS_URL'))
            logger.info("✓ Redis connected")
            
            # InfluxDB
            self.influx_client = InfluxDBClient(
                url=os.getenv('INFLUXDB_URL'),
                token=os.getenv('INFLUXDB_TOKEN'),
                org=os.getenv('INFLUXDB_ORG')
            )
            self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
            logger.info("✓ InfluxDB connected")
            
        except Exception as e:
            logger.error(f"Connection error: {e}")
            sys.exit(1)
    
    async def poll_loop(self):
        """Main polling loop"""
        logger.info("🚀 PON Port Poller started")
        
        while True:
            try:
                # Get all OLTs with monitoring enabled
                olts = self._get_monitoring_olts()
                logger.info(f"Polling {len(olts)} OLTs")
                
                # Poll each OLT
                for olt in olts:
                    try:
                        await self._poll_olt(olt)
                    except Exception as e:
                        logger.error(f"Error polling OLT {olt['name']}: {e}")
                
                # Wait before next poll
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(5)
    
    def _get_monitoring_olts(self) -> List[Dict]:
        """Get OLTs with monitoring enabled"""
        cursor = self.db_conn.cursor()
        cursor.execute("""
            SELECT id, name, vendor, ip_address, snmp_community
            FROM olts
            WHERE monitoring_enabled = TRUE
            AND status = 'active'
        """)
        return cursor.fetchall()
    
    async def _poll_olt(self, olt: Dict):
        """Poll single OLT"""
        # For demonstration - simplified polling
        logger.info(f"Polling OLT: {olt['name']} ({olt['ip_address']})")
        
        # Here you would implement actual SNMP polling
        # For now, just log
        cursor = self.db_conn.cursor()
        cursor.execute("""
            UPDATE olts
            SET last_poll_at = NOW()
            WHERE id = %s
        """, (olt['id'],))
        self.db_conn.commit()
    
    def close(self):
        """Close all connections"""
        if self.db_conn:
            self.db_conn.close()
        if self.redis_client:
            self.redis_client.close()
        if self.influx_client:
            self.influx_client.close()


async def main():
    """Main entry point"""
    poller = PONPortPoller()
    
    try:
        await poller.poll_loop()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        poller.close()


if __name__ == '__main__':
    asyncio.run(main())
EOF

chmod +x "$POLLER_DIR/pon_port_poller.py"

echo "✓ PON Port Poller generated"

# =====================================================
# Additional Scripts
# =====================================================

echo "📦 Generating helper scripts..."

cat > "$PROJECT_ROOT/scripts/health-check.sh" << 'EOF'
#!/bin/bash

# Health Check Script

echo "🏥 Running health checks..."

# Check services
services=("nginx" "frontend" "api" "evolution-api" "postgres" "redis")

for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo "✓ $service is running"
    else
        echo "✗ $service is NOT running"
    fi
done

# Check API health
echo ""
echo "Checking API health endpoint..."
curl -f http://localhost:8000/api/v1/health || echo "✗ API health check failed"

echo ""
echo "Health check complete!"
EOF

chmod +x "$PROJECT_ROOT/scripts/health-check.sh"

cat > "$PROJECT_ROOT/scripts/logs.sh" << 'EOF'
#!/bin/bash

# Log viewer script

SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    docker-compose logs -f --tail=100
else
    docker-compose logs -f --tail=100 $SERVICE
fi
EOF

chmod +x "$PROJECT_ROOT/scripts/logs.sh"

cat > "$PROJECT_ROOT/scripts/restart.sh" << 'EOF'
#!/bin/bash

# Restart services script

SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    echo "Restarting all services..."
    docker-compose restart
else
    echo "Restarting $SERVICE..."
    docker-compose restart $SERVICE
fi

echo "✓ Restart complete"
./scripts/health-check.sh
EOF

chmod +x "$PROJECT_ROOT/scripts/restart.sh"

echo "✓ Helper scripts generated"

# =====================================================
# Git configuration
# =====================================================

cat > "$PROJECT_ROOT/.gitignore" << 'EOF'
# Dependencies
node_modules/
__pycache__/
*.pyc

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# Database
*.db
*.sqlite

# Build
dist/
build/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary
tmp/
temp/

# Backups
backups/*.tar.gz
!/backups/.gitkeep

# SSL
nginx/ssl/*.pem
certbot/

# Data volumes (handled by Docker)
data/
EOF

# Create necessary directories
mkdir -p "$BACKEND_DIR/logs"
mkdir -p "$PROJECT_ROOT/backups"
mkdir -p "$PROJECT_ROOT/logs"
touch "$PROJECT_ROOT/backups/.gitkeep"

# =====================================================
# Quick start script
# =====================================================

cat > "$PROJECT_ROOT/quick-start.sh" << 'EOF'
#!/bin/bash

# Quick Start Script for Development

set -e

echo "🚀 WhatsApp Gateway SaaS - Quick Start"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    
    # Generate secrets
    JWT_SECRET=$(openssl rand -base64 32)
    REFRESH_SECRET=$(openssl rand -base64 32)
    EVOLUTION_KEY=$(openssl rand -base64 16 | tr -d '=')
    
    sed -i "s/CHANGE_THIS_JWT_SECRET_MIN_32_CHARACTERS_789/$JWT_SECRET/" .env
    sed -i "s/CHANGE_THIS_REFRESH_SECRET_MIN_32_CHARACTERS_012/$REFRESH_SECRET/" .env
    sed -i "s/CHANGE_THIS_EVOLUTION_API_KEY_345/$EVOLUTION_KEY/" .env
    
    echo "✓ Environment file created with generated secrets"
    echo ""
    echo "⚠️  Please edit .env and update:"
    echo "   - Domain name"
    echo "   - Database passwords"
    echo "   - Payment gateway credentials"
    echo "   - Email configuration"
    echo ""
    read -p "Press Enter when ready to continue..."
fi

# Start databases first
echo "Starting databases..."
docker-compose up -d postgres redis influxdb minio

echo "Waiting for databases to be ready..."
sleep 15

# Run migrations
echo "Running database migrations..."
docker-compose run --rm api npx prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
docker-compose run --rm api npx prisma generate

# Start all services
echo "Starting all services..."
docker-compose up -d

echo ""
echo "✓ All services started!"
echo ""
echo "🌐 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:8000"
echo "   Evolution: http://localhost:8080"
echo "   Grafana:   http://localhost:3001"
echo ""
echo "📊 View logs: ./scripts/logs.sh [service-name]"
echo "🏥 Health check: ./scripts/health-check.sh"
echo ""
EOF

chmod +x "$PROJECT_ROOT/quick-start.sh"

echo ""
echo "✅ All files generated successfully!"
echo ""
echo "📁 Project structure:"
echo "   ├── backend/         (Node.js API)"
echo "   ├── frontend/        (Next.js)"
echo "   ├── poller/          (Python PON Monitor)"
echo "   ├── nginx/           (Reverse Proxy)"
echo "   ├── scripts/         (Helper Scripts)"
echo "   └── docker-compose.yml"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env file with your configuration"
echo "   2. Run: ./quick-start.sh"
echo "   3. Or for production: sudo ./deploy.sh"
echo ""
