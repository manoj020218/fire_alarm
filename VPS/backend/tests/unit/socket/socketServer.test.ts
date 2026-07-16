/**
 * Unit tests for Socket.IO emit helpers.
 * Verifies that broadcast helpers call io.to(room).emit(event, data) correctly.
 * Uses jest module mocking to inject a fake io instance.
 */

describe('socketServer emit helpers', () => {
  let mockEmit: jest.Mock;
  let mockTo: jest.Mock;
  let mockUse: jest.Mock;
  let mockOn: jest.Mock;

  beforeEach(() => {
    mockEmit = jest.fn();
    mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
    mockUse = jest.fn();
    mockOn = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
  });

  function buildMockIo() {
    return {
      use: mockUse,
      on: mockOn,
      to: mockTo,
      close: jest.fn((cb: () => void) => cb()),
    };
  }

  it('emitTelemetry sends to site:{siteId} room with "telemetry" event', () => {
    const mockIo = buildMockIo();
    // Manually set up the internal io reference via the module's own API
    jest.doMock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => mockIo),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initSocketServer, emitTelemetry } = require('../../../src/socket/socketServer') as typeof import('../../../src/socket/socketServer');

    const fakeServer = {} as import('http').Server;
    initSocketServer(fakeServer);

    const data = { gatewayId: 'GW1', siteId: 'SITE001' };
    emitTelemetry('SITE001', data);

    expect(mockTo).toHaveBeenCalledWith('site:SITE001');
    expect(mockEmit).toHaveBeenCalledWith('telemetry', data);
  });

  it('emitAlarm sends to site:{siteId} room with "alarm" event', () => {
    const mockIo = buildMockIo();
    jest.doMock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => mockIo),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initSocketServer, emitAlarm } = require('../../../src/socket/socketServer') as typeof import('../../../src/socket/socketServer');

    const fakeServer = {} as import('http').Server;
    initSocketServer(fakeServer);

    const data = { alarmId: 'ALM-001', siteId: 'SITE001' };
    emitAlarm('SITE001', data);

    expect(mockTo).toHaveBeenCalledWith('site:SITE001');
    expect(mockEmit).toHaveBeenCalledWith('alarm', data);
  });

  it('emitGatewayStatus sends to site:{siteId} room with "gateway-status" event', () => {
    const mockIo = buildMockIo();
    jest.doMock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => mockIo),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initSocketServer, emitGatewayStatus } = require('../../../src/socket/socketServer') as typeof import('../../../src/socket/socketServer');

    const fakeServer = {} as import('http').Server;
    initSocketServer(fakeServer);

    const data = { gatewayId: 'GW1', online: false };
    emitGatewayStatus('SITE001', data);

    expect(mockTo).toHaveBeenCalledWith('site:SITE001');
    expect(mockEmit).toHaveBeenCalledWith('gateway-status', data);
  });

  it('emit helpers are no-ops before initSocketServer is called (no throw)', () => {
    jest.doMock('socket.io', () => ({
      Server: jest.fn(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { emitTelemetry, emitAlarm, emitGatewayStatus } = require('../../../src/socket/socketServer') as typeof import('../../../src/socket/socketServer');

    expect(() => emitTelemetry('SITE001', {})).not.toThrow();
    expect(() => emitAlarm('SITE001', {})).not.toThrow();
    expect(() => emitGatewayStatus('SITE001', {})).not.toThrow();
  });

  it('initSocketServer is idempotent — returns same io on second call', () => {
    let callCount = 0;
    const mockIo = buildMockIo();
    jest.doMock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => {
        callCount++;
        return mockIo;
      }),
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initSocketServer, getIo } = require('../../../src/socket/socketServer') as typeof import('../../../src/socket/socketServer');

    const fakeServer = {} as import('http').Server;
    initSocketServer(fakeServer);
    initSocketServer(fakeServer); // second call should be no-op

    expect(callCount).toBe(1);
    expect(getIo()).not.toBeNull();
  });
});
