import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { AUTH_PROVIDERS, ROLES } from '@/constants';
import { User, ParkingSlot } from '@/models';

async function seedValet(): Promise<void> {
  logger.info('Starting Valet Parking module seeding...');
  await connectDatabase();

  // 1. Seed Valet Manager User
  const email = 'valet@hotel.com';
  const password = 'ValetManager123!';
  const name = 'Valet Manager';

  let user = await User.findOne({ email });
  if (user) {
    user.role = ROLES.VALET_MANAGER;
    user.isEmailVerified = true;
    user.isActive = true;
    (user as typeof user & { password?: string }).password = password;
    await user.save();
    logger.info(`✅ Updated existing user to Valet Manager: ${email}`);
  } else {
    user = new User({
      name,
      email,
      role: ROLES.VALET_MANAGER,
      provider: AUTH_PROVIDERS.LOCAL,
      isEmailVerified: true,
      isActive: true,
    });
    (user as typeof user & { password?: string }).password = password;
    await user.save();
    logger.info(`✅ Created Valet Manager: ${email} (Password: ${password})`);
  }

  // 2. Seed 50 Parking Slots
  logger.info('Checking/seeding parking slots P-01 to P-50...');
  let createdCount = 0;
  for (let i = 1; i <= 50; i++) {
    const slotNumber = `P-${String(i).padStart(2, '0')}`;
    const exists = await ParkingSlot.exists({ slotNumber });
    if (!exists) {
      await ParkingSlot.create({
        slotNumber,
        isOccupied: false,
        notes: `Standard parking space ${slotNumber}`
      });
      createdCount++;
    }
  }

  logger.info(`✅ Parking slots check complete. Created ${createdCount} new slots.`);
  await disconnectDatabase();
  logger.info('Valet Parking seeding complete!');
  process.exit(0);
}

seedValet().catch((err) => {
  logger.error({ err }, 'Valet Seeding failed');
  process.exit(1);
});
