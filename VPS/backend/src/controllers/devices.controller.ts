/**
 * Devices controller — CRUD for RS485 device register-map entries under a gateway.
 */
import type { Request, Response } from 'express';
import { Device } from '../models/Device';
import { Gateway } from '../models/Gateway';
import { writeAudit } from '../services/audit.service';
import { canAccessSite } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { CreateDeviceBody, UpdateDeviceBody } from '../validation/devices.schema';

async function resolveGateway(gatewayId: string, caller: NonNullable<Request['user']>) {
  const gw = await Gateway.findOne({ gatewayId });
  if (!gw) throw AppError.notFound('Gateway');
  if (!canAccessSite(caller, gw.siteId)) throw AppError.forbidden();
  return gw;
}

// ── GET /api/gateways/:gatewayId/devices ──────────────────────────────────────

export const listDevices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { gatewayId } = req.params as { gatewayId: string };

  await resolveGateway(gatewayId, req.user);

  const devices = await Device.find({ gatewayId, active: true }).sort({ deviceId: 1 });
  res.json({ ok: true, devices });
});

// ── GET /api/gateways/:gatewayId/devices/:deviceId ────────────────────────────

export const getDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { gatewayId, deviceId } = req.params as { gatewayId: string; deviceId: string };

  await resolveGateway(gatewayId, req.user);

  const device = await Device.findOne({ gatewayId, deviceId });
  if (!device) throw AppError.notFound('Device');

  res.json({ ok: true, device });
});

// ── POST /api/gateways/:gatewayId/devices ─────────────────────────────────────

export const createDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { gatewayId } = req.params as { gatewayId: string };
  const body = req.body as CreateDeviceBody;

  const gw = await resolveGateway(gatewayId, req.user);

  const device = await Device.create({ ...body, gatewayId, siteId: gw.siteId });

  await writeAudit({
    action: 'CREATE',
    entity: 'Device',
    entityId: device.deviceId,
    after: device.toObject(),
    req,
  });

  res.status(201).json({ ok: true, device });
});

// ── PUT /api/gateways/:gatewayId/devices/:deviceId ────────────────────────────

export const updateDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { gatewayId, deviceId } = req.params as { gatewayId: string; deviceId: string };
  const body = req.body as UpdateDeviceBody;

  await resolveGateway(gatewayId, req.user);

  const before = await Device.findOne({ gatewayId, deviceId });
  if (!before) throw AppError.notFound('Device');

  const device = await Device.findOneAndUpdate(
    { gatewayId, deviceId },
    { $set: body },
    { new: true }
  );

  await writeAudit({
    action: 'UPDATE',
    entity: 'Device',
    entityId: deviceId,
    before: before.toObject(),
    after: device?.toObject(),
    req,
  });

  res.json({ ok: true, device });
});

// ── DELETE /api/gateways/:gatewayId/devices/:deviceId (soft) ─────────────────

export const deleteDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { gatewayId, deviceId } = req.params as { gatewayId: string; deviceId: string };

  await resolveGateway(gatewayId, req.user);

  const device = await Device.findOne({ gatewayId, deviceId });
  if (!device) throw AppError.notFound('Device');

  await Device.findOneAndUpdate({ gatewayId, deviceId }, { $set: { active: false } });

  await writeAudit({
    action: 'DELETE',
    entity: 'Device',
    entityId: deviceId,
    before: device.toObject(),
    req,
  });

  res.json({ ok: true, message: 'Device deactivated' });
});
