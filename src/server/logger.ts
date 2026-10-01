type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function resolveLevel(value: string | undefined): LogLevel {
  const candidate = value?.trim().toLowerCase();

  return candidate !== undefined && candidate in LEVEL_WEIGHTS ? (candidate as LogLevel) : 'info';
}

function isEnabled(level: Exclude<LogLevel, 'silent'>): boolean {
  return LEVEL_WEIGHTS[level] >= LEVEL_WEIGHTS[resolveLevel(process.env.LOG_LEVEL)];
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (isEnabled('debug')) {
      console.debug(message, ...args);
    }
  },
  info(message: string, ...args: unknown[]): void {
    if (isEnabled('info')) {
      console.info(message, ...args);
    }
  },
  warn(message: string, ...args: unknown[]): void {
    if (isEnabled('warn')) {
      console.warn(message, ...args);
    }
  },
  error(message: string, ...args: unknown[]): void {
    if (isEnabled('error')) {
      console.error(message, ...args);
    }
  },
};
