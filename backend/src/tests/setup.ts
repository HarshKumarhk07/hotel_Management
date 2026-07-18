import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * Spin up an in-memory MongoDB **replica set** for the whole test run (a replica
 * set is required so multi-document transactions used by the kitchen/QR services
 * work just like MongoDB Atlas). Collections are wiped between tests.
 */
let mongo: MongoMemoryReplSet;

// Provide deterministic secrets so env validation passes under test.
process.env.NODE_ENV = 'test';
process.env.APP_URL ||= 'http://localhost:3000';
process.env.API_URL ||= 'http://localhost:5000';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789-abcdefghij';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789-abcdefghij';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-0123456789-abcdefghij';
process.env.ADMIN_SECRET_CODE ||= 'admin-code-123';
process.env.KITCHEN_SECRET_CODE ||= 'kitchen-code-123';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/kds-test';
process.env.RAZORPAY_KEY_ID ||= 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET ||= 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET ||= 'rzp_webhook_secret';

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
