import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { AUTH_PROVIDERS, ROLES } from '@/constants';
import { User } from '@/models';

/**
 * Bootstrap the first Super Admin. The system has no way to self-register an
 * admin (registration only creates customers), so this script seeds one from
 * env vars. Idempotent — re-running updates the password of an existing admin.
 *
 * Usage:
 *   SEED_ADMIN_NAME="Owner" \
 *   SEED_ADMIN_EMAIL="admin@hotel.com" \
 *   SEED_ADMIN_PASSWORD="Str0ng!Pass" \
 *   npm run seed:admin
 */
async function seedAdmin(): Promise<void> {
  const name = process.env.SEED_ADMIN_NAME ?? 'Super Admin';
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    logger.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
    process.exit(1);
  }

  await connectDatabase();

  let user = await User.findOne({ email });
  if (user) {
    user.role = ROLES.SUPER_ADMIN;
    user.isEmailVerified = true;
    user.isActive = true;
    (user as typeof user & { password?: string }).password = password;
    await user.save();
    logger.info({ email }, '✅ Updated existing user to Super Admin');
  } else {
    user = new User({
      name,
      email,
      role: ROLES.SUPER_ADMIN,
      provider: AUTH_PROVIDERS.LOCAL,
      isEmailVerified: true,
      isActive: true,
    });
    (user as typeof user & { password?: string }).password = password;
    await user.save();
    logger.info({ email }, '✅ Created Super Admin');
  }

  await disconnectDatabase();
  process.exit(0);
}

seedAdmin().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
