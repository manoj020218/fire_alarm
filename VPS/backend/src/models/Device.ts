/**
 * Device model — an RS485 Modbus device attached to a gateway.
 * modbus field describes how to read it from the register map.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type DeviceType =
  | 'pump'
  | 'pressure_sensor'
  | 'level_sensor'
  | 'voltage_sensor'
  | 'fire_panel'
  | 'pa_system'
  | 'ventilation'
  | 'valve'
  | 'digital_input'
  | 'digital_output';

export interface IModbusConfig {
  slaveId: number;
  fc: number;          // Function code: 1,2,3,4
  regAddr: number;     // Register address (decimal)
  scale: number;       // Multiply raw value by this
  unit: string;        // e.g. 'bar', '%', 'V'
}

export interface IDevice {
  deviceId: string;
  gatewayId: string;
  siteId: string;
  type: DeviceType;
  label: string;
  unit?: string;
  active: boolean;
  modbus?: IModbusConfig;
}

export interface IDeviceDocument extends IDevice, Document {}

const ModbusConfigSchema = new Schema<IModbusConfig>(
  {
    slaveId: { type: Number, required: true, min: 1, max: 247 },
    fc: { type: Number, required: true, enum: [1, 2, 3, 4] },
    regAddr: { type: Number, required: true, min: 0, max: 65535 },
    scale: { type: Number, required: true, default: 1 },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const DeviceSchema = new Schema<IDeviceDocument>(
  {
    deviceId: {
      type: String,
      required: [true, 'deviceId is required'],
      trim: true,
    },
    gatewayId: {
      type: String,
      required: [true, 'gatewayId is required'],
    },
    siteId: {
      type: String,
      required: [true, 'siteId is required'],
    },
    type: {
      type: String,
      enum: [
        'pump', 'pressure_sensor', 'level_sensor', 'voltage_sensor',
        'fire_panel', 'pa_system', 'ventilation', 'valve',
        'digital_input', 'digital_output',
      ],
      required: [true, 'Device type is required'],
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
      maxlength: 80,
    },
    unit: { type: String, trim: true },
    active: { type: Boolean, default: true },
    modbus: { type: ModbusConfigSchema },
  },
  {
    timestamps: true,
    collection: 'devices',
  }
);

DeviceSchema.index({ deviceId: 1, gatewayId: 1 }, { unique: true });
DeviceSchema.index({ siteId: 1 });
DeviceSchema.index({ gatewayId: 1 });
DeviceSchema.index({ active: 1 });

export const Device: Model<IDeviceDocument> = mongoose.model<IDeviceDocument>('Device', DeviceSchema);
