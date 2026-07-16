/**
 * Zod schemas for device routes.
 */
import { z } from 'zod';

const DEVICE_TYPES = [
  'pump', 'pressure_sensor', 'level_sensor', 'voltage_sensor',
  'fire_panel', 'pa_system', 'ventilation', 'valve',
  'digital_input', 'digital_output',
] as const;

const ModbusConfigSchema = z.object({
  slaveId: z.number().int().min(1).max(247),
  fc: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  regAddr: z.number().int().min(0).max(65535),
  scale: z.number().default(1),
  unit: z.string().min(1),
});

export const CreateDeviceSchema = z.object({
  deviceId: z.string().min(1).max(80),
  type: z.enum(DEVICE_TYPES),
  label: z.string().min(1).max(80),
  unit: z.string().max(20).optional(),
  modbus: ModbusConfigSchema.optional(),
});

export const UpdateDeviceSchema = CreateDeviceSchema.partial();

export const DeviceParamsSchema = z.object({
  gatewayId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const GatewayDevicesParamsSchema = z.object({
  gatewayId: z.string().min(1),
});

export type CreateDeviceBody = z.infer<typeof CreateDeviceSchema>;
export type UpdateDeviceBody = z.infer<typeof UpdateDeviceSchema>;
