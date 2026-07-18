import mongoose from 'mongoose';
import { env, isProd } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);
if (!isProd) {
  mongoose.set('debug', false);
}

let isConnected = false;

/**
 * Connect to MongoDB Atlas with sane pool sizing and timeouts.
 * Idempotent — safe to call multiple times (used by both server and tests).
 */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (isConnected) return mongoose;

  mongoose.connection.on('connected', () => logger.info('🗄️  MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    autoIndex: !isProd, // build indexes automatically in dev/test only
  });

  isConnected = true;
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
