/**
 * Device command service — Phase 2C: real MQTT publishes.
 *
 * publishGatewayConfig  → fireguard/{siteId}/{gatewayId}/config/set
 * publishGatewayCommand → fireguard/{siteId}/{gatewayId}/command
 *
 * Safe when MQTT is not connected: mqttPublish logs + mqtt.js queues for reconnect.
 */
import logger from '../config/logger';
import { mqttPublish } from '../mqtt/mqttClient';

export interface GatewayConfigPayload {
  thresholds?: Record<string, {
    low?: number;
    high?: number;
    lowCritical?: number;
    highCritical?: number;
  }>;
  pollIntervalSec?: number;
  customSettings?: Record<string, unknown>;
}

export interface GatewayCommandPayload {
  command:
    | 'reboot'
    | 'sync_time'
    | 'force_mqtt_reconnect'
    | 'test_alarm'
    | 'sim_info'
    | 'read_sms'
    | 'ussd'
    | 'test_sms';
  params?: Record<string, unknown>;
  issuedAt: string;
}

/**
 * Publish gateway config to device.
 * Topic: fireguard/{siteId}/{gatewayId}/config/set
 */
export function publishGatewayConfig(
  gatewayId: string,
  siteId: string,
  config: GatewayConfigPayload
): void {
  const topic = `fireguard/${siteId}/${gatewayId}/config/set`;
  logger.info({ gatewayId, siteId, topic }, 'Publishing gateway config');
  mqttPublish(topic, JSON.stringify(config), 1);
}

/**
 * Publish a command to device.
 * Topic: fireguard/{siteId}/{gatewayId}/command
 */
export function publishGatewayCommand(
  gatewayId: string,
  siteId: string,
  cmd: GatewayCommandPayload
): void {
  const topic = `fireguard/${siteId}/${gatewayId}/command`;
  logger.info({ gatewayId, siteId, cmd, topic }, 'Publishing gateway command');
  mqttPublish(topic, JSON.stringify(cmd), 1);
}
