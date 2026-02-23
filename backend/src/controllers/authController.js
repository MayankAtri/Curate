import User from '../models/User.js';
import authService from '../services/auth/AuthService.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function register(req, res, next) {
  try {
    const { email, username, password } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email, username, and password are required',
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'Registration failed',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      username,
      passwordHash,
    });

    // Generate tokens
    const tokens = authService.generateTokenPair(user._id.toString());

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      message: 'Registration successful',
      user: user.toPublicJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Use generic error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isValidPassword = await authService.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    // Update last active timestamp
    user.lastActiveAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = authService.generateTokenPair(user._id.toString());

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: user.toPublicJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
export async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = authService.verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        error: 'Token invalid',
        message: 'Invalid or expired refresh token',
      });
    }

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Token invalid',
        message: 'User not found',
      });
    }

    // Generate new token pair
    const tokens = authService.generateTokenPair(user._id.toString());

    logger.info(`Token refreshed for user: ${user.email}`);

    res.json({
      message: 'Token refreshed',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function getMe(req, res, next) {
  try {
    // req.user is set by authenticate middleware
    res.json({
      user: req.user.toPublicJSON(),
    });
  } catch (error) {
    logger.error('Get me error', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Logout user (placeholder for token blacklisting)
 */
export async function logout(req, res, next) {
  try {
    // TODO: Implement token blacklisting if needed
    // For now, just acknowledge the logout
    // Client should discard tokens

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    next(error);
  }
}
