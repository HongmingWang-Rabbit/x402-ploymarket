import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    worker: env.WORKER_TYPE,
  },
});

export function createWorkerLogger(workerType: string) {
  return logger.child({ worker: workerType });
}
