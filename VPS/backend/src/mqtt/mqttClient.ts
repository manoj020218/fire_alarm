/**
 * MQTT client singleton — connects to broker on init, auto-reconnects.
 * Never crashes on bad broker: all errors are logged and handled.
 * Import `getMqttClient()` for publish. Call `initMqtt()` at boot.
 */
import mqtt, { type MqttClient } from 'mqtt';
import { mqttConfig } from '../config/mqtt';
import logger from '../config/logger';
import { handleMqttMessage } from './mqttHandlers';

let client: MqttClient | null = null;

/** Initialise the MQTT connection. Idempotent — subsequent calls are no-ops. */
export function initMqtt(): void {
  if (client !== null) return;
  const { MQTT_BROKER_URL, MQTT_USERNAME, MQTT_PASSWORD, MQTT_CLIENT_ID } = mqttConfig;

  if (!MQTT_BROKER_URL) {
    logger.warn('MQTT_BROKER_URL not set — MQTT ingestion disabled');
    return;
  }

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: MQTT_CLIENT_ID,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    reconnectPeriod: 5_000,
    connectTimeout: 10_000,
    keepalive: 60,
  });

  client.on('connect', () => {
    logger.info({ broker: MQTT_BROKER_URL, clientId: MQTT_CLIENT_ID }, 'MQTT connected');
    client?.subscribe('fireguard/#', { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err }, 'MQTT subscribe error');
      } else {
        logger.info('Subscribed to fireguard/#');
      }
    });
  });

  client.on('message', (topic: string, payload: Buffer) => {
    void handleMqttMessage(topic, payload);
  });

  client.on('reconnect', () => {
    logger.warn({ broker: MQTT_BROKER_URL }, 'MQTT reconnecting…');
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  client.on('error', (err: Error) => {
    logger.error({ err }, 'MQTT client error');
    // Do NOT re-throw — let the reconnect loop handle it
  });
}

/** Returns the MQTT client if connected; null otherwise. */
export function getMqttClient(): MqttClient | null {
  return client;
}

/**
 * Publish a message to the broker.
 * Safe to call even when the client is not connected: logs a warning and returns.
 */
export function mqttPublish(topic: string, payload: string, qos: 0 | 1 | 2 = 1): void {
  if (!client || !client.connected) {
    logger.warn({ topic }, 'MQTT not connected — message queued by mqtt.js reconnect');
    if (client) {
      // mqtt.js buffers messages and flushes on reconnect (queueQoSZero default)
      client.publish(topic, payload, { qos });
    }
    return;
  }
  client.publish(topic, payload, { qos }, (err) => {
    if (err) logger.error({ err, topic }, 'MQTT publish error');
  });
}

/** Gracefully close the MQTT connection (call on SIGTERM). */
export async function closeMqtt(): Promise<void> {
  if (!client) return;
  return new Promise<void>((resolve) => {
    client?.end(false, {}, () => {
      logger.info('MQTT connection closed');
      client = null;
      resolve();
    });
  });
}
