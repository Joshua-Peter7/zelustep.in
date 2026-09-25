import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

function getKey() {
  const hexKey = process.env.FIELD_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is required for encryption.');
  }
  const keyBuffer = Buffer.from(hexKey, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error(`FIELD_ENCRYPTION_KEY must be a 32-byte (64 hex characters) string. Got ${keyBuffer.length} bytes.`);
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * @param {string|number} plaintext 
 * @returns {string} Encrypted payload formatted as iv:authTag:ciphertext
 */
export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext;
  }

  const text = String(plaintext);
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a payload formatted as iv:authTag:ciphertext using AES-256-GCM.
 * Gracefully returns original payload if not encrypted (backwards compatibility).
 * @param {string} payload 
 * @returns {string} Decrypted plaintext string
 */
export function decryptField(payload) {
  if (!payload || typeof payload !== 'string') {
    return payload;
  }

  const parts = payload.split(':');
  // Check if payload matches the iv:authTag:ciphertext signature (3 hex parts)
  if (parts.length !== 3) {
    return payload; // Not encrypted, return legacy plaintext
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  if (ivHex.length !== 24 || authTagHex.length !== 32) {
    return payload; // Invalid header lengths, not our encrypted format
  }

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('⚠️ Field decryption failed, returning raw payload:', err.message);
    return payload;
  }
}
