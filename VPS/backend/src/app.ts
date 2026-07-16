/**
 * Express application factory.
 * Keeping this separate from server.ts makes the app testable with Supertest.
 */
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// ── Phase 2B route imports ────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import siteRoutes from './routes/sites.routes';
import gatewayRoutes from './routes/gateways.routes';
import deviceRoutes from './routes/devices.routes';
import alarmRoutes from './routes/alarms.routes';
import telemetryRoutes from './routes/telemetry.routes';
import reportRoutes from './routes/reports.routes';
import userRoutes from './routes/users.routes';
import maintenanceRoutes from './routes/maintenance.routes';
// ── Phase 2C route imports ────────────────────────────────────────────────────
import fireguardDeviceRoutes from './routes/device.routes';

export function createApp(): Express {
  const app = express();

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Gateway-Id', 'X-Gateway-Token'],
    })
  );

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response): void => {
    res.json({
      ok: true,
      service: 'fireguard-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  // ── Phase 2B REST routes ───────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/sites', siteRoutes);
  app.use('/api/gateways', gatewayRoutes);
  // Device routes are nested: /api/gateways/:gatewayId/devices
  app.use('/api/gateways/:gatewayId/devices', deviceRoutes);
  app.use('/api/alarms', alarmRoutes);
  app.use('/api/telemetry', telemetryRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/maintenance', maintenanceRoutes);

  // Phase 2C: device HTTP contract (gateway device auth)
  app.use('/api/fireguard', fireguardDeviceRoutes);

  // ── Central error handler (MUST be last) ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
