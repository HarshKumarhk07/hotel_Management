import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { User, Kitchen } from '@/models';

async function linkRooftopGrill() {
  await connectDatabase();
  
  const email = 'harshkumarhk525@gmail.com';
  const user = await User.findOne({ email });
  if (!user) {
    logger.error(`❌ User ${email} not found`);
    await disconnectDatabase();
    return;
  }
  
  const kitchen = await Kitchen.findOne({ slug: 'rooftop-grill' });
  if (!kitchen) {
    logger.error('❌ Rooftop Grill kitchen not found');
    await disconnectDatabase();
    return;
  }
  
  // Link them
  user.kitchen = kitchen._id;
  await user.save();
  
  kitchen.owner = user._id;
  await kitchen.save();
  
  logger.info({
    email: user.email,
    kitchen: kitchen.name,
    kitchenId: kitchen._id,
  }, '🎉 Linked User as Owner of Rooftop Grill successfully!');
  
  await disconnectDatabase();
}

linkRooftopGrill().catch(console.error);
