import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Vehicle, Order, Kitchen, ParkingSlot } from '../models';

dotenv.config();

async function seedMockData() {
  await connectDatabase();

  const kitchen = await Kitchen.findOne({});
  if (!kitchen) {
    console.log('No kitchen found, skipping order seeding.');
  } else {
    // Seed some orders
    console.log('Seeding mock orders...');
    const dummyOrders = [
      {
        orderNumber: 'ORD-12345',
        kitchen: kitchen._id,
        status: 'PENDING',
        type: 'ROOM_DELIVERY',
        roomNumber: '101',
        guestInfo: { name: 'John Doe', email: 'john@example.com', phone: '1234567890' },
        items: [
          {
            menuItem: new mongoose.Types.ObjectId(),
            name: 'Classic Burger',
            foodLabel: 'NON_VEG',
            unitPrice: 500,
            taxPercent: 5,
            quantity: 2,
            cancelledQuantity: 0,
            lineSubtotal: 1000,
            lineTax: 50,
            lineTotal: 1050
          }
        ],
        subtotal: 1000,
        taxTotal: 50,
        serviceChargeTotal: 0,
        discountTotal: 0,
        grandTotal: 1050,
        paymentStatus: 'UNPAID',
        paymentMethod: 'ROOM_BILL',
        statusHistory: [{ status: 'PENDING', at: new Date() }]
      },
      {
        orderNumber: 'ORD-67890',
        kitchen: kitchen._id,
        status: 'PREPARING',
        type: 'TAKEAWAY',
        guestInfo: { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321' },
        items: [
          {
            menuItem: new mongoose.Types.ObjectId(),
            name: 'Vegan Salad',
            foodLabel: 'VEG',
            unitPrice: 300,
            taxPercent: 5,
            quantity: 1,
            cancelledQuantity: 0,
            lineSubtotal: 300,
            lineTax: 15,
            lineTotal: 315
          }
        ],
        subtotal: 300,
        taxTotal: 15,
        serviceChargeTotal: 0,
        discountTotal: 0,
        grandTotal: 315,
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
        statusHistory: [
          { status: 'PENDING', at: new Date(Date.now() - 10000) },
          { status: 'PREPARING', at: new Date() }
        ]
      }
    ];

    for (const order of dummyOrders) {
      if (!(await Order.exists({ orderNumber: order.orderNumber }))) {
        await Order.create(order);
      }
    }
  }

  // Seed some vehicles
  console.log('Seeding mock vehicles...');
  const slot1 = await ParkingSlot.findOne({ isOccupied: false });
  const slot2 = await ParkingSlot.findOne({ isOccupied: false, _id: { $ne: slot1?._id } });

  const dummyVehicles = [
    {
      secureToken: 'token-abc',
      carNumber: 'KA-01-HH-1234',
      brand: 'Toyota',
      model: 'Camry',
      color: 'White',
      parkingSlot: slot1?.slotNumber || 'P-01',
      keyTag: 'K-01',
      status: 'PARKED',
      guestInfo: { name: 'Alice Bob', phone: '1112223334', email: 'alice@example.com' },
      photos: {
        front: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        rear: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        left: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        right: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        dashboard: { url: 'https://placeholder.com/150', publicId: 'dummy' },
      }
    },
    {
      secureToken: 'token-def',
      carNumber: 'MH-12-AB-5678',
      brand: 'Honda',
      model: 'Civic',
      color: 'Black',
      parkingSlot: slot2?.slotNumber || 'P-02',
      keyTag: 'K-02',
      status: 'REQUESTED',
      requestedAt: new Date(),
      guestInfo: { name: 'Charlie Dave', phone: '5556667778', email: 'charlie@example.com' },
      photos: {
        front: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        rear: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        left: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        right: { url: 'https://placeholder.com/150', publicId: 'dummy' },
        dashboard: { url: 'https://placeholder.com/150', publicId: 'dummy' },
      }
    }
  ];

  for (const vehicle of dummyVehicles) {
    if (!(await Vehicle.exists({ carNumber: vehicle.carNumber }))) {
      await Vehicle.create(vehicle);
      if (vehicle.status === 'PARKED' && slot1) {
        slot1.isOccupied = true;
        await slot1.save();
      }
      if (vehicle.status === 'REQUESTED' && slot2) {
        slot2.isOccupied = true;
        await slot2.save();
      }
    }
  }

  console.log('Mock data seeded successfully!');
  await disconnectDatabase();
}

seedMockData().catch(console.error);
