import { LogEntry, LogLevel } from '@/types';

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Keep last 500 logs in memory

  private addLog(level: LogLevel, message: string, details?: unknown) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };

    this.logs.push(logEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with colors
    const timestamp = new Date().toLocaleString('tr-TR');
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(prefix, message, details || '');
        break;
      case LogLevel.WARNING:
        console.warn(prefix, message, details || '');
        break;
      case LogLevel.SUCCESS:
        console.log('\x1b[32m%s\x1b[0m', prefix, message, details || '');
        break;
      default:
        console.log(prefix, message, details || '');
    }
  }

  info(message: string, details?: unknown) {
    this.addLog(LogLevel.INFO, message, details);
  }

  success(message: string, details?: unknown) {
    this.addLog(LogLevel.SUCCESS, message, details);
  }

  warning(message: string, details?: unknown) {
    this.addLog(LogLevel.WARNING, message, details);
  }

  error(message: string, details?: unknown) {
    this.addLog(LogLevel.ERROR, message, details);
  }

  getLogs(limit?: number): LogEntry[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

// Singleton instance
export const logger = new Logger();
