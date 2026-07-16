/**
 * MQTT client config — reads broker credentials from env.
 * Exported singleton used by mqttClient.ts and deviceCommand.service.ts.
 */
import { z } from 'zod';

const MqttConfigSchema = z.object({
  MQTT_BROKER_URL: z.string().url().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().default('fireguard-backend'),
  OTA_STORAGE_DIR: z.string().default('./ota-storage'),
  SOCKET_CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

type MqttConfig = z.infer<typeof MqttConfigSchema>;

function loadMqttConfig(): MqttConfig {
  const result = MqttConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`MQTT config validation failed: ${result.error.message}`);
  }
  return result.data;
}

export const mqttConfig = loadMqttConfig();
