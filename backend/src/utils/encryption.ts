import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive key from encryption key
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    config.database.encryptionKey,
    salt,
    100000,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt data for HIPAA compliance
 * @param text Plain text to encrypt
 * @returns Encrypted data as base64 string
 */
export function encrypt(text: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);
    
    return result.toString('base64');
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data
 * @param encryptedData Encrypted data as base64 string
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  try {
    const buffer = Buffer.from(encryptedData, 'base64');
    
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = deriveKey(salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

/**
 * Hash sensitive data (one-way)
 * @param data Data to hash
 * @returns Hashed data as hex string
 */
export function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate secure random token
 * @param length Token length in bytes
 * @returns Random token as hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
