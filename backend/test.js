const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/the-page-hotel'); // Wait, check the env for DB URI
  console.log('Connected');
  const db = mongoose.connection.db;
  const bookings = await db.collection('banquetbookings').find().toArray();
  console.log('Bookings:', bookings);
  mongoose.disconnect();
}
run();
