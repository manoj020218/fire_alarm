/**
 * Gateways controller — list, get, update, config get/put, command, token rotate.
 */
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Gateway, type IGatewayDocument } from '../models/Gateway';
import { DeviceConfig } from '../models/DeviceConfig';
import { writeAudit } from '../services/audit.service';
import { publishGatewayConfig, publishGatewayCommand } from '../services/deviceCommand.service';
import { scopeFilter, canAccessSite } from '../utils/scope';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { GatewayConfigBody, GatewayCommandBody } from '../validation/gateways.schema';

// ── GET /api/gateways ─────────────────────────────────────────────────────────

export const listGateways = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const filter = scopeFilter<IGatewayDocument>(req.user);
  const gateways = await Gateway.find(filter).sort({ name: 1 });
  res.json({ ok: true, gateways });
});

// ── GET /api/gateways/:id ─────────────────────────────────────────────────────

export const getGateway = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };

  const gateway = await Gateway.findOne({ gatewayId: id });
  if (!gateway) throw AppError.notFound('Gateway');
  if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

  res.json({ ok: true, gateway });
});

// ── PUT /api/gateways/:id ─────────────────────────────────────────────────────

export const updateGateway = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };

  const before = await Gateway.findOne({ gatewayId: id });
  if (!before) throw AppError.notFound('Gateway');
  if (!canAccessSite(req.user, before.siteId)) throw AppError.forbidden();

  const gateway = await Gateway.findOneAndUpdate(
    { gatewayId: id },
    { $set: req.body as object },
    { new: true }
  );

  await writeAudit({
    action: 'UPDATE',
    entity: 'Gateway',
    entityId: id,
    before: before.toObject(),
    after: gateway?.toObject(),
    req,
  });

  res.json({ ok: true, gateway });
});

// ── GET /api/gateways/:id/config ──────────────────────────────────────────────

export const getGatewayConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };

  const gateway = await Gateway.findOne({ gatewayId: id });
  if (!gateway) throw AppError.notFound('Gateway');
  if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

  const configs = await DeviceConfig.find({ gatewayId: id });
  res.json({ ok: true, gatewayId: id, configs });
});

// ── PUT /api/gateways/:id/config ──────────────────────────────────────────────

export const putGatewayConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw AppError.unauthorized();
  const { id } = req.params as { id: string };
  const body = req.body as GatewayConfigBody;

  const gateway = await Gateway.findOne({ gatewayId: id });
  if (!gateway) throw AppError.notFound('Gateway');
  if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

  // Store desired config in DB (as DeviceConfig entries per threshold key)
  const upsertResults: object[] = [];
  if (body.thresholds) {
    for (const [deviceId, thresholds] of Object.entries(body.thresholds)) {
      const config = await DeviceConfig.findOneAndUpdate(
        { deviceId, gatewayId: id },
        {
          $set: {
            thresholds,
            siteId: gateway.siteId,
            pushedAt: new Date(),
            pushedBy: req.user.sub,
          },
          $inc: { version: 1 },
        },
        { upsert: true, new: true }
      );
      if (config !== null) upsertResults.push(config.toObject());
    }
  }

  // Publish config intent (stub in 2B; 2C wires MQTT)
  publishGatewayConfig(id, gateway.siteId, body);

  await writeAudit({
    action: 'CONFIG_CHANGE',
    entity: 'Gateway',
    entityId: id,
    after: body,
    req,
  });

  res.json({ ok: true, gatewayId: id, configs: upsertResults });
});

// ── POST /api/gateways/:id/command ───────────────────────────────────────────

export const sendGatewayCommand = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params as { id: string };
    const body = req.body as GatewayCommandBody;

    const gateway = await Gateway.findOne({ gatewayId: id });
    if (!gateway) throw AppError.notFound('Gateway');
    if (!canAccessSite(req.user, gateway.siteId)) throw AppError.forbidden();

    const cmd = { ...body, issuedAt: new Date().toISOString() };

    // Publish command intent (stub in 2B; 2C wires MQTT)
    publishGatewayCommand(id, gateway.siteId, cmd);

    await writeAudit({
      action: 'CONFIG_CHANGE',
      entity: 'Gateway',
      entityId: id,
      after: cmd,
      req,
    });

    res.json({ ok: true, gatewayId: id, command: cmd });
  }
);

// ── POST /api/gateways/:id/token ─────────────────────────────────────────────

export const rotateDeviceToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { id } = req.params as { id: string };

    const gateway = await Gateway.findOne({ gatewayId: id }).select('+deviceToken');
    if (!gateway) throw AppError.notFound('Gateway');

    const newToken = randomUUID().replace(/-/g, '');
    await Gateway.findOneAndUpdate({ gatewayId: id }, { $set: { deviceToken: newToken } });

    await writeAudit({
      action: 'DEVICE_TOKEN_ROTATE',
      entity: 'Gateway',
      entityId: id,
      req,
    });

    res.json({ ok: true, gatewayId: id, deviceToken: newToken });
  }
);
