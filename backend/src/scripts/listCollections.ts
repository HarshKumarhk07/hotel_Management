import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import mongoose from 'mongoose';

async function listCollections() {
  await connectDatabase();
  const db = mongoose.connection.db;
  
  if (!db) {
    logger.error('❌ Could not connect to database');
    await disconnectDatabase();
    return;
  }
  
  const collections = await db.listCollections().toArray();
  logger.info(`🗄️ Database Connected. Found ${collections.length} collections.`);
  
  for (const colInfo of collections) {
    const colName = colInfo.name;
    const count = await db.collection(colName).countDocuments();
    logger.info(`  • ${colName}: ${count} documents`);
  }
  
  await disconnectDatabase();
}

listCollections().catch(console.error);
