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
import { Gateway } from '../models/Gateway';
import logger from '../config/logger';

export const registerDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { gatewayId, token, hw, fw } = req.body as {
    gatewayId?: string;
    token?: string;
    hw?: string;
    fw?: string;
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
    if (fw) gateway.fw = fw;
    await gateway.save();
    logger.info({ gatewayId, hw, fw }, 'Device registered (token stored)');
  }

  res.json({ ok: true, gatewayId: gateway.gatewayId, registered: true });
});
