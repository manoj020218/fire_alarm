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
import type {
  GatewayConfigBody,
  GatewayCommandBody,
  ClaimGatewayBody,
  PoolGatewayBody,
} from '../validation/gateways.schema';

/** Generate a short, human-friendly, unambiguous claim code (no 0/O/1/I). */
function generateClaimCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

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

// ── POST /api/gateways/claim ─────────────────────────────────────────────────
// A customer binds a pre-provisioned pool gateway to their own site using the
// gatewayId + claim code printed on the unit. CLIENT_ADMIN+ only.

export const claimGateway = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { gatewayId, claimCode, name, siteId } = req.body as ClaimGatewayBody;

    // Resolve target site: explicit (must be accessible) or the caller's first site.
    const targetSite = siteId ?? req.user.siteIds[0];
    if (!targetSite) throw AppError.badRequest('No site to attach this gateway to.');
    if (!canAccessSite(req.user, targetSite)) throw AppError.forbidden();

    const gateway = await Gateway.findOne({ gatewayId: gatewayId.toUpperCase() }).select(
      '+claimCode'
    );
    if (!gateway) throw AppError.notFound('Gateway');

    if (gateway.claimed) {
      throw AppError.conflict('This gateway is already registered to an account.');
    }
    if (!gateway.claimCode || gateway.claimCode !== claimCode.toUpperCase()) {
      throw AppError.badRequest('Invalid claim code for this gateway.');
    }

    gateway.siteId = targetSite;
    gateway.claimed = true;
    gateway.claimCode = undefined;
    if (name) gateway.name = name;
    await gateway.save();

    await writeAudit({
      action: 'GATEWAY_CLAIM',
      entity: 'Gateway',
      entityId: gateway.gatewayId,
      req,
    });

    const obj = gateway.toObject() as unknown as Record<string, unknown>;
    delete obj.claimCode;
    delete obj.deviceToken;
    res.status(201).json({ ok: true, gateway: obj });
  }
);

// ── POST /api/gateways/pool ──────────────────────────────────────────────────
// Super-admin pre-provisions a gateway into the claimable pool. Returns the
// claimCode + deviceToken ONCE (to print on the box / flash to the device).

export const createPoolGateway = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw AppError.unauthorized();
    const { gatewayId, name } = req.body as PoolGatewayBody;

    const gwId = gatewayId.toUpperCase();
    const existing = await Gateway.findOne({ gatewayId: gwId });
    if (existing) throw AppError.conflict('A gateway with this ID already exists.');

    const claimCode = generateClaimCode();
    const deviceToken = randomUUID().replace(/-/g, '');

    await Gateway.create({
      gatewayId: gwId,
      siteId: 'POOL',
      name: name ?? `Gateway ${gwId}`,
      deviceToken,
      claimCode,
      claimed: false,
    });

    await writeAudit({
      action: 'GATEWAY_POOL_CREATE',
      entity: 'Gateway',
      entityId: gwId,
      req,
    });

    res.status(201).json({ ok: true, gatewayId: gwId, claimCode, deviceToken });
  }
);
