/**
 * Device self-registration — PUBLIC (no device auth; this is what establishes it).
 *
 * The gateway generates its own device token locally on first boot and has no way
 * to learn a backend-provisioned one. Without this handshake, every device-authed
 * call (notably the mandatory pre-OTA /backup) is rejected as "Unknown gateway",
 * which hard-blocks OTA. On boot (after uplink) the firmware POSTs its
 * gatewayId + token here so the backend stores the pair.
 *
 *   POST /api/fireguard/register  { gatewayId, token, hw?, fw? }
 *
 * Trust model (TOFU): accept when the gateway is provisioned (exists in the pool)
 * AND is either still in the pool (claimed=false), has no token yet, or the token
 * already matches (idempotent). A gateway already claimed to a customer with a
 * DIFFERENT token is rejected 403 — it must be token-rotated by an admin.
 * TODO(hardening): gate with a per-batch provisioning secret.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Gateway, ISimInfo } from '../models/Gateway';
import logger from '../config/logger';

export const registerDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { gatewayId, token, hw, fw, factoryGatewayId, esp32Mac, apSsid, modemImei, iccid, imsi } =
    req.body as {
      gatewayId?: string;
      token?: string;
      hw?: string;
      fw?: string;
      factoryGatewayId?: string;
      esp32Mac?: string;
      apSsid?: string;
      modemImei?: string;
      iccid?: string;
      imsi?: string;
    };

  if (!gatewayId || !token || token.length < 16) {
    throw AppError.badRequest('gatewayId and a valid token are required');
  }

  const gateway = await Gateway.findOne({ gatewayId: gatewayId.toUpperCase() }).select(
    '+deviceToken'
  );
  if (!gateway) {
    // Not provisioned — do not auto-create; provisioning is an admin action.
    throw AppError.notFound('Gateway not provisioned');
  }

  // claimed defaults to true; pool (unbound) gateways are explicitly false.
  const isClaimed = gateway.claimed === true;
  const tokenMatches = gateway.deviceToken === token;
  const hasNoToken = !gateway.deviceToken;

  if (isClaimed && !tokenMatches && !hasNoToken) {
    logger.warn({ gatewayId }, 'register: claimed gateway sent a different token — rejected');
    throw AppError.forbidden('Gateway already registered with a different token');
  }

  if (!tokenMatches) {
    gateway.deviceToken = token;
  }
  if (fw) gateway.fw = fw;
  if (hw) gateway.hw = hw;

  // ── Hardware-identity TOFU + mismatch detection ────────────────────────────
  // esp32Mac (and its derived factoryGatewayId) is the strongest identity: bind
  // it on first sight. A later register presenting a DIFFERENT bound identity is
  // flagged (identityMismatch) for admin review — a possible hardware swap or
  // token reuse — rather than silently rebinding. Modem/SIM/AP details are
  // mutable (swappable), so those are refreshed to the latest reported values.
  const incomingMac = esp32Mac ? esp32Mac.toUpperCase() : undefined;
  const incomingFactoryId = factoryGatewayId ? factoryGatewayId.toUpperCase() : undefined;

  if (incomingMac && !gateway.esp32Mac) gateway.esp32Mac = incomingMac;
  if (incomingFactoryId && !gateway.factoryGatewayId) gateway.factoryGatewayId = incomingFactoryId;

  const mismatch =
    (!!gateway.esp32Mac && !!incomingMac && gateway.esp32Mac !== incomingMac) ||
    (!!gateway.factoryGatewayId &&
      !!incomingFactoryId &&
      gateway.factoryGatewayId !== incomingFactoryId);

  gateway.identityMismatch = mismatch;
  gateway.identityLastVerifiedAt = new Date();
  if (mismatch) {
    logger.warn(
      { gatewayId, boundMac: gateway.esp32Mac, presentedMac: incomingMac },
      'register: HARDWARE IDENTITY MISMATCH — flagged for review'
    );
  }

  // Informational / mutable identity fields — refresh to the latest reported.
  if (apSsid) gateway.apSsid = apSsid;
  if (modemImei) gateway.modemImei = modemImei;
  if (iccid || imsi) {
    const sim: ISimInfo = gateway.sim ?? {};
    if (iccid) sim.iccid = iccid;
    if (imsi) sim.imsi = imsi;
    gateway.sim = sim;
  }

  await gateway.save();
  logger.info({ gatewayId, hw, fw, identityMismatch: mismatch }, 'Device registered');

  res.json({
    ok: true,
    gatewayId: gateway.gatewayId,
    registered: true,
    identityMismatch: mismatch,
  });
});
