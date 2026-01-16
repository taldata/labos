/**
 * Centralized logging utility for the frontend application
 * Provides consistent logging with environment-aware behavior
 */

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      ...context
    };
  }

  /**
   * Send logs to external service in production
   * TODO: Integrate with logging service (e.g., LogRocket, Sentry, Datadog)
   */
  sendToService(logData) {
    if (this.isProduction) {
      // In production, send to logging service
      // Example: logService.send(logData);
      // For now, we'll store in sessionStorage as a simple solution
      try {
        const logs = JSON.parse(sessionStorage.getItem('app_logs') || '[]');
        logs.push(logData);
        // Keep only last 100 logs to avoid storage issues
        if (logs.length > 100) logs.shift();
        sessionStorage.setItem('app_logs', JSON.stringify(logs));
      } catch (e) {
        // Silently fail if storage is full
      }
    }
  }

  /**
   * Log error messages
   */
  error(message, context = {}) {
    const logData = this.formatMessage(LOG_LEVELS.ERROR, message, context);

    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, context);
    }

    this.sendToService(logData);
  }

  /**
   * Log warning messages
   */
  warn(message, context = {}) {
    const logData = this.formatMessage(LOG_LEVELS.WARN, message, context);

    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context);
    }

    this.sendToService(logData);
  }

  /**
   * Log info messages
   */
  info(message, context = {}) {
    const logData = this.formatMessage(LOG_LEVELS.INFO, message, context);

    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context);
    }

    this.sendToService(logData);
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message, context = {}) {
    if (this.isDevelopment) {
      const logData = this.formatMessage(LOG_LEVELS.DEBUG, message, context);
      console.debug(`[DEBUG] ${message}`, context);
    }
  }

  /**
   * Get stored logs (useful for debugging in production)
   */
  getLogs() {
    try {
      return JSON.parse(sessionStorage.getItem('app_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  clearLogs() {
    try {
      sessionStorage.removeItem('app_logs');
    } catch (e) {
      // Silently fail
    }
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;
