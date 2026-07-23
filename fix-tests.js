const fs = require('fs');
const path = require('path');

const roomBookingTestFile = path.join(__dirname, 'backend/src/tests/roomBooking.test.ts');
let roomBookingContent = fs.readFileSync(roomBookingTestFile, 'utf8');

// Replace all instances of checkOutDate... with checkOutDate... + idProof details
// There are multiple instances of payload creation and RoomBooking.create.

// 1. Fix RoomBooking.create
roomBookingContent = roomBookingContent.replace(/priceBreakdown: (.*),/g, `priceBreakdown: $1,
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',`);

// 2. Fix payload creation
roomBookingContent = roomBookingContent.replace(/checkOutDate: new Date\((.*?)\).toISOString\(\),/g, `checkOutDate: new Date($1).toISOString(),
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',`);

fs.writeFileSync(roomBookingTestFile, roomBookingContent);


const roomTestFile = path.join(__dirname, 'backend/src/tests/room.test.ts');
let roomContent = fs.readFileSync(roomTestFile, 'utf8');

// Add RoomBooking import
roomContent = roomContent.replace(`import { Room } from '@/models';`, `import { Room, RoomBooking } from '@/models';`);

// Fix first QR test
const test1Old = `// attach an internal note that must never leak
    await Room.updateOne({ _id: room._id }, { $set: { internalNote: 'VIP guest' } });

    const res = await request(app).get(\`\${api}/resolve/\${room.qr.token}\`).expect(200);`;

const test1New = `// attach an internal note that must never leak
    await Room.updateOne({ _id: room._id }, { $set: { internalNote: 'VIP guest' } });

    await RoomBooking.create({
      room: room._id,
      guestName: 'Test Guest',
      phone: '+919999999999',
      email: 'test@example.com',
      checkInDate: new Date(Date.now() - 100000),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 1000,
      status: 'CONFIRMED',
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',
      priceBreakdown: { roomPrice: 1000, nights: 1, grandTotal: 1000 },
    });

    const res = await request(app).get(\`\${api}/resolve/\${room.qr.token}\`).expect(200);`;

roomContent = roomContent.replace(test1Old, test1New);

// Fix second QR test (disabled QR)
const test2Old = `it('rejects a disabled QR', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '602', 6);
    await request(app).patch(\`\${api}/\${room._id}/qr/disable\`).set('Authorization', bearer).expect(200);

    const res = await request(app).get(\`\${api}/resolve/\${room.qr.token}\`).expect(403);`;

const test2New = `it('rejects a disabled QR', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '602', 6);

    await RoomBooking.create({
      room: room._id,
      guestName: 'Test Guest',
      phone: '+919999999999',
      email: 'test@example.com',
      checkInDate: new Date(Date.now() - 100000),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 1000,
      status: 'CONFIRMED',
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',
      priceBreakdown: { roomPrice: 1000, nights: 1, grandTotal: 1000 },
    });

    await request(app).patch(\`\${api}/\${room._id}/qr/disable\`).set('Authorization', bearer).expect(200);

    const res = await request(app).get(\`\${api}/resolve/\${room.qr.token}\`).expect(403);`;

roomContent = roomContent.replace(test2Old, test2New);

fs.writeFileSync(roomTestFile, roomContent);
console.log('Tests fixed successfully!');
