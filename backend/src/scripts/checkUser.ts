import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { User } from '@/models';

async function checkUser() {
  await connectDatabase();
  const email = 'harshkumarhk525@gmail.com';
  const user = await User.findOne({ email }).select('+passwordHash +isActive');
  
  if (user) {
    logger.info({
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      hasPasswordHash: !!user.passwordHash,
      kitchen: user.kitchen,
    }, '🔍 Found User in Database');
  } else {
    logger.error({ email }, '❌ User not found in database');
  }
  
  await disconnectDatabase();
}

checkUser().catch(console.error);
