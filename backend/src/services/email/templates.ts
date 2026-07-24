import { env } from '@/config/env';

const brand = env.EMAIL_FROM_NAME;

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e4e4e7">
      <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
      <p style="font-size:12px;color:#71717a;margin:0">${brand} · This is an automated message, please do not reply.</p>
    </div>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${label}</a>`;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function verifyEmailTemplate(name: string, link: string): EmailContent {
  const safeName = escapeHtml(name);
  return {
    subject: `Verify your ${brand} account`,
    html: layout(
      'Confirm your email',
      `<p>Hi ${safeName}, welcome to ${brand}!</p>
       <p>Please confirm your email address to activate your account. This link expires in 24 hours.</p>
       <p style="margin:24px 0">${button(link, 'Verify email')}</p>
       <p style="font-size:12px;color:#71717a">If the button doesn't work, copy this link:<br>${link}</p>`,
    ),
    text: `Hi ${name}, confirm your ${brand} email within 24 hours: ${link}`,
  };
}

export function resetPasswordTemplate(name: string, link: string): EmailContent {
  const safeName = escapeHtml(name);
  return {
    subject: `Reset your ${brand} password`,
    html: layout(
      'Reset your password',
      `<p>Hi ${safeName},</p>
       <p>We received a request to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
       <p style="margin:24px 0">${button(link, 'Reset password')}</p>
       <p style="font-size:12px;color:#71717a">If the button doesn't work, copy this link:<br>${link}</p>`,
    ),
    text: `Hi ${name}, reset your ${brand} password within 1 hour: ${link}`,
  };
}

export function notificationTemplate(
  name: string,
  title: string,
  message: string,
  orderNumber?: string,
): EmailContent {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeOrderNumber = orderNumber ? escapeHtml(orderNumber) : undefined;
  return {
    subject: safeOrderNumber ? `${title} · ${orderNumber}` : title,
    html: layout(
      safeTitle,
      `<p>Hi ${safeName},</p>
       <p>${safeMessage}</p>
       ${safeOrderNumber ? `<p style="font-size:13px;color:#71717a">Order: <strong>${safeOrderNumber}</strong></p>` : ''}`,
    ),
    text: `${title}\n\nHi ${name}, ${message}${orderNumber ? `\nOrder: ${orderNumber}` : ''}`,
  };
}

export interface SecurityAlertData {
  name: string;
  reason: string;
  ip?: string;
  browser?: string;
  time: string;
}

export function securityAlertTemplate(d: SecurityAlertData): EmailContent {
  const safeName = escapeHtml(d.name);
  const safeReason = escapeHtml(d.reason);
  const safeIp = d.ip ? escapeHtml(d.ip) : undefined;
  const safeBrowser = d.browser ? escapeHtml(d.browser) : undefined;
  const safeTime = escapeHtml(d.time);
  return {
    subject: `⚠️ Security alert on your ${brand} account`,
    html: layout(
      'Security alert',
      `<p>Hi ${safeName},</p>
       <p>${safeReason}</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0">
         <tr><td style="padding:4px 12px 4px 0;color:#71717a">When</td><td>${safeTime}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#71717a">IP address</td><td>${safeIp ?? 'unknown'}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#71717a">Browser</td><td>${safeBrowser ?? 'unknown'}</td></tr>
       </table>
       <p>If this was you, no action is needed. If not, please reset your password immediately and contact support.</p>`,
    ),
    text: `Security alert: ${d.reason} (IP ${d.ip ?? 'unknown'}, ${d.browser ?? 'unknown'}, ${d.time})`,
  };
}

export function valetCheckInTemplate(name: string, carNumber: string, parkingSlot: string, time: string, token: string): EmailContent {
  const safeName = escapeHtml(name);
  const safeCarNumber = escapeHtml(carNumber);
  const safeParkingSlot = escapeHtml(parkingSlot);
  const formattedTime = new Date(time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const trackLink = `${env.APP_URL}/valet/track/${token}`;
  return {
    subject: `🚗 Valet Parking Check-In Confirmation - ${carNumber}`,
    html: layout(
      'Valet Parking Check-In',
      `<p>Hi ${safeName},</p>
       <p>Your vehicle has been successfully parked by our valet team.</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:120px">Car Number</td><td style="padding:8px 0;font-weight:bold">${safeCarNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Parking Slot</td><td style="padding:8px 0;font-weight:bold">${safeParkingSlot}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Check-In Time</td><td style="padding:8px 0">${formattedTime}</td></tr>
       </table>
       <div style="margin:24px 0;text-align:center">
         <a href="${trackLink}" style="display:inline-block;background-color:#D8B854;color:#181d24;padding:12px 24px;font-weight:bold;text-decoration:none;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
           Track & Request Vehicle
         </a>
       </div>
       <p style="font-size:12px;color:#71717a;margin-top:16px">
         If the button doesn't work, copy and paste this link in your browser: <br />
         <a href="${trackLink}" style="color:#D8B854">${trackLink}</a>
       </p>`,
    ),
    text: `Valet Check-In: Hi ${name}, your vehicle ${carNumber} was checked in to slot ${parkingSlot} at ${formattedTime}. Live status link: ${trackLink}`,
  };
}

export function valetReadyTemplate(name: string, carNumber: string): EmailContent {
  const safeName = escapeHtml(name);
  const safeCarNumber = escapeHtml(carNumber);
  return {
    subject: `✨ Your vehicle ${carNumber} is ready for pick-up!`,
    html: layout(
      'Vehicle Ready Outside',
      `<p>Hi ${safeName},</p>
       <p>Your vehicle with plate number <strong>${safeCarNumber}</strong> is ready and waiting for you outside the main hotel lobby entrance.</p>
       <p>Our valet team is ready to hand over the keys upon arrival.</p>
       <p>Safe travels!</p>`,
    ),
    text: `Vehicle Ready: Hi ${name}, your vehicle ${carNumber} is ready outside the main lobby entrance.`,
  };
}

export function valetDeliveredTemplate(name: string, carNumber: string): EmailContent {
  const safeName = escapeHtml(name);
  const safeCarNumber = escapeHtml(carNumber);
  return {
    subject: `` + `✅ Vehicle Delivered - ${carNumber}` + ``,
    html: layout(
      'Vehicle Handed Over',
      `<p>Hi ${safeName},</p>
       <p>Your vehicle <strong>${safeCarNumber}</strong> has been successfully delivered and handed over to you.</p>
       <p>Thank you for using our valet service. We hope you have a pleasant journey!</p>`,
    ),
    text: `Vehicle Delivered: Hi ${name}, your vehicle ${carNumber} has been successfully handed over to you.`,
  };
}

export function valetWelcomeTemplate(name: string, email: string, tempPassword: string): EmailContent {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(tempPassword);
  return {
    subject: `🎉 Welcome to the Valet Team - ${brand}`,
    html: layout(
      'Account Created Successfully',
      `<p>Hi ${safeName},</p>
       <p>You have been registered as a Valet Manager at <strong>${brand}</strong>.</p>
       <p>Here are your temporary login credentials. Please use these to sign in:</p>
       <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0;font-family:monospace;font-size:14px;border:1px solid #e4e4e7">
         <strong>Email:</strong> ${safeEmail}<br/>
         <strong>Password:</strong> ${safePassword}
       </div>
       <p>To access your dashboard, visit the valet entry terminal login page.</p>`,
    ),
    text: `Hi ${name}, welcome to the valet team at ${brand}! Your login email is ${email} and temporary password is ${tempPassword}.`,
  };
}

export function roomBookingConfirmationTemplate(
  name: string,
  roomNumber: string,
  checkInDate: string,
  checkOutDate: string,
  confirmationNumber: string,
  amountPaid: number
): EmailContent {
  const safeName = escapeHtml(name);
  const safeRoomNumber = escapeHtml(roomNumber);
  const safeConfirmationNumber = escapeHtml(confirmationNumber);
  const formattedCheckIn = new Date(checkInDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const formattedCheckOut = new Date(checkOutDate).toLocaleDateString('en-IN', { dateStyle: 'long' });

  return {
    subject: `🛎️ Stay Confirmation: Room ${safeRoomNumber} - ${safeConfirmationNumber}`,
    html: layout(
      'Reservation Confirmed',
      `<p>Hi ${safeName},</p>
       <p>Your royal stay at <strong>The Page Hotel</strong> has been confirmed. Below are your reservation details:</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:150px">Confirmation Code</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">${safeConfirmationNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Room Number</td><td style="padding:8px 0;font-weight:bold">Room ${safeRoomNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Check-In Date</td><td style="padding:8px 0">${formattedCheckIn} (After 14:00)</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Check-Out Date</td><td style="padding:8px 0">${formattedCheckOut} (Before 12:00)</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Amount Paid</td><td style="padding:8px 0;font-weight:bold">₹${amountPaid}</td></tr>
       </table>
       <p>Please present the QR code on your booking confirmation page at the front desk for immediate check-in key hand-off.</p>
       <p>We look forward to welcoming you!</p>`,
    ),
    text: `Stay Confirmation: Hi ${name}, your booking for Room ${roomNumber} from ${formattedCheckIn} to ${formattedCheckOut} has been confirmed. Confirmation Code: ${confirmationNumber}. Amount Paid: ₹${amountPaid}.`,
  };
}

export function roomBookingPendingTemplate(
  name: string,
  roomNumber: string,
  checkInDate: string,
  checkOutDate: string,
  confirmationNumber: string,
  totalAmount: number,
  payAtHotel: boolean
): EmailContent {
  const safeName = escapeHtml(name);
  const safeRoomNumber = escapeHtml(roomNumber);
  const safeConfirmationNumber = escapeHtml(confirmationNumber);
  const formattedCheckIn = new Date(checkInDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const formattedCheckOut = new Date(checkOutDate).toLocaleDateString('en-IN', { dateStyle: 'long' });

  const paymentNote = payAtHotel
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#c2410c;font-weight:bold">💳 Payment Due at Hotel</p>
        <p style="margin:8px 0 0;color:#92400e;font-size:13px">Your room is reserved. Please settle the amount of <strong>₹${totalAmount}</strong> at the hotel front desk upon arrival.</p>
      </div>`
    : `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#c2410c;font-weight:bold">⚠️ Payment Pending</p>
        <p style="margin:8px 0 0;color:#92400e;font-size:13px">Your online payment could not be completed. Your reservation is still held. You can complete the payment online or settle <strong>₹${totalAmount}</strong> at the hotel front desk on arrival.</p>
      </div>`;

  const subjectPrefix = payAtHotel ? '🏨 Booking Confirmed (Pay at Hotel)' : '⏳ Booking Registered – Payment Pending';

  return {
    subject: `${subjectPrefix}: Room ${safeRoomNumber} - ${safeConfirmationNumber}`,
    html: layout(
      payAtHotel ? 'Reservation Registered – Pay on Arrival' : 'Reservation Registered – Payment Pending',
      `<p>Hi ${safeName},</p>
       <p>Your reservation at <strong>The Page Hotel</strong> has been registered. Here are your booking details:</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:150px">Confirmation Code</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">${safeConfirmationNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Room Number</td><td style="padding:8px 0;font-weight:bold">Room ${safeRoomNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Check-In Date</td><td style="padding:8px 0">${formattedCheckIn} (After 14:00)</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Check-Out Date</td><td style="padding:8px 0">${formattedCheckOut} (Before 12:00)</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Total Amount</td><td style="padding:8px 0;font-weight:bold">₹${totalAmount}</td></tr>
       </table>
       ${paymentNote}
       <p>If you have any questions, please contact us and quote your confirmation code above.</p>
       <p>We look forward to welcoming you!</p>`,
    ),
    text: `${subjectPrefix}: Hi ${name}, your booking for Room ${roomNumber} from ${formattedCheckIn} to ${formattedCheckOut} is registered. Confirmation Code: ${confirmationNumber}. Amount: ₹${totalAmount}. ${payAtHotel ? 'Please pay at the hotel front desk on arrival.' : 'Payment is pending. Please settle at the hotel on arrival.'}`,
  };
}

export interface RoomTransferData {
  name: string;
  confirmationNumber: string;
  oldRoomNumber: string;
  oldRoomType: string;
  oldFloor: number | string;
  newRoomNumber: string;
  newRoomType: string;
  newFloor: number | string;
  transferTime: string;
  /** Present when the new room carries a different ordering QR. */
  qrScanUrl?: string;
  type: 'NORMAL' | 'UPGRADE' | 'DOWNGRADE';
  amountDue?: number;
  refundAmount?: number;
}

function transferDetailTable(d: RoomTransferData): string {
  const row = (label: string, value: string) =>
    `<tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:160px">${label}</td><td style="padding:8px 0;font-weight:bold">${value}</td></tr>`;
  return `<table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
    ${row('Confirmation Code', escapeHtml(d.confirmationNumber))}
    ${row('Previous Room', `Room ${escapeHtml(d.oldRoomNumber)} · ${escapeHtml(d.oldRoomType)} · Floor ${escapeHtml(String(d.oldFloor))}`)}
    ${row('New Room', `Room ${escapeHtml(d.newRoomNumber)} · ${escapeHtml(d.newRoomType)} · Floor ${escapeHtml(String(d.newFloor))}`)}
    ${row('Transfer Time', escapeHtml(new Date(d.transferTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })))}
  </table>`;
}

function qrBlock(qrScanUrl?: string): string {
  if (!qrScanUrl) return '';
  return `<div style="background:#faf9f6;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:bold;color:#3f3f46">📱 Your in-room ordering QR has changed</p>
      <p style="margin:8px 0 0;font-size:13px;color:#71717a">Use the QR code inside your new room, or open this link directly:<br/>
      <a href="${qrScanUrl}" style="color:#D4AF37;word-break:break-all">${qrScanUrl}</a></p>
    </div>`;
}

/** Guest notice that their stay has been moved to a different room. */
export function roomTransferTemplate(d: RoomTransferData): EmailContent {
  const safeName = escapeHtml(d.name);

  let intro: string;
  let money = '';
  let subject: string;

  if (d.type === 'UPGRADE') {
    subject = `⬆️ Room Upgrade Confirmed: Room ${d.newRoomNumber} - ${d.confirmationNumber}`;
    intro = `Your stay has been upgraded from <strong>${escapeHtml(d.oldRoomType)}</strong> to <strong>${escapeHtml(d.newRoomType)}</strong>.`;
    money = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#15803d;font-weight:bold">✅ Upgrade payment received</p>
        <p style="margin:8px 0 0;color:#166534;font-size:13px">The upgrade differential of <strong>₹${d.amountDue ?? 0}</strong> has been settled. No further action is required.</p>
      </div>`;
  } else if (d.type === 'DOWNGRADE') {
    subject = `🔄 Room Change Confirmed: Room ${d.newRoomNumber} - ${d.confirmationNumber}`;
    intro = `Your stay has been moved from <strong>${escapeHtml(d.oldRoomType)}</strong> to <strong>${escapeHtml(d.newRoomType)}</strong>.`;
    money = `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#c2410c;font-weight:bold">💰 Refund of ₹${d.refundAmount ?? 0} initiated</p>
        <p style="margin:8px 0 0;color:#92400e;font-size:13px">The difference will be returned to your original payment method, or settled at the front desk if you are paying at the hotel.</p>
      </div>`;
  } else {
    subject = `🔑 Room Transfer Confirmed: Room ${d.newRoomNumber} - ${d.confirmationNumber}`;
    intro = `Your stay has been moved to a different room of the same <strong>${escapeHtml(d.newRoomType)}</strong> class. There is no change to your billing.`;
  }

  return {
    subject,
    html: layout(
      'Room Transfer Confirmed',
      `<p>Hi ${safeName},</p>
       <p>${intro}</p>
       ${transferDetailTable(d)}
       ${money}
       ${qrBlock(d.qrScanUrl)}
       <p>Our front desk team has the keys to your new room ready. Please contact us if anything is not as expected.</p>`,
    ),
    text: `Room transfer: Hi ${d.name}, your booking ${d.confirmationNumber} has moved from Room ${d.oldRoomNumber} (${d.oldRoomType}, Floor ${d.oldFloor}) to Room ${d.newRoomNumber} (${d.newRoomType}, Floor ${d.newFloor}) at ${new Date(d.transferTime).toLocaleString('en-IN')}.${d.qrScanUrl ? ` New room QR: ${d.qrScanUrl}` : ''}`,
  };
}

/** Guest notice that an upgrade is reserved but awaiting the differential payment. */
export function roomUpgradePaymentTemplate(d: RoomTransferData): EmailContent {
  const safeName = escapeHtml(d.name);
  return {
    subject: `💳 Upgrade Payment Pending: Room ${d.newRoomNumber} - ${d.confirmationNumber}`,
    html: layout(
      'Room Upgrade — Payment Pending',
      `<p>Hi ${safeName},</p>
       <p>We have reserved a <strong>${escapeHtml(d.newRoomType)}</strong> room for your stay. The upgrade completes as soon as the differential is settled.</p>
       ${transferDetailTable(d)}
       <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
         <p style="margin:0;color:#c2410c;font-weight:bold">⚠️ Amount due: ₹${d.amountDue ?? 0}</p>
         <p style="margin:8px 0 0;color:#92400e;font-size:13px">Please settle this amount at the front desk. Your existing room remains reserved for you until the upgrade is confirmed.</p>
       </div>
       <p>Quote your confirmation code above when you speak to our team.</p>`,
    ),
    text: `Upgrade pending: Hi ${d.name}, your upgrade to Room ${d.newRoomNumber} (${d.newRoomType}) on booking ${d.confirmationNumber} requires a differential payment of ₹${d.amountDue ?? 0}. Please settle at the front desk.`,
  };
}

export function roomBookingCancelledTemplate(
  name: string,
  roomNumber: string,
  confirmationNumber: string,
  reason: string,
  refundNote: string
): EmailContent {
  const safeName = escapeHtml(name);
  const safeRoomNumber = escapeHtml(roomNumber);
  const safeConfirmationNumber = escapeHtml(confirmationNumber);
  const safeReason = escapeHtml(reason);
  const safeRefundNote = escapeHtml(refundNote);

  return {
    subject: `❌ Booking Cancelled: Room ${safeRoomNumber} - ${safeConfirmationNumber}`,
    html: layout(
      'Reservation Cancelled',
      `<p>Hi ${safeName},</p>
       <p>Your reservation at <strong>The Page Hotel</strong> has been cancelled as requested.</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:150px">Confirmation Code</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">${safeConfirmationNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Room Number</td><td style="padding:8px 0;font-weight:bold">Room ${safeRoomNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Reason</td><td style="padding:8px 0">${safeReason}</td></tr>
       </table>
       <p style="font-size:13px;color:#71717a">${safeRefundNote}</p>
       <p>We hope to welcome you another time.</p>`,
    ),
    text: `Booking cancelled: Hi ${name}, your reservation ${confirmationNumber} for Room ${roomNumber} has been cancelled. Reason: ${reason}. ${refundNote}`,
  };
}

const TICKET_STATUS_COPY: Record<string, string> = {
  PENDING: 'has been received and is queued for our operations team',
  ASSIGNED: 'has been assigned to a member of our staff',
  IN_PROGRESS: 'is now being worked on',
  COMPLETED: 'has been completed',
  CLOSED: 'has been closed',
  REJECTED: 'could not be actioned',
};

export function serviceTicketStatusTemplate(
  name: string,
  ticketId: string,
  roomNumber: string,
  category: string,
  status: string,
  staffNotes?: string
): EmailContent {
  const safeName = escapeHtml(name);
  const safeTicketId = escapeHtml(ticketId);
  const safeRoomNumber = escapeHtml(roomNumber);
  const safeCategory = escapeHtml(category);
  const safeStatus = escapeHtml(status);
  const copy = TICKET_STATUS_COPY[status] ?? `is now marked ${safeStatus}`;

  return {
    subject: `🎫 Service Request ${safeStatus}: #${safeTicketId}`,
    html: layout(
      'Service Request Update',
      `<p>Hi ${safeName},</p>
       <p>Your ${safeCategory.toLowerCase().replace(/_/g, ' ')} request for Room ${safeRoomNumber} ${copy}.</p>
       <table style="font-size:14px;color:#3f3f46;margin:16px 0;border-collapse:collapse;width:100%">
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a;width:150px">Ticket</td><td style="padding:8px 0;font-weight:bold;font-family:monospace">#${safeTicketId}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Room</td><td style="padding:8px 0;font-weight:bold">Room ${safeRoomNumber}</td></tr>
         <tr style="border-bottom:1px solid #e4e4e7"><td style="padding:8px 0;color:#71717a">Status</td><td style="padding:8px 0;font-weight:bold">${safeStatus}</td></tr>
       </table>
       ${staffNotes ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;color:#15803d;font-weight:bold">Note from our team</p><p style="margin:8px 0 0;color:#166534;font-size:13px">${escapeHtml(staffNotes)}</p></div>` : ''}
       <p>You can follow live progress from the Service tab of your guest dashboard.</p>`,
    ),
    text: `Service request #${ticketId} (${category}, Room ${roomNumber}) ${copy}.${staffNotes ? ` Note: ${staffNotes}` : ''}`,
  };
}

export function checkoutFeedbackTemplate(
  name: string,
  roomNumber: string,
  feedbackLink: string
): EmailContent {
  const safeName = escapeHtml(name);
  const safeRoomNumber = escapeHtml(roomNumber);
  
  return {
    subject: `🛎️ Hope you enjoyed your stay at The Page Hotel! - Feedback Request`,
    html: layout(
      'Thank You for Staying With Us',
      `<p>Dear ${safeName},</p>
       <p>Thank you for choosing <strong>The Page Hotel</strong> for your recent stay in Chamber ${safeRoomNumber}. It was our absolute privilege to host you.</p>
       <p>As part of our commitment to delivering a truly bespoke luxury experience, we would love to hear your feedback on your stay, service quality, and dining experience.</p>
       <div style="text-align: center; margin: 30px 0;">
         <a href="${feedbackLink}" style="background-color: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-family: sans-serif;">Share Your Feedback</a>
       </div>
       <p>If you cannot click the button above, copy and paste this link into your browser: <br/><a href="${feedbackLink}" style="color: #D4AF37;">${feedbackLink}</a></p>
       <p>We hope to welcome you back for another exceptional stay in the near future.</p>
       <p>Warmest regards,<br/>The Front Desk Team<br/>The Page Hotel</p>`,
    ),
    text: `Hope you enjoyed your stay at The Page Hotel! Dear ${name}, thank you for staying with us in Chamber ${roomNumber}. Please share your feedback on your stay: ${feedbackLink}`,
  };
}
