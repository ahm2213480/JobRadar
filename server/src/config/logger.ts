type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

function write(level: LogLevel, message: string, meta?: unknown): void {
  if (levelOrder[level] < levelOrder[minLevel]) {
    return;
  }
  const timestamp = new Date().toISOString();
  // SECURITY: never pass secrets (API keys, passwords, tokens) as `meta`.
  if (meta === undefined) {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  } else {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
