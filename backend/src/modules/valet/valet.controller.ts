import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import * as valetService from './valet.service';
import { Vehicle } from '@/models';
import * as pdfService from './pdf.service';
import type { ValetStatus } from '@/models';
import { checkInVehicleSchema } from './valet.validation';
import { ZodError } from 'zod';

export const resolveRoom = asyncHandler(async (req: Request, res: Response) => {
  const result = await valetService.resolveRoomGuest(req.params.token);
  return ok(res, result);
});

export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  // Photos are optional

  // Parse details from JSON in req.body.data if passed as stringified JSON, or extract directly
  let inputData = req.body;
  if (typeof req.body.data === 'string') {
    try {
      inputData = JSON.parse(req.body.data);
    } catch {
      throw AppError.badRequest('Invalid body data structure', 'INVALID_BODY');
    }
  }

  // Validate with Zod schema
  try {
    inputData = checkInVehicleSchema.parse(inputData);
  } catch (err) {
    if (err instanceof ZodError) {
      throw AppError.badRequest('Validation failed', 'VALIDATION_ERROR', err.flatten().fieldErrors);
    }
    throw err;
  }

  const frontFile = files?.front?.[0];
  const rearFile = files?.rear?.[0];
  const leftFile = files?.left?.[0];
  const rightFile = files?.right?.[0];
  const dashboardFile = files?.dashboard?.[0];
  const damageFiles = files?.damage || [];

  const vehicle = await valetService.checkInVehicle(
    req.auth!.userId,
    inputData,
    {
      front: frontFile ? { buffer: frontFile.buffer, mimetype: frontFile.mimetype } : undefined,
      rear: rearFile ? { buffer: rearFile.buffer, mimetype: rearFile.mimetype } : undefined,
      left: leftFile ? { buffer: leftFile.buffer, mimetype: leftFile.mimetype } : undefined,
      right: rightFile ? { buffer: rightFile.buffer, mimetype: rightFile.mimetype } : undefined,
      dashboard: dashboardFile ? { buffer: dashboardFile.buffer, mimetype: dashboardFile.mimetype } : undefined,
      damage: damageFiles.map(f => ({ buffer: f.buffer, mimetype: f.mimetype }))
    }
  );

  return created(res, vehicle);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await valetService.updateValetStatus(
    req.auth!.userId,
    req.auth!.role,
    req.params.id,
    req.body.status as ValetStatus,
    req.body.notes
  );
  return ok(res, vehicle);
});

export const requestByGuest = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await valetService.requestVehicleByGuest(
    req.params.carNumber,
    req.body.notes
  );
  return ok(res, vehicle);
});

export const getDetails = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await valetService.getVehicleDetails(req.params.carNumber);
  return ok(res, vehicle);
});

export const getDetailsByToken = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await valetService.getVehicleDetailsByToken(req.params.token);
  return ok(res, vehicle);
});

export const requestByToken = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await valetService.requestVehicleByToken(
    req.params.token,
    req.body.notes
  );
  return ok(res, vehicle);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const activeOnly = req.query.activeOnly === 'true';
  const status = req.query.status ? (req.query.status as ValetStatus) : undefined;
  const search = req.query.search ? (req.query.search as string) : undefined;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const result = await valetService.listVehicles({ page, limit, status, search, activeOnly });
  return ok(res, result);
});

export const overview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await valetService.getValetOverview();
  return ok(res, data);
});

export const slots = asyncHandler(async (_req: Request, res: Response) => {
  const data = await valetService.listParkingSlots();
  return ok(res, data);
});

export const createSlot = asyncHandler(async (req: Request, res: Response) => {
  const data = await valetService.createParkingSlot(req.body, req.auth!.userId);
  return created(res, data);
});

export const deleteSlot = asyncHandler(async (req: Request, res: Response) => {
  const data = await valetService.deleteParkingSlot(req.params.id, req.auth!.userId);
  return ok(res, data);
});

export const listValetManagers = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const search = req.query.search as string | undefined;
  const status = req.query.status as 'online' | 'offline' | undefined;
  const activeState = req.query.activeState as 'active' | 'disabled' | undefined;

  const result = await valetService.listValetManagers({ page, limit, search, status, activeState });
  return ok(res, result);
});

export const createValetManager = asyncHandler(async (req: Request, res: Response) => {
  const user = await valetService.createValetManager(req.body, req.auth!.userId);
  return ok(res, user);
});

export const updateValetManager = asyncHandler(async (req: Request, res: Response) => {
  const user = await valetService.updateValetManager(req.params.id, req.body, req.auth!.userId);
  return ok(res, user);
});

export const resetValetPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await valetService.resetValetPassword(req.params.id, req.auth!.userId);
  return ok(res, user);
});

export const getValetAdminStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await valetService.getValetAdminStats();
  return ok(res, data);
});

export const getRecentValetActivity = asyncHandler(async (_req: Request, res: Response) => {
  const data = await valetService.getRecentValetActivity();
  return ok(res, data);
});

// PDF & Report Exports
export const downloadTicket = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw AppError.notFound('Vehicle not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=valet-ticket-${vehicle.carNumber}.pdf`);

  await pdfService.generateValetTicketPdf(vehicle, res);
});

export const downloadReceipt = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw AppError.notFound('Vehicle not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=valet-receipt-${vehicle.carNumber}.pdf`);

  await pdfService.generateValetReceiptPdf(vehicle, res);
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const format = (req.query.format as string) || 'pdf';

  // Query vehicles for this date
  const startOfDay = new Date(dateStr);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateStr);
  endOfDay.setHours(23, 59, 59, 999);

  const vehicles = await Vehicle.find({
    checkedInAt: { $gte: startOfDay, $lte: endOfDay },
  });

  if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=valet-report-${dateStr}.xlsx`);
    await pdfService.generateValetExcelReport(vehicles, dateStr, res);
  } else {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=valet-report-${dateStr}.pdf`);
    await pdfService.generateValetPdfReport(vehicles, dateStr, res);
  }
});
