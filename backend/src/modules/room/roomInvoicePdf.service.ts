import PDFDocument from 'pdfkit';

/** Renders the invoice to a Buffer (collect-then-send avoids streaming race conditions) */
export async function generateInvoicePdfBuffer(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Border & Header ─────────────────────────────────────────────────────
    doc.rect(40, 40, 515, 760).strokeColor('#ECECEC').lineWidth(1).stroke();

    doc.fontSize(18).fillColor('#111111').text('THE PAGE HOTEL', 60, 60);
    doc.fontSize(9).fillColor('#D4AF37').text('P R E M I U M   H O S P I T A L I T Y', 60, 80);
    doc.fontSize(8).fillColor('#666666').text('GSTIN: 27AAAAA1111A1Z1 | Support: +91 99999 99999', 60, 92).moveDown(2);

    // Invoice meta (top-right)
    doc.fontSize(12).fillColor('#111111').text('TAX INVOICE', 400, 60, { align: 'right' });
    doc
      .fontSize(8)
      .fillColor('#666666')
      .text(
        `Invoice #: INV-RM-${data.booking._id.toString().substring(18).toUpperCase()}`,
        400,
        75,
        { align: 'right' },
      );
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 400, 87, { align: 'right' });
    const checkOutDateStr = data.booking.checkOutDate
      ? new Date(data.booking.checkOutDate).toLocaleDateString('en-IN')
      : new Date().toLocaleDateString('en-IN');
    doc.text(
      `Stay Period: ${new Date(data.booking.checkInDate).toLocaleDateString('en-IN')} – ${checkOutDateStr}`,
      400,
      99,
      { align: 'right' },
    );

    // Divider
    doc.lineWidth(1).strokeColor('#D4AF37').moveTo(60, 120).lineTo(535, 120).stroke();

    // ── Billed To ───────────────────────────────────────────────────────────
    doc.fontSize(10).fillColor('#666666').text('BILLED TO:', 60, 135);
    doc.fontSize(10).fillColor('#111111').text(`Guest Name: ${data.booking.guestName}`, 60, 150);
    doc.text(`Phone: ${data.booking.phone}`, 60, 163);
    doc.text(`Email: ${data.booking.email}`, 60, 176);

    // Room details (top-right)
    doc.fontSize(10).fillColor('#666666').text('ROOM DETAILS:', 400, 135, { align: 'right' });
    doc
      .fontSize(10)
      .fillColor('#111111')
      .text(`Room Number: ${data.booking.room?.roomNumber || 'N/A'}`, 400, 150, { align: 'right' });
    doc.text(`Floor: ${data.booking.room?.floor || '0'}`, 400, 163, { align: 'right' });
    doc.text(`Nights Stayed: ${data.nights} Nights`, 400, 176, { align: 'right' });

    // ── Table ────────────────────────────────────────────────────────────────
    let y = 210;
    doc.rect(60, y, 475, 20).fill('#F5F5F5');
    doc.fontSize(9).fillColor('#111111').text('Description', 70, y + 6);
    doc.text('Qty / Nights', 250, y + 6);
    doc.text('Unit Price (Rs)', 330, y + 6);
    doc.text('Tax (Rs)', 410, y + 6);
    doc.text('Total (Rs)', 480, y + 6);
    y += 25;

    // 1. Room stay
    doc.fontSize(9).fillColor('#333333');
    doc.text(`Room Stay (Room ${data.booking.room?.roomNumber || 'N/A'})`, 70, y);
    doc.text(`${data.nights}`, 250, y);
    doc.text(`${(data.stayBasePrice / data.nights).toFixed(2)}`, 330, y);
    doc.text(`${data.stayGst.toFixed(2)}`, 410, y);
    doc.text(`${data.stayCost.toFixed(2)}`, 480, y);
    y += 20;

    // 2. Food orders
    if (data.orders && data.orders.length > 0) {
      doc.lineWidth(0.5).strokeColor('#ECECEC').moveTo(60, y).lineTo(535, y).stroke();
      y += 10;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('In-Room Dining Orders:', 70, y);
      doc.font('Helvetica');
      y += 15;
      for (const o of data.orders) {
        doc.fontSize(8).fillColor('#555555');
        doc.text(`Order #${o.orderNumber} (${o.paymentMethod})`, 70, y);
        doc.text('1', 250, y);
        doc.text(`${o.subtotal.toFixed(2)}`, 330, y);
        doc.text(`${o.tax.toFixed(2)}`, 410, y);
        doc.text(`${o.total.toFixed(2)}`, 480, y);
        y += 15;
      }
    }

    // 3. Banquet bookings
    if (data.banquets && data.banquets.length > 0) {
      doc.lineWidth(0.5).strokeColor('#ECECEC').moveTo(60, y).lineTo(535, y).stroke();
      y += 10;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('Banquet Event Bookings:', 70, y);
      doc.font('Helvetica');
      y += 15;
      for (const b of data.banquets) {
        doc.fontSize(8).fillColor('#555555');
        doc.text(`${b.hallName} – ${new Date(b.eventDate).toLocaleDateString('en-IN')}`, 70, y);
        doc.text('1', 250, y);
        doc.text(`${(b.totalPrice / 1.18).toFixed(2)}`, 330, y);
        doc.text(`${(b.totalPrice - b.totalPrice / 1.18).toFixed(2)}`, 410, y);
        doc.text(`${b.totalPrice.toFixed(2)}`, 480, y);
        y += 15;
      }
    }

    // 4. Valet
    if (data.valet && data.valet.length > 0) {
      doc.lineWidth(0.5).strokeColor('#ECECEC').moveTo(60, y).lineTo(535, y).stroke();
      y += 10;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('Complimentary Valet Services:', 70, y);
      doc.font('Helvetica');
      y += 15;
      for (const v of data.valet) {
        doc.fontSize(8).fillColor('#555555');
        doc.text(`${v.brand} ${v.model} (${v.carNumber})`, 70, y);
        doc.text('-', 250, y);
        doc.text('0.00', 330, y);
        doc.text('0.00', 410, y);
        doc.text('FREE', 480, y);
        y += 15;
      }
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    doc.lineWidth(1).strokeColor('#D4AF37').moveTo(60, y).lineTo(535, y).stroke();
    y += 15;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666').text('Billing Summary:', 60, y);
    y += 15;
    doc.font('Helvetica').fontSize(8).fillColor('#111111');
    doc.text(`Subtotal: Rs ${data.pricing.subtotal.toFixed(2)}`, 70, y);
    y += 12;
    doc.text(`Taxes (GST): Rs ${data.pricing.taxTotal.toFixed(2)}`, 70, y);
    if (data.pricing.serviceChargeTotal > 0) {
      y += 12;
      doc.text(`Service Charges: Rs ${data.pricing.serviceChargeTotal.toFixed(2)}`, 70, y);
    }

    y -= 24;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Grand Total: Rs ${data.pricing.grandTotal.toFixed(2)}`, 380, y, { align: 'right' });
    y += 15;
    doc.fillColor('#22C55E').text(`Already Paid: Rs ${data.pricing.alreadyPaidTotal.toFixed(2)}`, 380, y, { align: 'right' });
    y += 15;
    doc.fillColor('#EF4444').text(`Balance Due: Rs ${data.pricing.balanceDue.toFixed(2)}`, 380, y, { align: 'right' });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(8).fillColor('#999999').text(
      'Thank you for staying with us. We hope you had a pleasant experience.\n' +
        'This is a computer-generated GST invoice and does not require a physical signature.',
      60,
      740,
      { align: 'center', width: 475 },
    );

    doc.end();
  });
}

/** @deprecated Use generateInvoicePdfBuffer instead */
export async function generateInvoicePdf(data: any, stream: any): Promise<void> {
  const buf = await generateInvoicePdfBuffer(data);
  stream.end(buf);
}
