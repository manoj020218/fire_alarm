/**
 * Mongoose connection with exponential-backoff retry and graceful shutdown.
 */
import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000;

export async function connectDB(uri?: string): Promise<void> {
  const mongoUri = uri ?? env.MONGODB_URI;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info({ attempt }, 'MongoDB connected');
      return;
    } catch (err) {
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
      logger.warn({ attempt, delay, err }, 'MongoDB connection failed, retrying');
      if (attempt === MAX_RETRIES) {
        throw new Error(`MongoDB failed to connect after ${MAX_RETRIES} attempts`);
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err: unknown) => {
  logger.error({ err }, 'MongoDB error');
});
