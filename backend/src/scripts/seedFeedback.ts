import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Feedback } from '../models/Feedback';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const sampleFeedbacks = [
  {
    guestName: 'John Doe',
    email: 'john@example.com',
    phone: '9999988888',
    roomNumber: '101',
    category: 'ROOM',
    rating: 5,
    comment: 'The room was fantastic, very clean and comfortable.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    guestName: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '8888877777',
    category: 'FOOD',
    rating: 4,
    comment: 'Dinner was excellent, though the dessert took a while.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'Robert Johnson',
    phone: '7777766666',
    category: 'VALET',
    rating: 5,
    comment: 'Valet was very prompt and courteous.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'Emily Davis',
    email: 'emily.d@example.com',
    phone: '6666655555',
    roomNumber: '205',
    category: 'GENERAL',
    rating: 3,
    comment: 'Overall good stay, but the wifi was a bit spotty in the lobby.',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'Michael Brown',
    phone: '5555544444',
    category: 'FOOD',
    rating: 5,
    comment: 'Best breakfast buffet I have ever had.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'Sarah Miller',
    phone: '4444433333',
    roomNumber: '302',
    category: 'ROOM',
    rating: 2,
    comment: 'AC was making noise all night.',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'David Wilson',
    email: 'dwilson@example.com',
    phone: '3333322222',
    category: 'VALET',
    rating: 1,
    comment: 'Waited 20 minutes for my car.',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    guestName: 'Amanda Moore',
    phone: '2222211111',
    category: 'GENERAL',
    rating: 4,
    comment: 'Beautiful property and great staff.',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    console.log('Clearing old feedback...');
    await Feedback.deleteMany({});

    console.log('Inserting sample feedback...');
    await Feedback.insertMany(sampleFeedbacks);
    
    console.log(`Successfully seeded ${sampleFeedbacks.length} feedbacks!`);
  } catch (error) {
    console.error('Error seeding feedback:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

seed();
