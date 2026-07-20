import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { ROLES, AUTH_PROVIDERS } from '../constants';
import { User } from '../models';
import { hashPassword } from '../utils/crypto';

async function makeValet() {
  await connectDatabase();
  const email = 'harshkumarhk525@gmail.com';
  let user = await User.findOne({ email });

  const passwordHash = await hashPassword('Valet123!');

  if (!user) {
    user = new User({
      name: 'Harsh Valet',
      email,
      role: ROLES.VALET_MANAGER,
      provider: AUTH_PROVIDERS.LOCAL,
      isEmailVerified: true,
      isActive: true,
      passwordHash
    });
    logger.info('❌ User not found, created new user');
  } else {
    user.role = ROLES.VALET_MANAGER;
    user.isEmailVerified = true;
    user.isActive = true;
    user.kitchen = undefined; // Valet managers don't belong to a kitchen
    user.passwordHash = passwordHash;
    logger.info('🔍 User found, updated role to VALET_MANAGER');
  }

  await user.save();
  logger.info({
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    password: 'Valet123!'
  }, '🎉 User successfully updated to Valet Manager!');

  await disconnectDatabase();
}

makeValet().catch(console.error);
