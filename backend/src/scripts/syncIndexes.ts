import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
// Side-effect import registers every model (and its index definitions) with
// Mongoose so syncIndexes below has the full set to reconcile.
import '@/models';

/**
 * Build/reconcile all model indexes against MongoDB.
 *
 * Production runs with `autoIndex: false` (so a deploy never silently triggers a
 * costly foreground index build), which means new indexes — the unique
 * per-user coupon counter, the audit-log/notification TTL indexes, etc. — must
 * be applied explicitly. Run this once after each deploy that adds or changes an
 * index:
 *
 *   npm run migrate:indexes
 *
 * `syncIndexes()` creates missing indexes and drops ones no longer declared in
 * the schema, leaving the database exactly matching the code.
 */
async function syncIndexes(): Promise<void> {
  await connectDatabase();

  const models = mongoose.modelNames();
  logger.info({ models }, 'Syncing indexes for all registered models…');

  for (const name of models) {
    const model = mongoose.model(name);
    // eslint-disable-next-line no-await-in-loop
    const dropped = await model.syncIndexes();
    logger.info({ model: name, dropped }, `✅ Indexes synced for ${name}`);
  }

  await disconnectDatabase();
  logger.info('All indexes synced.');
  process.exit(0);
}

syncIndexes().catch((err) => {
  logger.error({ err }, 'Index sync failed');
  process.exit(1);
});
