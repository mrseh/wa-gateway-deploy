const crypto = require('crypto');

/**
 * Crypto Utilities
 * Provides encryption, decryption, and hashing functions
 */

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key buffer
 * @returns {Buffer}
 */
function getKey() {
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

/**
 * Encrypt text
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text (base64)
 */
function encrypt(text) {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt text
 * @param {string} encryptedText - Encrypted text (base64)
 * @returns {string} Decrypted text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  
  try {
    const buffer = Buffer.from(encryptedText, 'base64');
    
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = buffer.subarray(ENCRYPTED_POSITION);
    
    const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

/**
 * Hash text using SHA-256
 * @param {string} text - Text to hash
 * @returns {string} Hashed text (hex)
 */
function hash(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

/**
 * Hash text with salt using SHA-512
 * @param {string} text - Text to hash
 * @param {string} salt - Salt (optional, generates if not provided)
 * @returns {Object} { hash, salt }
 */
function hashWithSalt(text, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(32).toString('hex');
  }
  
  const hash = crypto
    .createHmac('sha512', salt)
    .update(String(text))
    .digest('hex');
  
  return { hash, salt };
}

/**
 * Verify hashed text
 * @param {string} text - Plain text
 * @param {string} hash - Hashed text
 * @param {string} salt - Salt used for hashing
 * @returns {boolean}
 */
function verifyHash(text, hash, salt) {
  const { hash: newHash } = hashWithSalt(text, salt);
  return newHash === hash;
}

/**
 * Generate random token
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} Random token (hex)
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate random string
 * @param {number} length - String length
 * @param {string} charset - Character set
 * @returns {string} Random string
 */
function generateRandomString(
  length = 16,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
) {
  let result = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  
  return result;
}

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate secure random number
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number}
 */
function generateRandomNumber(min = 0, max = 100) {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxNum = Math.pow(256, bytesNeeded);
  const randomBytes = crypto.randomBytes(bytesNeeded);
  const randomNum = randomBytes.readUIntBE(0, bytesNeeded);
  
  return min + (randomNum % range);
}

/**
 * Generate API key
 * @returns {string} API key
 */
function generateApiKey() {
  return `sk_${generateRandomString(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}`;
}

/**
 * Generate webhook secret
 * @returns {string} Webhook secret
 */
function generateWebhookSecret() {
  return `whsec_${generateToken(32)}`;
}

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @param {string} algorithm - Hash algorithm (default sha256)
 * @returns {string} Signature (hex)
 */
function createSignature(data, secret, algorithm = 'sha256') {
  return crypto
    .createHmac(algorithm, secret)
    .update(String(data))
    .digest('hex');
}

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key
 * @param {string} algorithm - Hash algorithm (default sha256)
 * @returns {boolean}
 */
function verifySignature(data, signature, secret, algorithm = 'sha256') {
  const expectedSignature = createSignature(data, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate password hash (bcrypt-compatible format)
 * @param {string} password - Password to hash
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const bcrypt = require('bcryptjs');
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify password
 * @param {string} password - Plain password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(password, hash);
}

/**
 * Mask sensitive data
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of visible characters at start and end
 * @returns {string}
 */
function maskData(data, visibleChars = 4) {
  if (!data || data.length <= visibleChars * 2) {
    return data;
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);
  
  return `${start}${masked}${end}`;
}

/**
 * Mask email
 * @param {string} email - Email to mask
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) {
    return email;
  }
  
  const [username, domain] = email.split('@');
  const visibleChars = Math.min(3, Math.floor(username.length / 2));
  const maskedUsername = maskData(username, visibleChars);
  
  return `${maskedUsername}@${domain}`;
}

/**
 * Mask phone number
 * @param {string} phone - Phone number to mask
 * @returns {string}
 */
function maskPhone(phone) {
  if (!phone || phone.length < 8) {
    return phone;
  }
  
  return maskData(phone, 3);
}

/**
 * Constant-time string comparison
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean}
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  } catch {
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  hashWithSalt,
  verifyHash,
  generateToken,
  generateRandomString,
  generateUUID,
  generateRandomNumber,
  generateApiKey,
  generateWebhookSecret,
  createSignature,
  verifySignature,
  hashPassword,
  verifyPassword,
  maskData,
  maskEmail,
  maskPhone,
  constantTimeCompare
};
