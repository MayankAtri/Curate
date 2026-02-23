// Simple logger utility
// Can be replaced with Winston or Pino for production

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = process.env.NODE_ENV === 'production'
  ? LOG_LEVELS.INFO
  : LOG_LEVELS.DEBUG;

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0
    ? ` ${JSON.stringify(meta)}`
    : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  error(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, meta));
    }
  },

  warn(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },

  info(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(formatMessage('INFO', message, meta));
    }
  },

  debug(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, meta));
    }
  },

  // Log job execution
  job(jobName, status, meta = {}) {
    const message = `Job [${jobName}] ${status}`;
    this.info(message, meta);
  },

  // Log API requests
  api(method, path, statusCode, duration) {
    const message = `${method} ${path} ${statusCode} - ${duration}ms`;
    this.info(message);
  },
};

export default logger;
