/**
 * Audit service — write-only; creates an immutable AuditLog entry.
 * Call on every write action (CREATE, UPDATE, DELETE, ACK, etc.).
 */
import { AuditLog, type AuditAction } from '../models/AuditLog';
import type { Request } from 'express';
import logger from '../config/logger';

export interface AuditParams {
  action: AuditAction;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  req?: Request;
  actorOverride?: string;
  actorEmailOverride?: string;
}

/**
 * Creates an audit log entry. Never throws — logs on failure instead.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  const { action, entity, entityId, before, after, req, actorOverride, actorEmailOverride } =
    params;

  const actor = actorOverride ?? req?.user?.sub ?? 'SYSTEM';
  const actorEmail = actorEmailOverride ?? req?.user?.email;
  const ip = req?.ip ?? req?.socket?.remoteAddress;

  try {
    await AuditLog.create({
      actor,
      ...(actorEmail !== undefined && { actorEmail }),
      action,
      entity,
      ...(entityId !== undefined && { entityId }),
      ...(before !== undefined && { before }),
      ...(after !== undefined && { after }),
      ...(ip !== undefined && { ip }),
      ts: new Date(),
    });
  } catch (err) {
    // Audit failures must not abort the primary operation
    logger.error({ err, action, entity, entityId }, 'Failed to write audit log');
  }
}
