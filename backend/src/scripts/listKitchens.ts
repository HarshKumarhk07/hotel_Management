import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Kitchen } from '../models/Kitchen';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const kitchens = await Kitchen.find({});
  console.log('Kitchens in DB:', kitchens.map(k => ({ id: k._id, name: k.name, isActive: k.isActive })));
  await mongoose.disconnect();
}

run().catch(console.error);
