import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Hash a plain text password
   * @param {string} plainPassword - The plain text password
   * @returns {Promise<string>} - The hashed password
   */
  async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash (timing-safe comparison via bcrypt)
   * @param {string} plainPassword - The plain text password
   * @param {string} hash - The stored hash
   * @returns {Promise<boolean>} - Whether the password matches
   */
  async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  /**
   * Generate an access token
   * @param {string} userId - The user's ID
   * @returns {string} - The JWT access token
   */
  generateAccessToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    return jwt.sign(
      { userId, type: 'access' },
      secret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate a refresh token
   * @param {string} userId - The user's ID
   * @returns {string} - The JWT refresh token
   */
  generateRefreshToken(userId) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    return jwt.sign(
      { userId, type: 'refresh' },
      secret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate both access and refresh tokens
   * @param {string} userId - The user's ID
   * @returns {Object} - Object containing accessToken, refreshToken, and expiresIn
   */
  generateTokenPair(userId) {
    const accessToken = this.generateAccessToken(userId);
    const refreshToken = this.generateRefreshToken(userId);

    // Calculate expiresIn in seconds
    const expiresIn = this.parseExpiryToSeconds(ACCESS_TOKEN_EXPIRY);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify an access token
   * @param {string} token - The JWT access token
   * @returns {Object} - The decoded token payload
   * @throws {Error} - If token is invalid or expired
   */
  verifyAccessToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret);

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  }

  /**
   * Verify a refresh token
   * @param {string} token - The JWT refresh token
   * @returns {Object} - The decoded token payload
   * @throws {Error} - If token is invalid or expired
   */
  verifyRefreshToken(token) {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  }

  /**
   * Parse expiry string to seconds
   * @param {string} expiry - Expiry string (e.g., '15m', '7d', '1h')
   * @returns {number} - Expiry in seconds
   */
  parseExpiryToSeconds(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default to 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900;
    }
  }
}

export default new AuthService();
