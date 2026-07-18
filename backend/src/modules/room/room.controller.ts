import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '@/constants';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created, noContent } from '@/utils/apiResponse';
import { auditFromRequest } from '@/services/audit.service';
import {
  buildScanUrl,
  renderQrDataUrl,
  renderQrPng,
  renderQrSvg,
} from '@/services/qr.service';
import * as service from './room.service';

function actor(req: Request) {
  return { actor: req.auth!.userId, role: req.auth!.role };
}

export const create = asyncHandler(async (req: Request, res) => {
  const room = await service.createRoom(req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ROOM_CREATED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
    metadata: { roomNumber: room.roomNumber, floor: room.floor },
  });
  return created(res, { room });
});

export const list = asyncHandler(async (req: Request, res) => {
  const { items, meta } = await service.listRooms(req.query as never);
  return ok(res, { rooms: items }, 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res) => {
  const room = await service.getRoom(req.params.id);
  return ok(res, { room });
});

export const update = asyncHandler(async (req: Request, res) => {
  const room = await service.updateRoom(req.params.id, req.body);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ROOM_UPDATED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
  });
  return ok(res, { room });
});

export const remove = asyncHandler(async (req: Request, res) => {
  const room = await service.deleteRoom(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ROOM_DELETED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
    metadata: { roomNumber: room.roomNumber },
  });
  return noContent(res);
});

export const activate = asyncHandler(async (req: Request, res) => {
  const room = await service.setRoomActive(req.params.id, true);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ROOM_ACTIVATED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
  });
  return ok(res, { room });
});

export const deactivate = asyncHandler(async (req: Request, res) => {
  const room = await service.setRoomActive(req.params.id, false);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.ROOM_DEACTIVATED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
  });
  return ok(res, { room });
});

export const generateQr = asyncHandler(async (req: Request, res) => {
  const room = await service.regenerateQr(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.QR_GENERATED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
    metadata: { version: room.qr.version },
  });
  const dataUrl = await renderQrDataUrl(room.qr.token);
  return ok(res, {
    room,
    qr: { token: room.qr.token, scanUrl: buildScanUrl(room.qr.token), dataUrl },
  });
});

/**
 * Stream the room's QR as a downloadable image. `?format=png|svg|dataurl`.
 * PNG/SVG set Content-Disposition so browsers download a printable file.
 */
export const downloadQr = asyncHandler(async (req: Request, res: Response) => {
  const room = await service.getRoom(req.params.id);
  const token = room.qr.token;
  const format = (req.query.format as string) ?? 'png';
  const size = req.query.size ? Number(req.query.size) : undefined;
  const filename = `room-${room.roomNumber}-qr`;

  if (format === 'svg') {
    const svg = await renderQrSvg(token);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.svg"`);
    res.send(svg);
    return;
  }
  if (format === 'dataurl') {
    const dataUrl = await renderQrDataUrl(token, { size });
    ok(res, { dataUrl, scanUrl: buildScanUrl(token) });
    return;
  }
  const png = await renderQrPng(token, { size });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.png"`);
  res.send(png);
});

export const disableQr = asyncHandler(async (req: Request, res) => {
  const room = await service.disableQr(req.params.id);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.QR_DISABLED,
    ...actor(req),
    target: `room:${room._id.toString()}`,
  });
  return ok(res, { room });
});

export const reassignQr = asyncHandler(async (req: Request, res) => {
  const { source, target } = await service.reassignQr(req.params.id, req.body.targetRoomId);
  void auditFromRequest(req, {
    action: AUDIT_ACTIONS.QR_REASSIGNED,
    ...actor(req),
    target: `room:${source._id.toString()}`,
    metadata: { swappedWith: target._id.toString() },
  });
  return ok(res, { source, target });
});

/** Public: resolve a scanned QR token to a room + serving kitchen. */
export const resolve = asyncHandler(async (req: Request, res) => {
  const data = await service.resolveScan(req.params.token);
  return ok(res, data);
});
