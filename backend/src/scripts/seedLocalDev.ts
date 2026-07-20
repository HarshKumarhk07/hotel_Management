import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { AUTH_PROVIDERS, ROLES } from '@/constants';
import { User, Kitchen, Room, Category, MenuItem, BanquetHall } from '@/models';

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

  // 4. Seed Rooms (101 - 105) with detailed types, pricing, and sizes
  const roomsData = [
    {
      roomNumber: '101',
      roomType: 'STANDARD' as const,
      pricePerNight: 4000,
      capacity: 2,
      bedType: 'QUEEN' as const,
      roomSizeSqFt: 300,
      amenities: ['Free Wi-Fi', 'Smart TV', 'Air Conditioning', 'Mini Bar', 'Coffee Maker'],
      rules: ['No smoking inside the room.', 'Quiet hours: 10 PM - 8 AM.'],
      images: ['/hotel1.png'],
    },
    {
      roomNumber: '102',
      roomType: 'DELUXE' as const,
      pricePerNight: 5500,
      capacity: 2,
      bedType: 'KING' as const,
      roomSizeSqFt: 420,
      amenities: ['Free Wi-Fi', 'Smart TV', 'Air Conditioning', 'Mini Bar', 'Coffee Maker', 'Bath Tub', 'Balcony View'],
      rules: ['No smoking inside the room.', 'Quiet hours: 10 PM - 8 AM.'],
      images: ['/hotel1.png'],
    },
    {
      roomNumber: '103',
      roomType: 'EXECUTIVE' as const,
      pricePerNight: 7500,
      capacity: 3,
      bedType: 'KING' as const,
      roomSizeSqFt: 550,
      amenities: ['Free Wi-Fi', '4K Smart TV', 'Air Conditioning', 'Premium Mini Bar', 'Nespresso Machine', 'Bath Tub', 'Ocean/City View', 'Lounge Access'],
      rules: ['No smoking inside the room.', 'Quiet hours: 10 PM - 8 AM.'],
      images: ['/hotel1.png'],
    },
    {
      roomNumber: '104',
      roomType: 'SUITE' as const,
      pricePerNight: 12000,
      capacity: 4,
      bedType: 'KING' as const,
      roomSizeSqFt: 800,
      amenities: ['Free Wi-Fi', 'Two 4K Smart TVs', 'Centralized AC', 'Premium Mini Bar', 'Nespresso Machine', 'Jacuzzi Bath', 'Balcony View', 'Lounge Access', 'Kitchenette'],
      rules: ['No smoking inside the room.', 'Quiet hours: 10 PM - 8 AM.'],
      images: ['/hotel1.png'],
    },
    {
      roomNumber: '105',
      roomType: 'PRESIDENTIAL' as const,
      pricePerNight: 25000,
      capacity: 4,
      bedType: 'KING' as const,
      roomSizeSqFt: 1400,
      amenities: ['Free Wi-Fi', 'Home Theater TV System', 'Centralized AC', 'Premium Stocked Bar', 'Nespresso Machine', 'Steam Room & Jacuzzi', 'Panaromic Penthouse View', 'Private Butler Service', 'Full Dining Room'],
      rules: ['No smoking inside the room.', 'No parties allowed without prior admin approval.'],
      images: ['/hotel1.png'],
    },
  ];

  for (const rData of roomsData) {
    let room = await Room.findOne({ roomNumber: rData.roomNumber });
    if (!room) {
      room = await Room.create({
        roomNumber: rData.roomNumber,
        floor: parseInt(rData.roomNumber[0], 10),
        kitchen: kitchen._id,
        isActive: true,
        status: 'AVAILABLE',
        roomType: rData.roomType,
        pricePerNight: rData.pricePerNight,
        capacity: rData.capacity,
        bedType: rData.bedType,
        roomSizeSqFt: rData.roomSizeSqFt,
        amenities: rData.amenities,
        rules: rData.rules,
        images: rData.images,
        qr: {
          token: `qr-token-room-${rData.roomNumber}-dynamic-xyz`,
          isActive: true,
          version: 1,
          generatedAt: new Date(),
        },
      });
      logger.info(`✅ Created Room: ${rData.roomNumber}`);
    } else {
      room.roomType = rData.roomType;
      room.pricePerNight = rData.pricePerNight;
      room.capacity = rData.capacity;
      room.bedType = rData.bedType;
      room.roomSizeSqFt = rData.roomSizeSqFt;
      room.amenities = rData.amenities;
      room.rules = rData.rules;
      room.images = rData.images;
      await room.save();
      logger.info(`✅ Updated Room Details: ${rData.roomNumber}`);
    }
  }

  // Seed Banquet Halls
  const hallsData = [
    { name: 'Royal Ballroom', capacity: 500, pricePerHour: 15000, pricePerPlate: 2500 },
    { name: 'Imperial Banquet Hall', capacity: 300, pricePerHour: 10000, pricePerPlate: 2000 },
    { name: 'Crystal Palace', capacity: 800, pricePerHour: 25000, pricePerPlate: 3500 },
    { name: 'Grand Celebration Hall', capacity: 400, pricePerHour: 12000, pricePerPlate: 1800 },
    { name: 'Heritage Courtyard', capacity: 250, pricePerHour: 8000, pricePerPlate: 1500 },
    { name: 'Emerald Ballroom', capacity: 150, pricePerHour: 6000, pricePerPlate: 1200 },
  ];

  for (const hData of hallsData) {
    const hall = await BanquetHall.findOne({ name: hData.name });
    if (!hall) {
      await BanquetHall.create({
        name: hData.name,
        capacity: hData.capacity,
        pricePerHour: hData.pricePerHour,
        pricePerPlate: hData.pricePerPlate,
        kitchen: kitchen._id,
        isActive: true,
      });
      logger.info(`✅ Created Banquet Hall: ${hData.name}`);
    } else {
      hall.capacity = hData.capacity;
      hall.pricePerHour = hData.pricePerHour;
      hall.pricePerPlate = hData.pricePerPlate;
      await hall.save();
      logger.info(`✅ Updated Banquet Hall: ${hData.name}`);
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
      image: { url: '/food/burger.png', publicId: 'burger' },
    },
    {
      name: 'Fresh Garden Pizza',
      description: 'Wood-fired sourdough crust topped with marinara sauce, bell peppers, fresh mushrooms, black olives, and premium mozzarella.',
      price: 499,
      taxPercent: 5,
      prepTimeMinutes: 20,
      foodLabel: 'VEG',
      image: { url: '/food/pizza.png', publicId: 'pizza' },
    },
    {
      name: 'Belgian Chocolate Waffles',
      description: 'Warm, crispy waffles served with premium Belgian dark chocolate drizzle and vanilla bean ice cream scoop.',
      price: 249,
      taxPercent: 5,
      prepTimeMinutes: 12,
      foodLabel: 'VEG',
      image: { url: '/food/waffles.png', publicId: 'waffles' },
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
        image: it.image,
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
    } else {
      exists.image = it.image;
      await exists.save();
      logger.info(`✅ Updated Menu Item image: ${it.name}`);
    }
  }

  logger.info('Database seeding complete! Disconnecting…');
  await disconnectDatabase();
}

seedLocalDev().catch((err) => {
  logger.error({ err }, 'Local seeding failed');
  process.exit(1);
});
