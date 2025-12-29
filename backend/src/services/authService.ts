import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database';
import { config } from '../config';
import { User, UserRole, AuthTokens, JWTPayload } from '../types';
import { logAuditEvent } from '../utils/logger';

export class AuthService {
  /**
   * Register a new user
   */
  static async register(
    email: string,
    password: string,
    role: UserRole,
    firstName: string,
    lastName: string,
    organizationId: string,
    phoneNumber?: string
  ): Promise<User> {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone_number, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [email, passwordHash, role, firstName, lastName, phoneNumber, organizationId]
    );
    
    return result.rows[0];
  }
  
  /**
   * Login user
   */
  static async login(email: string, password: string, ipAddress: string, userAgent: string): Promise<AuthTokens> {
    // Get user
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }
    
    const user = result.rows[0];
    
    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new Error('Account is locked. Please try again later.');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      // Increment login attempts
      await query(
        `UPDATE users 
         SET login_attempts = login_attempts + 1,
             locked_until = CASE 
               WHEN login_attempts + 1 >= $1 THEN NOW() + INTERVAL '30 minutes'
               ELSE locked_until
             END
         WHERE id = $2`,
        [config.session.maxLoginAttempts, user.id]
      );
      
      throw new Error('Invalid credentials');
    }
    
    // Reset login attempts and update last login
    await query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });
    
    // Log audit event
    logAuditEvent(
      user.id,
      'LOGIN',
      'auth',
      user.id,
      ipAddress,
      userAgent
    );
    
    return tokens;
  }
  
  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as JWTPayload;
      
      // Verify user still exists and is active
      const result = await query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      // Generate new tokens
      return this.generateTokens({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
      });
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
  
  /**
   * Generate JWT tokens
   */
  private static generateTokens(payload: JWTPayload): AuthTokens {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
    
    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
    
    // Parse expiration time to seconds
    const expiresIn = this.parseTimeToSeconds(config.jwt.expiresIn);
    
    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
  
  /**
   * Parse time string to seconds
   */
  private static parseTimeToSeconds(time: string): number {
    const unit = time.slice(-1);
    const value = parseInt(time.slice(0, -1), 10);
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600; // 1 hour default
    }
  }
  
  /**
   * Change password
   */
  static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    // Get user
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result.rows[0];
    
    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid old password');
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  }
}
