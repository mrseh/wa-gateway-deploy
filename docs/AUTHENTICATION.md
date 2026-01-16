# Authentication System Documentation

## Overview
Complete authentication system with JWT tokens, email verification, password reset, and security features.

## Features

### ✅ User Registration
- Email and password validation
- Password strength requirements
- Email verification system
- Automatic account activation after verification

### ✅ User Login
- Email/password authentication
- JWT access and refresh tokens
- Failed login attempt tracking
- Account lockout after 5 failed attempts (15 minutes)
- Last login tracking with IP address

### ✅ Email Verification
- Secure verification tokens
- 24-hour expiration
- Resend verification capability
- Professional HTML email templates

### ✅ Password Management
- Forgot password flow
- Secure reset tokens (1-hour expiration)
- Password change for authenticated users
- Password strength validation
- Email notifications on password changes

### ✅ Token Management
- JWT access tokens (15 minutes expiry)
- JWT refresh tokens (7 days expiry)
- Token rotation on refresh
- Token blacklisting
- Logout from single/all devices

### ✅ Security Features
- Bcrypt password hashing (cost factor 12)
- Rate limiting on auth endpoints
- Account lockout mechanism
- Token blacklisting
- CSRF protection ready
- XSS prevention
- SQL injection prevention
- Input validation and sanitization

## API Endpoints

### POST /api/v1/auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "company_name": "Acme Inc",
  "phone": "628123456789"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "inactive",
      "email_verified": false,
      "created_at": "2024-01-15T10:00:00.000Z"
    },
    "verification_required": true
  }
}
```

### POST /api/v1/auth/login
Authenticate user and get tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
      "token_type": "Bearer",
      "expires_in": 900,
      "expires_at": "2024-01-15T10:15:00.000Z",
      "refresh_expires_in": 604800,
      "refresh_expires_at": "2024-01-22T10:00:00.000Z"
    }
  }
}
```

### POST /api/v1/auth/verify-email
Verify email address with token.

**Request Body:**
```json
{
  "token": "verification-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully. Your account is now active.",
  "data": {
    "user": {
      "id": "uuid",
      "email_verified": true,
      "status": "active"
    }
  }
}
```

### POST /api/v1/auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset link sent. Please check your email."
}
```

### POST /api/v1/auth/reset-password
Reset password with token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully. You can now login with your new password."
}
```

### POST /api/v1/auth/refresh-token
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "access_token": "new-access-token",
      "refresh_token": "new-refresh-token",
      "token_type": "Bearer",
      "expires_in": 900
    }
  }
}
```

### GET /api/v1/auth/me
Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active",
      "company_name": "Acme Inc",
      "phone": "628123456789"
    },
    "statistics": {
      "total_instances": 3,
      "connected_instances": 2,
      "messages_sent": 1250,
      "total_olts": 5,
      "subscription_status": "active"
    }
  }
}
```

### PUT /api/v1/auth/profile
Update user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "John Updated",
  "company_name": "New Company",
  "phone": "628987654321"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Updated",
      "company_name": "New Company"
    }
  }
}
```

### POST /api/v1/auth/change-password
Change password (authenticated).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!",
  "confirmPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "tokens": {
      "access_token": "new-token",
      "refresh_token": "new-refresh-token"
    }
  }
}
```

### POST /api/v1/auth/logout
Logout current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/v1/auth/logout-all
Logout from all devices.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

## Rate Limits

- **Login:** 5 attempts per 15 minutes
- **Registration:** 3 attempts per hour
- **Password Reset:** 3 attempts per hour
- **Email Verification:** 5 attempts per hour

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| EMAIL_EXISTS | 400 | Email already registered |
| VALIDATION_ERROR | 400 | Input validation failed |
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| NO_TOKEN | 401 | Authentication token missing |
| INVALID_TOKEN | 401 | Token is invalid |
| TOKEN_EXPIRED | 401 | Token has expired |
| TOKEN_BLACKLISTED | 401 | Token has been revoked |
| EMAIL_NOT_VERIFIED | 403 | Email not verified |
| ACCOUNT_INACTIVE | 403 | Account is inactive |
| ACCOUNT_SUSPENDED | 403 | Account is suspended |
| ACCOUNT_LOCKED | 423 | Too many failed login attempts |
| TOO_MANY_REQUESTS | 429 | Rate limit exceeded |

## Email Templates

All emails are sent with professional HTML templates including:

1. **Verification Email** - Sent after registration
2. **Welcome Email** - Sent after email verification
3. **Password Reset Email** - Sent on forgot password request
4. **Password Changed Email** - Sent after successful password change

## Security Best Practices

### For Developers

1. **Never log passwords** - Even in development
2. **Use HTTPS** - Always in production
3. **Validate input** - On both client and server
4. **Keep dependencies updated** - Regular security audits
5. **Monitor failed attempts** - Set up alerts for suspicious activity
6. **Rotate secrets** - Change JWT secrets periodically
7. **Implement rate limiting** - Prevent brute force attacks
8. **Use secure cookies** - HttpOnly, Secure, SameSite flags

### For Users

1. **Use strong passwords** - Follow the requirements
2. **Enable 2FA** - When available (coming soon)
3. **Don't share credentials** - Keep your password private
4. **Logout from public devices** - Always logout when done
5. **Review login activity** - Check for suspicious logins
6. **Update password regularly** - Change every 3-6 months

## Token Flow

### Registration & Login Flow
```
1. User registers → Account created (inactive)
2. Verification email sent → User clicks link
3. Email verified → Account activated
4. User logs in → Tokens generated
5. Access token used → For API requests
6. Token expires → Use refresh token
7. Refresh token → Get new access token
```

### Token Expiration & Refresh
```
Access Token (15 min)  →  Expires  →  Use Refresh Token
                                      ↓
                              New Access Token (15 min)
                              New Refresh Token (7 days)
```

## Testing

Run authentication tests:
```bash
npm test tests/auth.test.js
```

Expected coverage: 85%+

## Environment Variables

Required variables in `.env`:

```env
# JWT Configuration
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=WhatsApp Gateway
SMTP_FROM_EMAIL=noreply@yourdomain.com

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key

# App URLs
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
```

## Common Issues & Solutions

### Issue: Email not received
**Solution:** Check spam folder, verify SMTP credentials, check email service logs

### Issue: Token expired
**Solution:** Use refresh token endpoint to get new access token

### Issue: Account locked
**Solution:** Wait 15 minutes or contact support for manual unlock

### Issue: Verification link expired
**Solution:** Request new verification email via resend endpoint

### Issue: Password reset not working
**Solution:** Check if token is expired (1 hour), request new reset link

## Migration from Other Auth Systems

If migrating from another authentication system:

1. Export users with hashed passwords
2. Create users with `email_verified: true`
3. Set appropriate `status` field
4. Send welcome email
5. Notify users of new system

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Social login (Google, Facebook)
- [ ] Biometric authentication
- [ ] Session management dashboard
- [ ] Login history and activity log
- [ ] Suspicious activity detection
- [ ] IP whitelist/blacklist
- [ ] Device management
- [ ] OAuth2 provider capability

## Support

For issues or questions:
- Email: support@yourdomain.com
- Documentation: https://docs.yourdomain.com
- GitHub Issues: https://github.com/your-org/wa-gateway/issues
