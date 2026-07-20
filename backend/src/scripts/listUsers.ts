import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const users = await User.find({});
  console.log('Users in DB:', users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive })));
  await mongoose.disconnect();
}

run().catch(console.error);
