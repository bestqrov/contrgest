type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? 'info';
const isJson = process.env.LOG_FORMAT === 'json';

function log(
  level: LogLevel,
  service: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[configuredLevel]) return;

  const entry: LogEntry = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const output = isJson ? JSON.stringify(entry) : formatHuman(entry);

  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

function formatHuman(entry: LogEntry): string {
  const { level, service, message, timestamp, ...rest } = entry;
  const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} [${level.toUpperCase()}] [${service}] ${message}${meta}`;
}

export function createLogger(service: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log('debug', service, message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      log('info', service, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log('warn', service, message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      log('error', service, message, meta),
  };
}
