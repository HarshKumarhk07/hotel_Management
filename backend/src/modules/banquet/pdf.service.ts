import PDFDocument from 'pdfkit';

export async function generateQuotationPdf(booking: any, stream: any): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(stream);

  // Border & Header
  doc.rect(40, 40, 515, 740).strokeColor('#D4AF37').lineWidth(1).stroke();

  doc.fontSize(20).fillColor('#111111').text('THE PAGE HOTEL', 60, 60);
  doc.fontSize(10).fillColor('#D4AF37').text('BANQUET HALL QUOTATION & BOOKING PROPOSAL', 60, 85).moveDown(2);

  // Proposal Meta
  doc.fontSize(10).fillColor('#666666').text('PROPOSAL PREPARED FOR', 60, 130);
  doc.fillColor('#111111');
  doc.text(`Guest Name: ${booking.guestName}`);
  doc.text(`Email: ${booking.email}`);
  doc.text(`Phone: ${booking.phone}`).moveDown(1.5);

  doc.fontSize(10).fillColor('#666666').text('EVENT INFORMATION', 60, 220);
  doc.fillColor('#111111');
  doc.text(`Venue / Hall: ${booking.hall?.name || 'Grand Ballroom'}`);
  doc.text(`Event Type: ${booking.eventType}`);
  doc.text(`Scheduled Date: ${new Date(booking.eventDate).toLocaleDateString('en-IN')}`);
  doc.text(`Timings: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`);
  doc.text(`Guaranteed Guest Count: ${booking.guestCount} Pax`).moveDown(1.5);

  // Pricing summary
  doc.fontSize(10).fillColor('#666666').text('COST ESTIMATION & TAX BREAKDOWN', 60, 340);
  doc.fillColor('#111111');

  const basePrice = booking.totalPrice / 1.18;
  const gstAmount = booking.totalPrice - basePrice;

  doc.text(`Base Venue Rental & preset food catering package: ₹${basePrice.toFixed(2)}`);
  doc.text(`Estimated SGST / CGST (18%): ₹${gstAmount.toFixed(2)}`);
  doc.lineWidth(1).strokeColor('#ECECEC').moveTo(60, doc.y + 5).lineTo(360, doc.y + 5).stroke();
  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#D4AF37').text(`Grand Quotation Total: ₹${booking.totalPrice.toFixed(2)}`).moveDown(2);

  // Signatures
  doc.fontSize(10).fillColor('#666666').text('TERMS & VALIDITY', 60, 520);
  doc.fontSize(8).fillColor('#999999').text(
    '1. This quotation is valid for 15 days from the prepared date.\n' +
    '2. 50% advance deposit required to confirm ballroom reservation.\n' +
    '3. Service charges are inclusive. Taxes are subject to standard government mandates.',
    60,
    540,
    { width: 475 }
  );

  doc.end();
}

export async function generateEstimationPdf(booking: any, stream: any): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 45 });
  doc.pipe(stream);

  // Header Letterhead
  doc.fontSize(18).fillColor('#111111').text('THE PAGE HOTEL', { align: 'center' });
  doc.fontSize(9).fillColor('#D4AF37').text('P R E M I U M   H O S P I T A L I T Y', { align: 'center' }).moveDown(3);

  // Date
  doc.fontSize(10).fillColor('#111111').text(`Date: ${new Date().toLocaleDateString('en-IN')}`).moveDown(1.5);

  // Recipient address
  doc.text('To,');
  doc.text(`${booking.guestName}`);
  doc.text(`${booking.email}`);
  doc.text(`${booking.phone}`).moveDown(2);

  // Subject line
  doc.fontSize(11).text('Subject: Proposal estimation letter for venue & catering reservation').moveDown(1.5);

  // Body text
  doc.fontSize(10).fillColor('#333333').text(
    `Dear ${booking.guestName},\n\n` +
    `Thank you for choosing The Page Hotel for hosting your upcoming ${booking.eventType}.\n\n` +
    `Our premium ${booking.hall?.name || 'Grand Ballroom'} has been tentatively blocked for your date: ${new Date(booking.eventDate).toLocaleDateString('en-IN')} between the hours of ${new Date(booking.startTime).toLocaleTimeString()} and ${new Date(booking.endTime).toLocaleTimeString()}.\n\n` +
    `Based on your expected guest count of ${booking.guestCount} guests, the comprehensive billing estimation amounts to ₹${booking.totalPrice.toFixed(2)} inclusive of all catering presets and service taxes.\n\n` +
    `Please find the itemized quotation attached. Let us know if you require any specific alterations to the menu layout or venue arrangement.\n\n` +
    `Warm regards,\n\n\n` +
    `Banquet Sales & Operations Coordinator\n` +
    `The Page Hotel`
  );

  doc.end();
}
