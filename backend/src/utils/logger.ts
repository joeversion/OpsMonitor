/**
 * Centralized logging utility with timestamps and formatted output
 * Supports different log levels: DEBUG, INFO, WARN, ERROR
 * Supports configurable timezone from system settings
 */

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private colors = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[32m',     // Green
    WARN: '\x1b[33m',     // Yellow
    ERROR: '\x1b[31m',    // Red
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m'
  };

  private cachedTimezone: string | null = null;
  private lastTimezoneCheck: number = 0;
  private readonly TIMEZONE_CACHE_TTL = 60000; // 1 minute cache

  /**
   * Clear timezone cache to force reload from database
   * Call this after updating system timezone setting
   */
  public clearTimezoneCache(): void {
    this.cachedTimezone = null;
    this.lastTimezoneCheck = 0;
  }

  private getSystemTimezone(): string {
    // Cache timezone to avoid frequent DB queries
    const now = Date.now();
    if (this.cachedTimezone && (now - this.lastTimezoneCheck) < this.TIMEZONE_CACHE_TTL) {
      return this.cachedTimezone;
    }

    try {
      // Lazy load to avoid circular dependency
      const db = require('../db/database').default;
      const result = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('timezone') as { value: string } | undefined;
      
      this.cachedTimezone = result?.value || 'UTC';
      this.lastTimezoneCheck = now;
      return this.cachedTimezone;
    } catch (error) {
      // Fallback to UTC if DB not ready or error
      return 'UTC';
    }
  }

  private getTimestamp(): string {
    const timezone = this.getSystemTimezone();
    const now = new Date();
    
    try {
      // Use Intl.DateTimeFormat for timezone-aware formatting
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const get = (type: string) => parts.find(p => p.type === type)?.value || '';
      
      // Add milliseconds manually since fractionalSecondDigits is not available in older Node versions
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      
      return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}.${milliseconds}`;
    } catch (error) {
      // Fallback to simple UTC formatting if timezone is invalid
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
  }

  private formatMessage(level: LogLevel, module: string, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const color = this.colors[level];
    const reset = this.colors.RESET;
    const dim = this.colors.DIM;
    
    let logMessage = `${dim}${timestamp}${reset} ${color}[${level}]${reset} ${this.colors.BOLD}[${module}]${reset} ${message}`;
    
    if (data !== undefined) {
      if (typeof data === 'object') {
        logMessage += `\n${dim}${JSON.stringify(data, null, 2)}${reset}`;
      } else {
        logMessage += ` ${dim}${data}${reset}`;
      }
    }
    
    return logMessage;
  }

  debug(module: string, message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.formatMessage(LogLevel.DEBUG, module, message, data));
    }
  }

  info(module: string, message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.INFO, module, message, data));
  }

  warn(module: string, message: string, data?: any): void {
    console.warn(this.formatMessage(LogLevel.WARN, module, message, data));
  }

  error(module: string, message: string, error?: any): void {
    let errorData = error;
    
    if (error instanceof Error) {
      errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    
    console.error(this.formatMessage(LogLevel.ERROR, module, message, errorData));
  }

  // Convenience methods with common module names
  scheduler = {
    debug: (message: string, data?: any) => this.debug('Scheduler', message, data),
    info: (message: string, data?: any) => this.info('Scheduler', message, data),
    warn: (message: string, data?: any) => this.warn('Scheduler', message, data),
    error: (message: string, error?: any) => this.error('Scheduler', message, error)
  };

  healthCheck = {
    debug: (message: string, data?: any) => this.debug('HealthChecker', message, data),
    info: (message: string, data?: any) => this.info('HealthChecker', message, data),
    warn: (message: string, data?: any) => this.warn('HealthChecker', message, data),
    error: (message: string, error?: any) => this.error('HealthChecker', message, error)
  };

  ssh = {
    debug: (message: string, data?: any) => this.debug('SSH', message, data),
    info: (message: string, data?: any) => this.info('SSH', message, data),
    warn: (message: string, data?: any) => this.warn('SSH', message, data),
    error: (message: string, error?: any) => this.error('SSH', message, error)
  };

  auth = {
    debug: (message: string, data?: any) => this.debug('Auth', message, data),
    info: (message: string, data?: any) => this.info('Auth', message, data),
    warn: (message: string, data?: any) => this.warn('Auth', message, data),
    error: (message: string, error?: any) => this.error('Auth', message, error)
  };

  database = {
    debug: (message: string, data?: any) => this.debug('Database', message, data),
    info: (message: string, data?: any) => this.info('Database', message, data),
    warn: (message: string, data?: any) => this.warn('Database', message, data),
    error: (message: string, error?: any) => this.error('Database', message, error)
  };

  api = {
    debug: (message: string, data?: any) => this.debug('API', message, data),
    info: (message: string, data?: any) => this.info('API', message, data),
    warn: (message: string, data?: any) => this.warn('API', message, data),
    error: (message: string, error?: any) => this.error('API', message, error)
  };

  notification = {
    debug: (message: string, data?: any) => this.debug('Notification', message, data),
    info: (message: string, data?: any) => this.info('Notification', message, data),
    warn: (message: string, data?: any) => this.warn('Notification', message, data),
    error: (message: string, error?: any) => this.error('Notification', message, error)
  };

  alert = {
    debug: (message: string, data?: any) => this.debug('Alert', message, data),
    info: (message: string, data?: any) => this.info('Alert', message, data),
    warn: (message: string, data?: any) => this.warn('Alert', message, data),
    error: (message: string, error?: any) => this.error('Alert', message, error)
  };
}

// Export singleton instance
export const logger = new Logger();
export default logger;
