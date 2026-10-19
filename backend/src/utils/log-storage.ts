import fs from 'fs';
import path from 'path';
import { format } from 'util';
import { Writable } from 'stream';
import { finished } from 'stream/promises';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const logDirectory = path.resolve(process.env.LOG_DIR || path.join(__dirname, '../../logs'));
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
};

export function redactLogMessage(message: string): string {
  return message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/(["']?(?:password|ssh_password|credential|token|access_token|authorization|secret|passphrase|ssh_passphrase)["']?\s*[:=]\s*)("[^"\n]*"|'[^'\n]*'|[^\s,}\n]+)/gi, '$1[REDACTED]');
}

fs.mkdirSync(logDirectory, { recursive: true, mode: 0o700 });

function createFileLogger(source: 'backend' | 'frontend') {
  const transport = new DailyRotateFile({
    dirname: logDirectory,
    filename: `${source}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    utc: true,
    maxSize: '20m',
    options: { flags: 'a', mode: 0o600 },
    createSymlink: false
  });
  const reportError = (error: Error) => originalConsole.error('Application log write failed:', error.message);
  transport.on('error', reportError);
  const fileLogger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [transport]
  });
  fileLogger.on('error', reportError);
  return fileLogger;
}

const backendLogger = createFileLogger('backend');
const frontendLogger = createFileLogger('frontend');
let captureStarted = false;
let cleanupTimer: NodeJS.Timeout | undefined;

export function captureBackendConsole(): void {
  if (captureStarted) return;
  captureStarted = true;
  const levels = { log: 'info', info: 'info', warn: 'warn', error: 'error', debug: 'debug' } as const;
  for (const method of Object.keys(levels) as Array<keyof typeof levels>) {
    console[method] = (...args: any[]) => {
      originalConsole[method](...args);
      const message = redactLogMessage(format(...args));
      const declaredLevel = message.match(/\[(DEBUG|INFO|WARN|ERROR)\]/)?.[1].toLowerCase();
      backendLogger.log(declaredLevel || levels[method], message);
    };
  }
}

export function writeFrontendLog(level: 'warn' | 'error', message: string, userId: string | number): void {
  frontendLogger.log(level, redactLogMessage(message), { source: 'frontend', userId });
}

export function cleanupApplicationLogs(retentionDays: number, now = new Date()): number {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
    throw new RangeError('Log retention must be an integer between 1 and 365 days');
  }
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays + 1);
  const oldestDate = cutoff.toISOString().slice(0, 10);
  let removed = 0;
  for (const entry of fs.readdirSync(logDirectory, { withFileTypes: true })) {
    const match = entry.name.match(/^(backend|frontend)-(\d{4}-\d{2}-\d{2})\.log(?:\.\d+)?$/);
    if (entry.isFile() && match && match[2] < oldestDate) {
      fs.unlinkSync(path.join(logDirectory, entry.name));
      removed++;
    }
  }
  return removed;
}

export function startLogCleanup(getRetentionDays: () => number): void {
  const runCleanup = () => {
    try {
      const retentionDays = getRetentionDays();
      const removed = cleanupApplicationLogs(retentionDays);
      console.info(`Application log cleanup: retained ${retentionDays} UTC dates, removed ${removed} files`);
    } catch (error) {
      console.error('Application log cleanup failed:', error);
    }
  };
  runCleanup();
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = setInterval(runCleanup, 60 * 60 * 1000);
  cleanupTimer.unref();
}

export async function closeApplicationLogs(): Promise<void> {
  if (cleanupTimer) clearInterval(cleanupTimer);
  await Promise.all([backendLogger, frontendLogger].map(async fileLogger => {
    const transport = fileLogger.transports[0] as DailyRotateFile & { logStream: Writable };
    const flushed = finished(transport.logStream);
    await new Promise<void>(resolve => {
      fileLogger.once('finish', resolve);
      fileLogger.end();
    });
    transport.logStream.end();
    await flushed;
  }));
}