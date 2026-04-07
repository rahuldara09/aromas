// src/lib/logger.ts
// Simple logger utility that respects the environment.
// In development it proxies to console methods; in production it silences logs
// except for errors (which can be routed to monitoring services).

type LogLevel = 'log' | 'info' | 'warn' | 'error';

function shouldLog(level: LogLevel): boolean {
  // Always allow errors; other levels only in development.
  if (level === 'error') return true;
  return process.env.NODE_ENV !== 'production';
}

function loggerMethod(level: LogLevel) {
  return (...args: unknown[]) => {
    if (shouldLog(level)) {
      // eslint-disable-next-line no-console
      console[level](...args);
    }
  };
}

export const logger = {
  log: loggerMethod('log'),
  info: loggerMethod('info'),
  warn: loggerMethod('warn'),
  error: loggerMethod('error'),
};
