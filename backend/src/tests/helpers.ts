import { AUTH_PROVIDERS, ROLES, type Role } from '@/constants';
import { RoomCategory, User } from '@/models';
import { signAccessToken } from '@/utils/jwt';

/**
 * Rooms may only reference a category that exists, so any suite that creates
 * rooms must seed one first. Idempotent so it can be called per-test.
 */
export async function seedRoomCategory(
  overrides: Partial<{ roomType: string; displayName: string; pricePerNight: number; capacity: number }> = {},
) {
  const roomType = (overrides.roomType ?? 'STANDARD').toUpperCase();
  const existing = await RoomCategory.findOne({ roomType });
  if (existing) return existing;

  return RoomCategory.create({
    roomType,
    displayName: overrides.displayName ?? 'Standard Room',
    description: 'Seeded test category',
    pricePerNight: overrides.pricePerNight ?? 5000,
    capacity: overrides.capacity ?? 2,
    amenities: [],
    images: [],
  });
}

/**
 * Create a verified user of any role directly in the DB and return an access
 * token + the user. Lets route tests skip the full login dance.
 */
export async function createUserWithToken(
  role: Role = ROLES.CUSTOMER,
  overrides: Partial<{ email: string; name: string; kitchen: string }> = {},
) {
  const user = new User({
    name: overrides.name ?? `${role} User`,
    email: overrides.email ?? `${role.toLowerCase()}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`,
    role,
    provider: AUTH_PROVIDERS.LOCAL,
    isEmailVerified: true,
    kitchen: overrides.kitchen,
  });
  (user as typeof user & { password?: string }).password = 'Str0ng!Pass';
  await user.save();

  const token = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    kitchenId: user.kitchen?.toString(),
  });
  return { user, token, bearer: `Bearer ${token}` };
}
