/**
 * Unit tests — deviceCommand.service (Phase 2B stubs).
 */
import {
  publishGatewayConfig,
  publishGatewayCommand,
  type GatewayConfigPayload,
  type GatewayCommandPayload,
} from '../../../src/services/deviceCommand.service';

describe('publishGatewayConfig (2B stub)', () => {
  it('does not throw when called with valid args', () => {
    const config: GatewayConfigPayload = {
      thresholds: {
        sprinklerPressure: { low: 2.0, high: 10.0 },
      },
      pollIntervalSec: 30,
    };
    expect(() => publishGatewayConfig('JNX-FG-AB12', 'SITE001', config)).not.toThrow();
  });

  it('accepts empty config object', () => {
    expect(() => publishGatewayConfig('GW1', 'SITE1', {})).not.toThrow();
  });
});

describe('publishGatewayCommand (2B stub)', () => {
  it('does not throw for reboot command', () => {
    const cmd: GatewayCommandPayload = {
      command: 'reboot',
      issuedAt: new Date().toISOString(),
    };
    expect(() => publishGatewayCommand('JNX-FG-AB12', 'SITE001', cmd)).not.toThrow();
  });

  it('does not throw for sync_time command with params', () => {
    const cmd: GatewayCommandPayload = {
      command: 'sync_time',
      params: { epoch: 1720080000 },
      issuedAt: new Date().toISOString(),
    };
    expect(() => publishGatewayCommand('GW1', 'SITE1', cmd)).not.toThrow();
  });
});
