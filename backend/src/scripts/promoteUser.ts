import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { ROLES } from '@/constants';
import { User, Kitchen } from '@/models';

async function promoteUser() {
  await connectDatabase();
  const email = 'harshkumarhk525@gmail.com';
  let user = await User.findOne({ email });
  
  if (!user) {
    logger.error('❌ User not found, creating new kitchen owner account');
    user = new User({
      name: 'Kitchen Owner',
      email,
      role: ROLES.KITCHEN_OWNER,
      isEmailVerified: true,
      isActive: true
    });
  } else {
    user.role = ROLES.KITCHEN_OWNER;
    user.isEmailVerified = true;
    user.isActive = true;
  }
  
  // Find or create default kitchen to link
  let kitchen = await Kitchen.findOne({ slug: 'grand-avani' });
  if (!kitchen) {
    kitchen = await Kitchen.create({
      name: 'Grand Avani Kitchen',
      slug: 'grand-avani',
      isActive: true,
      temporarilyClosed: false,
      settings: {
        serviceChargePercent: 0,
        taxPercent: 5,
        acceptsCOD: true,
        acceptsRoomBilling: true
      }
    });
    logger.info('✅ Created Grand Avani Kitchen');
  }
  
  user.kitchen = kitchen._id;
  (user as any).password = 'Rooftop@2024';
  await user.save();
  
  // Also link kitchen owner
  kitchen.owner = user._id;
  await kitchen.save();
  
  logger.info({
    email: user.email,
    role: user.role,
    kitchen: kitchen.name,
    password: 'Kitchen123!'
  }, '🎉 User successfully updated to Kitchen Owner!');
  
  await disconnectDatabase();
}

promoteUser().catch(console.error);
