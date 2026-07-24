import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import '@/models';
import { auditRoomCategories, migrateOrphanRooms } from '@/modules/room/room.service';

/**
 * One-off repair for rooms whose `roomType` no longer resolves to a Room
 * Category — the "EXECUTIVE rooms with only Standard/Deluxe categories" case.
 * Such rooms are unreachable from the booking filters, so they are either
 * reassigned to a real category or reported for a human decision.
 *
 *   npm run migrate:rooms                # dry run — report only
 *   npm run migrate:rooms -- DELUXE      # migrate every orphan onto DELUXE
 *   npm run migrate:rooms -- DELUXE EXECUTIVE   # only the EXECUTIVE orphans
 */
async function run(): Promise<void> {
  await connectDatabase();

  const [toRoomType, fromRoomType] = process.argv.slice(2);

  const before = await auditRoomCategories();
  logger.info(
    {
      totalRooms: before.totalRooms,
      orphanCount: before.orphanCount,
      orphanGroups: before.orphanGroups.map((g) => ({ roomType: g.roomType, count: g.count })),
      categories: before.categories.map((c) => `${c.roomType} (${c.roomCount} rooms)`),
    },
    'Room category audit',
  );

  if (before.isConsistent) {
    logger.info('✅ Every room already references an existing category. Nothing to migrate.');
  } else if (!toRoomType) {
    logger.warn(
      'Dry run only — no target category supplied. Re-run as: npm run migrate:rooms -- <TARGET_ROOM_TYPE> [SOURCE_ROOM_TYPE]',
    );
  } else {
    const result = await migrateOrphanRooms({ toRoomType, fromRoomType });
    logger.info(result, `✅ Migrated ${result.migrated} room(s) onto ${result.toRoomType}`);

    const after = await auditRoomCategories();
    logger.info({ orphanCount: after.orphanCount, isConsistent: after.isConsistent }, 'Post-migration audit');
  }

  await disconnectDatabase();
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, 'Room category migration failed');
  process.exit(1);
});
