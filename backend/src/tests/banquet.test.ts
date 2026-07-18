import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/banquets';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

async function prepareKitchen() {
  return Kitchen.create({
    name: 'Test Banquet Kitchen',
    slug: 'test-banquet-kitchen-' + Date.now(),
    isActive: true,
  });
}

describe('Banquet Hall Booking Module', () => {
  it('runs the complete banquet hall setup, booking, overlap-prevention, and checkout lifecycle', async () => {
    const kitchen = await prepareKitchen();
    const kitchenId = kitchen._id.toString();
    const bearer = await adminBearer();

    // 1. Create a banquet hall (admin)
    const hallRes = await request(app)
      .post(`${api}/halls`)
      .set('Authorization', bearer)
      .send({
        name: 'Grand Ballroom',
        capacity: 300,
        pricePerHour: 150,
        pricePerPlate: 25,
        kitchenId,
      })
      .expect(201);

    expect(hallRes.body.data.hall.name).toBe('Grand Ballroom');
    expect(hallRes.body.data.hall.pricePerHour).toBe(150);
    const hallId = hallRes.body.data.hall._id.toString();

    // 2. List active halls (public)
    const listHallsRes = await request(app)
      .get(`${api}/halls`)
      .expect(200);

    expect(listHallsRes.body.data.halls.length).toBeGreaterThan(0);

    // 3. Create a booking (public)
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 5); // 5 days from now
    
    const startTime = new Date(eventDate);
    startTime.setHours(10, 0, 0, 0);
    
    const endTime = new Date(eventDate);
    endTime.setHours(14, 0, 0, 0); // 4 hour duration

    const bookingRes = await request(app)
      .post(`${api}/bookings`)
      .send({
        hallId,
        guestName: 'John Banquet',
        phone: '+919999988888',
        email: 'john@banquet.com',
        eventDate: eventDate.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        guestCount: 100,
        eventType: 'Wedding Reception',
        menuPreset: 'Premium Buffet Menu A',
      })
      .expect(201);

    expect(bookingRes.body.data.booking.guestName).toBe('John Banquet');
    // Rent calculation: (4 hours * $150) + (100 guests * $25) = $600 + $2500 = $3100
    expect(bookingRes.body.data.booking.totalPrice).toBe(3100);
    const bookingId = bookingRes.body.data.booking._id.toString();

    // 4. Try to book the same hall overlapping the same time window (overlap prevention check)
    await request(app)
      .post(`${api}/bookings`)
      .send({
        hallId,
        guestName: 'Jane Doubler',
        phone: '+919999911111',
        email: 'jane@overlap.com',
        eventDate: eventDate.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        guestCount: 50,
        eventType: 'Birthday Party',
      })
      .expect(409); // Conflict

    // 5. Update booking status (admin)
    const updateRes = await request(app)
      .patch(`${api}/bookings/${bookingId}`)
      .set('Authorization', bearer)
      .send({
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      })
      .expect(200);

    expect(updateRes.body.data.booking.status).toBe('CONFIRMED');
    expect(updateRes.body.data.booking.paymentStatus).toBe('PAID');

    // 6. Download quotation PDF (public)
    const quoteRes = await request(app)
      .get(`${api}/bookings/${bookingId}/quotation`)
      .expect(200);
    expect(quoteRes.headers['content-type']).toBe('application/pdf');

    // 7. Download estimation PDF (public)
    const estRes = await request(app)
      .get(`${api}/bookings/${bookingId}/estimation`)
      .expect(200);
    expect(estRes.headers['content-type']).toBe('application/pdf');
  });
});