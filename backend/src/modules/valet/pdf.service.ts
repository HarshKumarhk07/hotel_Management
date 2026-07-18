import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import type { IVehicle } from '@/models/Vehicle';

export async function generateValetTicketPdf(vehicle: IVehicle, stream: any): Promise<void> {
  const doc = new PDFDocument({ size: [300, 500], margin: 20 });
  doc.pipe(stream);

  // Luxury border
  doc.rect(10, 10, 280, 480).strokeColor('#D4AF37').lineWidth(2).stroke();
  doc.rect(15, 15, 270, 470).strokeColor('#D4AF37').lineWidth(0.5).stroke();

  // Hotel Title
  doc.fontSize(16).fillColor('#111111').text('THE PAGE HOTEL', { align: 'center' });
  doc.fontSize(10).fillColor('#D4AF37').text('L U X U R Y   V A L E T', { align: 'center' }).moveDown(1.5);

  // Ticket details
  doc.fontSize(8).fillColor('#666666').text('CAR PLATE NUMBER', { align: 'center' });
  doc.fontSize(14).fillColor('#111111').text(vehicle.carNumber.toUpperCase(), { align: 'center' }).moveDown(0.8);

  doc.fontSize(8).fillColor('#666666').text('VEHICLE DETAILS', { align: 'center' });
  doc.fontSize(10).fillColor('#111111').text(`${vehicle.brand} ${vehicle.model} (${vehicle.color})`, { align: 'center' }).moveDown(0.8);

  doc.fontSize(8).fillColor('#666666').text('KEY TAG NUMBER', { align: 'center' });
  doc.fontSize(12).fillColor('#D4AF37').text(`#${vehicle.keyTag}`, { align: 'center' }).moveDown(0.8);

  doc.fontSize(8).fillColor('#666666').text('CHECKED IN AT', { align: 'center' });
  doc.fontSize(9).fillColor('#111111').text(new Date(vehicle.checkedInAt).toLocaleString(), { align: 'center' }).moveDown(1.5);

  // Generate QR Code for live tracking session
  try {
    const liveUrl = `http://localhost:3000/valet/session/${vehicle.secureToken}`;
    const qrDataUrl = await QRCode.toDataURL(liveUrl);
    doc.image(qrDataUrl, 90, 270, { width: 120 });
  } catch (err) {
    // If QR fails, omit
  }

  // Footer instructions (use doc.y to place text instead of 'at' parameter)
  doc.y = 420;
  doc.fontSize(8).fillColor('#666666').text('Scan QR to request vehicle retrieval', { align: 'center' });
  doc.y = 440;
  doc.fontSize(7).fillColor('#999999').text('Please keep this ticket secure.', { align: 'center' });

  doc.end();
}

export async function generateValetReceiptPdf(vehicle: IVehicle, stream: any): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(stream);

  // Brand Header
  doc.rect(40, 40, 515, 740).strokeColor('#D4AF37').lineWidth(1).stroke();

  doc.fontSize(20).fillColor('#111111').text('THE PAGE HOTEL', 60, 60, { align: 'left' });
  doc.fontSize(10).fillColor('#D4AF37').text('VALET SERVICE RECEIPT', 60, 85, { align: 'left' }).moveDown(2);

  // Receipt meta info
  doc.fontSize(10).fillColor('#666666').text('GUEST DETAILS', 60, 130);
  doc.fillColor('#111111');
  doc.text(`Name: ${vehicle.guestInfo.name}`);
  doc.text(`Room: ${vehicle.guestInfo.roomNumber}`);
  doc.text(`Phone: ${vehicle.guestInfo.phone}`);
  doc.text(`Email: ${vehicle.guestInfo.email}`).moveDown(1.5);

  doc.fontSize(10).fillColor('#666666').text('VEHICLE DETAILS', 60, 220);
  doc.fillColor('#111111');
  doc.text(`Plate: ${vehicle.carNumber.toUpperCase()}`);
  doc.text(`Brand / Model: ${vehicle.brand} ${vehicle.model}`);
  doc.text(`Color: ${vehicle.color}`);
  doc.text(`Parking Slot: ${vehicle.parkingSlot}`).moveDown(1.5);

  doc.fontSize(10).fillColor('#666666').text('VALET TIMELINE', 60, 310);
  doc.fillColor('#111111');
  doc.text(`Checked-In: ${new Date(vehicle.checkedInAt).toLocaleString()}`);
  doc.text(`Requested At: ${vehicle.requestedAt ? new Date(vehicle.requestedAt).toLocaleString() : 'N/A'}`);
  doc.text(`Delivered At: ${vehicle.deliveredAt ? new Date(vehicle.deliveredAt).toLocaleString() : 'N/A'}`);

  // Duration
  let durationText = 'Active / Parked';
  if (vehicle.deliveredAt) {
    const hours = Math.ceil(
      (new Date(vehicle.deliveredAt).getTime() - new Date(vehicle.checkedInAt).getTime()) / (1000 * 60 * 60)
    );
    durationText = `${hours} Hours`;
  }
  doc.text(`Total Parked Duration: ${durationText}`).moveDown(2);

  // Standard terms
  doc.fontSize(8).fillColor('#999999').text(
    'Complimentary service for registered hotel guests. We are not liable for items left inside vehicles.',
    60,
    720,
    { width: 475, align: 'center' }
  );

  doc.end();
}

export async function generateValetExcelReport(vehicles: IVehicle[], date: string, stream: any): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Valet Daily Report');

  // Put report metadata at the top
  sheet.addRow([`Daily Valet Report - ${date}`]);
  sheet.addRow([]);

  sheet.columns = [
    { header: 'Car Number', key: 'carNumber', width: 15 },
    { header: 'Brand', key: 'brand', width: 12 },
    { header: 'Model', key: 'model', width: 12 },
    { header: 'Color', key: 'color', width: 10 },
    { header: 'Parking Slot', key: 'parkingSlot', width: 12 },
    { header: 'Guest Name', key: 'guestName', width: 20 },
    { header: 'Room Number', key: 'roomNumber', width: 12 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Checked In At', key: 'checkedInAt', width: 22 },
    { header: 'Requested At', key: 'requestedAt', width: 22 },
    { header: 'Delivered At', key: 'deliveredAt', width: 22 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  // Formatting header row (row 3 due to metadata rows)
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1C1C1C' },
  };

  vehicles.forEach((vehicle) => {
    sheet.addRow({
      carNumber: vehicle.carNumber.toUpperCase(),
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      parkingSlot: vehicle.parkingSlot,
      guestName: vehicle.guestInfo.name,
      roomNumber: vehicle.guestInfo.roomNumber,
      phone: vehicle.guestInfo.phone,
      checkedInAt: new Date(vehicle.checkedInAt).toLocaleString(),
      requestedAt: vehicle.requestedAt ? new Date(vehicle.requestedAt).toLocaleString() : '',
      deliveredAt: vehicle.deliveredAt ? new Date(vehicle.deliveredAt).toLocaleString() : '',
      status: vehicle.status,
    });
  });

  await workbook.xlsx.write(stream);
}

export async function generateValetPdfReport(vehicles: IVehicle[], date: string, stream: any): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  doc.pipe(stream);

  // Header Title
  doc.fontSize(16).fillColor('#111111').text('THE PAGE HOTEL - DAILY VALET ACTIVITY REPORT', { align: 'center' });
  doc.fontSize(10).fillColor('#D4AF37').text(`DATE: ${date}`, { align: 'center' }).moveDown(2);

  // Draw Table headers
  const headers = ['Car Plate', 'Brand/Model', 'Guest Name', 'Room', 'Slot', 'Checked In', 'Delivered', 'Status'];
  const xPositions = [40, 110, 220, 340, 390, 440, 560, 680];

  doc.fontSize(9).fillColor('#666666');
  headers.forEach((h, idx) => {
    doc.text(h, xPositions[idx], doc.y, { width: idx === 1 || idx === 2 ? 100 : 80 });
  });

  doc.moveDown(0.5);
  doc.lineWidth(1).strokeColor('#ECECEC').moveTo(30, doc.y).lineTo(790, doc.y).stroke();
  doc.moveDown(0.8);

  doc.fontSize(8).fillColor('#111111');
  vehicles.forEach((v) => {
    const y = doc.y;
    doc.text(v.carNumber.toUpperCase(), xPositions[0], y);
    doc.text(`${v.brand} ${v.model}`, xPositions[1], y, { width: 100 });
    doc.text(v.guestInfo.name, xPositions[2], y, { width: 110 });
    doc.text(v.guestInfo.roomNumber, xPositions[3], y);
    doc.text(v.parkingSlot, xPositions[4], y);
    doc.text(new Date(v.checkedInAt).toLocaleTimeString(), xPositions[5], y);
    doc.text(v.deliveredAt ? new Date(v.deliveredAt).toLocaleTimeString() : '-', xPositions[6], y);
    doc.text(v.status, xPositions[7], y);
    doc.moveDown(1.5);
  });

  doc.end();
}
