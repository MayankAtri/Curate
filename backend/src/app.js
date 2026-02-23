import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import feedRoutes from './routes/feed.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import authRoutes from './routes/auth.routes.js';
import interactionsRoutes from './routes/interactions.routes.js';
import preferencesRoutes from './routes/preferences.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const isAllowedDevOrigin = (origin) => {
  if (!origin) return true;

  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    const port = parsed.port;

    // Allow common local/dev hosts for phone + laptop testing.
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isPrivateLan =
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    return (isLocalhost || isPrivateLan) && (port === '5173' || port === '');
  } catch {
    return false;
  }
};

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (isAllowedDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.api(req.method, req.path, res.statusCode, duration);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({
    name: 'Curate API',
    version: '1.0.0',
    description: 'AI-Powered Personalized News Aggregator',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/preferences', preferencesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;
