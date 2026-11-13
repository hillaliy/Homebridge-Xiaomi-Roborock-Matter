import type { RoborockState, RoborockStatus } from './roborockClient';

export const S20_PLUS_MODEL = 'xiaomi.vacuum.b108gl';

interface MiotDevice {
  call(method: string, params: unknown[] | Record<string, unknown>): Promise<unknown>;
}

// Xiaomi MIoT spec: urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-b108gl:1
const STATUS = { siid: 2, piid: 1 };
const FAULT = { siid: 2, piid: 2 };
const AREA = { siid: 2, piid: 5 };
const TIME = { siid: 2, piid: 6 };
const SUCTION = { siid: 2, piid: 8 };
const BATTERY = { siid: 3, piid: 1 };

const STATUS_MAP: Partial<Record<number, RoborockStatus>> = {
  1: 'idle',
  2: 'docked',
  3: 'docked', // Charging before resuming an interrupted job
  4: 'cleaning',
  5: 'paused',
  6: 'returning',
  7: 'idle', // Remote control
  8: 'docked',
  9: 'idle', // Mapping
  10: 'idle', // Updating
};

function propertyKey({ siid, piid }: { siid: number; piid: number }): string {
  return `${siid}:${piid}`;
}

function requireSuccess(result: unknown, operation: string): void {
  if (!result || typeof result !== 'object' || !('code' in result)
    || typeof result.code !== 'number') {
    throw new Error(`S20+ MIoT ${operation}: invalid response`);
  }
  if (result.code !== 0) {
    throw new Error(`S20+ MIoT ${operation} rejected (code ${result.code})`);
  }
}

export class S20PlusMiot {
  constructor(private readonly device: MiotDevice) {}

  async getState(): Promise<RoborockState> {
    const result = await this.device.call('get_properties', [
      STATUS, BATTERY, FAULT, SUCTION, AREA, TIME,
    ].map(property => ({ ...property, did: propertyKey(property) })));
    if (!Array.isArray(result)) {
      throw new Error('S20+ MIoT get_properties: invalid response');
    }

    // Some firmware replies with the device ID rather than our request's did.
    const values = new Map<string, number>();
    for (const row of result) {
      if (row?.code === 0 && Number.isInteger(row.value) && row.value >= 0) {
        values.set(propertyKey(row), row.value);
      }
    }

    const state = values.get(propertyKey(STATUS));
    const status = state === undefined ? undefined : STATUS_MAP[state];
    const batteryLevel = values.get(propertyKey(BATTERY));
    const suction = values.get(propertyKey(SUCTION));
    const errorCode = values.get(propertyKey(FAULT));
    if (!status || batteryLevel === undefined || batteryLevel > 100
      || suction === undefined || suction < 1 || suction > 4 || errorCode === undefined) {
      throw new Error('S20+ MIoT get_properties: missing or invalid status, battery, suction or fault');
    }

    return {
      status: errorCode ? 'error' : status,
      batteryLevel,
      fanSpeed: suction * 25,
      errorCode,
      cleanArea: (values.get(propertyKey(AREA)) ?? 0) * 100,
      cleanTime: values.get(propertyKey(TIME)) ?? 0,
    };
  }

  startCleaning(): Promise<void> { return this.action(2, 1); }
  pauseCleaning(): Promise<void> { return this.action(2, 6); }
  resumeCleaning(): Promise<void> { return this.action(6, 1); }
  returnToDock(): Promise<void> { return this.action(3, 1); }
  findRobot(): Promise<void> { return this.action(6, 6); }

  async setFanSpeed(speed: 25 | 50 | 75 | 100): Promise<void> {
    const result = await this.device.call('set_properties', [
      { ...SUCTION, did: propertyKey(SUCTION), value: speed / 25 },
    ]);
    requireSuccess(Array.isArray(result) ? result[0] : undefined, 'set suction');
  }

  private async action(siid: number, aiid: number): Promise<void> {
    const result = await this.device.call('action', { did: `call-${siid}-${aiid}`, siid, aiid, in: [] });
    requireSuccess(result, `action ${siid}/${aiid}`);
  }
}
