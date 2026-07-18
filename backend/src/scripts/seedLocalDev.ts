import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { AUTH_PROVIDERS, ROLES } from '@/constants';
import { User, Kitchen, Room, Category, MenuItem } from '@/models';

async function seedLocalDev(): Promise<void> {
  logger.info('Starting local development database seeding...');
  await connectDatabase();

  // 1. Seed Super Admin (admin@hotel.com)
  const adminEmail = 'admin@hotel.com';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({
      name: 'Super Admin',
      email: adminEmail,
      role: ROLES.SUPER_ADMIN,
      provider: AUTH_PROVIDERS.LOCAL,
      isEmailVerified: true,
      isActive: true,
    });
    (admin as any).password = 'Admin123!';
    await admin.save();
    logger.info('✅ Created Super Admin: admin@hotel.com (Password: Admin123!)');
  }

  // 2. Seed Default Kitchen (grand-avani)
  const kitchenSlug = 'grand-avani';
  let kitchen = await Kitchen.findOne({ slug: kitchenSlug });
  if (!kitchen) {
    kitchen = await Kitchen.create({
      name: 'Grand Avani Kitchen',
      slug: kitchenSlug,
      description: 'The signature dining experience of Avani Hotels.',
      isActive: true,
      temporarilyClosed: false,
      weeklySchedule: [0, 1, 2, 3, 4, 5, 6],
      timings: {
        open: '00:00',
        close: '23:59',
        timezone: 'Asia/Kolkata',
      },
      settings: {
        serviceChargePercent: 0,
        taxPercent: 5,
        acceptsCOD: true,
        acceptsRoomBilling: true,
      },
    });
    logger.info('✅ Created Default Kitchen: Grand Avani Kitchen (grand-avani)');
  }

  // 3. Seed Kitchen Staff / Owner (kitchen@hotel.com)
  const kitchenEmail = 'kitchen@hotel.com';
  let kitchenStaff = await User.findOne({ email: kitchenEmail });
  if (!kitchenStaff) {
    kitchenStaff = new User({
      name: 'Kitchen Manager',
      email: kitchenEmail,
      role: ROLES.KITCHEN_OWNER,
      provider: AUTH_PROVIDERS.LOCAL,
      kitchen: kitchen._id,
      isEmailVerified: true,
      isActive: true,
    });
    (kitchenStaff as any).password = 'Kitchen123!';
    await kitchenStaff.save();
    logger.info('✅ Created Kitchen Staff: kitchen@hotel.com (Password: Kitchen123!)');
  }

  // Link kitchen owner if not set
  if (!kitchen.owner) {
    kitchen.owner = kitchenStaff._id;
    await kitchen.save();
  }

  // 4. Seed Rooms (101 - 105)
  const roomNumbers = ['101', '102', '103', '104', '105'];
  for (const rNum of roomNumbers) {
    let room = await Room.findOne({ roomNumber: rNum });
    if (!room) {
      room = await Room.create({
        roomNumber: rNum,
        floor: parseInt(rNum[0], 10),
        kitchen: kitchen._id,
        isActive: true,
        qr: {
          token: `qr-token-room-${rNum}-dynamic-xyz`,
          isActive: true,
          version: 1,
          generatedAt: new Date(),
        },
      });
      logger.info(`✅ Created Room: ${rNum}`);
    }
  }

  // 5. Seed Category (Chef Specials)
  const categorySlug = 'chef-specials';
  let category = await Category.findOne({ kitchen: kitchen._id, slug: categorySlug });
  if (!category) {
    category = await Category.create({
      kitchen: kitchen._id,
      name: 'Chef Specials',
      slug: categorySlug,
      description: 'Hand-crafted gourmet selections from our master chef.',
      isActive: true,
      sortOrder: 0,
    });
    logger.info('✅ Created Category: Chef Specials');
  }

  // 6. Seed Featured Menu Items
  const items = [
    {
      name: 'Gourmet Cheese Burger',
      description: 'Succulent double patty with melted cheddar, crisp lettuce, tomato, onion, and signature burger sauce.',
      price: 349,
      taxPercent: 5,
      prepTimeMinutes: 15,
      foodLabel: 'VEG',
    },
    {
      name: 'Fresh Garden Pizza',
      description: 'Wood-fired sourdough crust topped with marinara sauce, bell peppers, fresh mushrooms, black olives, and premium mozzarella.',
      price: 499,
      taxPercent: 5,
      prepTimeMinutes: 20,
      foodLabel: 'VEG',
    },
    {
      name: 'Belgian Chocolate Waffles',
      description: 'Warm, crispy waffles served with premium Belgian dark chocolate drizzle and vanilla bean ice cream scoop.',
      price: 249,
      taxPercent: 5,
      prepTimeMinutes: 12,
      foodLabel: 'VEG',
    },
  ];

  for (const it of items) {
    const exists = await MenuItem.findOne({ kitchen: kitchen._id, name: it.name });
    if (!exists) {
      await MenuItem.create({
        kitchen: kitchen._id,
        category: category._id,
        name: it.name,
        description: it.description,
        price: it.price,
        taxPercent: it.taxPercent,
        prepTimeMinutes: it.prepTimeMinutes,
        foodLabel: it.foodLabel,
        inStock: true,
        stockQuantity: 100,
        isActive: true,
        isFeatured: true,
        isRecommended: true,
        sortOrder: 0,
        availability: {
          scheduled: false,
          timezone: 'Asia/Kolkata',
          windows: [],
        },
      });
      logger.info(`✅ Seeded Menu Item: ${it.name}`);
    }
  }

  logger.info('Database seeding complete! Disconnecting…');
  await disconnectDatabase();
}

seedLocalDev().catch((err) => {
  logger.error({ err }, 'Local seeding failed');
  process.exit(1);
});
