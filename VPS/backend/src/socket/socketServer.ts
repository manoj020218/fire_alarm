/**
 * Socket.IO server — attaches to the HTTP server.
 * JWT handshake authentication; clients join siteId rooms.
 * Emit helpers are called by MQTT handlers and device HTTP handlers.
 */
import { Server, type DefaultEventsMap } from 'socket.io';
import type http from 'http';
import { verifyToken, type TokenPayload } from '../services/auth.service';
import { canAccessSite } from '../utils/scope';
import { mqttConfig } from '../config/mqtt';
import logger from '../config/logger';

interface SocketData {
  user: TokenPayload;
}

type IoInstance = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

let io: IoInstance | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initSocketServer(server: http.Server): IoInstance {
  if (io !== null) return io;

  const ioInstance: IoInstance = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(server, {
    cors: {
      origin: mqttConfig.SOCKET_CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── JWT handshake authentication ──────────────────────────────────────────
  ioInstance.use((socket, next) => {
    const authObj = socket.handshake.auth as Record<string, unknown>;
    const authHeader = socket.handshake.headers['authorization'] as string | undefined;
    const token =
      (authObj['token'] as string | undefined) ??
      authHeader?.replace('Bearer ', '');

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyToken(token);
      if (payload.type !== 'access') {
        next(new Error('Token is not an access token'));
        return;
      }
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  ioInstance.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info({ userId: user.sub, role: user.role }, 'Socket.IO client connected');

    // Auto-join site rooms the user can access
    socket.on('join-site', (siteId: string) => {
      if (!canAccessSite(user, siteId)) {
        socket.emit('error', { message: `Access denied to site ${siteId}` });
        return;
      }
      void socket.join(`site:${siteId}`);
      logger.debug({ userId: user.sub, siteId }, 'Socket joined site room');
    });

    socket.on('leave-site', (siteId: string) => {
      void socket.leave(`site:${siteId}`);
    });

    socket.on('disconnect', (reason: string) => {
      logger.debug({ userId: user.sub, reason }, 'Socket.IO client disconnected');
    });
  });

  io = ioInstance;
  logger.info('Socket.IO server initialised');
  return ioInstance;
}

// ─── Emit helpers (called by MQTT handlers + device HTTP handlers) ─────────────

/** Broadcast telemetry to the site room. */
export function emitTelemetry(siteId: string, data: unknown): void {
  io?.to(`site:${siteId}`).emit('telemetry', data);
}

/** Broadcast an alarm event to the site room. */
export function emitAlarm(siteId: string, data: unknown): void {
  io?.to(`site:${siteId}`).emit('alarm', data);
}

/** Broadcast gateway status change to the site room. */
export function emitGatewayStatus(siteId: string, data: unknown): void {
  io?.to(`site:${siteId}`).emit('gateway-status', data);
}

/** Broadcast a SIM/cellular response to the site room. */
export function emitSim(siteId: string, data: unknown): void {
  io?.to(`site:${siteId}`).emit('sim', data);
}

/** Get the io instance (null before initSocketServer is called). */
export function getIo(): IoInstance | null {
  return io;
}

/** Close the Socket.IO server — call on graceful shutdown. */
export async function closeSocketServer(): Promise<void> {
  if (!io) return;
  return new Promise<void>((resolve) => {
    io?.close(() => {
      logger.info('Socket.IO server closed');
      io = null;
      resolve();
    });
  });
}
