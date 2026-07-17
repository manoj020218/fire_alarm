/**
 * Server entry point — connect DB, start HTTP + Socket.IO + MQTT + offline detector.
 * Keep this thin; all app logic lives in app.ts and services.
 */
import http from 'http';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import logger from './config/logger';
import { initSocketServer, closeSocketServer } from './socket/socketServer';
import { initMqtt, closeMqtt } from './mqtt/mqttClient';
import { startOfflineDetector, stopOfflineDetector } from './services/offlineDetector';
import { startUsageReporter, stopUsageReporter } from './services/usageReporter';

async function boot(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Attach Socket.IO to the HTTP server
  initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'FireGuard backend listening');
  });

  // Start MQTT ingestion (no-op if MQTT_BROKER_URL not set)
  initMqtt();

  // Start gateway offline detector
  startOfflineDetector();

  // Start billing usage reporter (fires once ~60s after boot, then daily)
  startUsageReporter();

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    stopOfflineDetector();
    stopUsageReporter();

    await closeMqtt();

    await closeSocketServer();

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await disconnectDB();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection — shutting down');
    void shutdown('unhandledRejection');
  });
}

void boot();
