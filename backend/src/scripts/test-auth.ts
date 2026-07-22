import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import { env } from '../config/env';
import { User } from '../models';
import { generateTokens } from '../utils/jwt';
import axios from 'axios';

async function test() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@hotel.com' });
    if (!user) throw new Error('Admin not found');
    
    const { accessToken } = generateTokens(user._id.toString());
    
    console.log('Got token, making request to /api/v1/gallery/admin...');
    const res = await axios.get('http://localhost:5000/api/v1/gallery/admin', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    console.log('Success! Response:', res.status, res.data);
    process.exit(0);
  } catch (error: any) {
    console.error('Failed:', error.response?.status, error.response?.data || error.message);
    process.exit(1);
  }
}

test();
