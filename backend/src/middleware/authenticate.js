import User from '../models/User.js';
import authService from '../services/auth/AuthService.js';
import { logger } from '../utils/logger.js';

function parseCsvSet(value) {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toLowerCase())
  );
}

/**
 * Authentication middleware
 * Supports:
 * 1. JWT Bearer token (production) - Authorization: Bearer <token>
 * 2. x-user-id header (dev only) - for backward compatibility in development
 */
export async function authenticate(req, res, next) {
  try {
    let userId = null;

    // Check for Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = authService.verifyAccessToken(token);
        userId = decoded.userId;
      } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Token expired',
            message: 'Access token has expired',
          });
        }
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'Invalid token',
            message: 'Access token is invalid',
          });
        }
        throw error;
      }
    }

    // Fall back to x-user-id header in development only
    if (!userId && process.env.NODE_ENV === 'development') {
      const headerUserId = req.headers['x-user-id'];
      if (headerUserId && /^[0-9a-fA-F]{24}$/.test(headerUserId)) {
        userId = headerUserId;
        logger.debug('Using x-user-id header for authentication (dev mode)');
      }
    }

    // No valid authentication method found
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid access token',
      });
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(401).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid MongoDB ObjectId',
      });
    }

    // Verify user exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'No user found with the provided ID',
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = userId;

    // Update last active timestamp
    await User.updateOne(
      { _id: userId },
      { $set: { lastActiveAt: new Date() } }
    );

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Optional authentication - doesn't require auth but attaches user if provided
 */
export async function optionalAuth(req, res, next) {
  let userId = null;

  // Check for Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = authService.verifyAccessToken(token);
      userId = decoded.userId;
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }

  // Fall back to x-user-id header in development only
  if (!userId && process.env.NODE_ENV === 'development') {
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId && /^[0-9a-fA-F]{24}$/.test(headerUserId)) {
      userId = headerUserId;
    }
  }

  if (userId && /^[0-9a-fA-F]{24}$/.test(userId)) {
    try {
      const user = await User.findById(userId);
      if (user) {
        req.user = user;
        req.userId = userId;
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
  }

  next();
}

/**
 * Admin-only authorization middleware
 *
 * Configure admins with either:
 * - ADMIN_USER_IDS=<mongo_id_1,mongo_id_2>
 * - ADMIN_EMAILS=<admin1@example.com,admin2@example.com>
 */
export function requireAdmin(req, res, next) {
  const adminUserIds = parseCsvSet(process.env.ADMIN_USER_IDS);
  const adminEmails = parseCsvSet(process.env.ADMIN_EMAILS);
  const hasConfig = adminUserIds.size > 0 || adminEmails.size > 0;

  const userId = req.user?._id?.toString()?.toLowerCase();
  const email = req.user?.email?.toLowerCase();

  const isAdmin =
    (userId && adminUserIds.has(userId)) ||
    (email && adminEmails.has(email));

  if (isAdmin) {
    return next();
  }

  if (!hasConfig) {
    logger.error('Admin route denied because ADMIN_USER_IDS/ADMIN_EMAILS is not configured');
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Admin access required',
  });
}

export default authenticate;
