import { connectDatabase, disconnectDatabase } from '@/config/db';
import { logger } from '@/config/logger';
import { Kitchen, Order } from '@/models';

async function listKitchensAndOrders() {
  await connectDatabase();
  
  const kitchens = await Kitchen.find({});
  logger.info(`Found ${kitchens.length} Kitchens:`);
  for (const k of kitchens) {
    logger.info(`  • Kitchen: "${k.name}" (ID: ${k._id}, Slug: "${k.slug}", Owner: ${k.owner})`);
  }
  
  const orders = await Order.find({});
  logger.info(`Found ${orders.length} Orders:`);
  for (const o of orders) {
    logger.info(`  • Order #${o.orderNumber}: Status: "${o.status}", Kitchen ID: ${o.kitchen}`);
  }
  
  await disconnectDatabase();
}

listKitchensAndOrders().catch(console.error);
