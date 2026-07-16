/**
 * Pino structured logger.
 * Pretty-prints in development; outputs JSON in production/test.
 */
import pino from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV === 'development';

export const logger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  }
);

export default logger;
