"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S20PlusMiot = exports.S20_PLUS_MODEL = void 0;
exports.S20_PLUS_MODEL = 'xiaomi.vacuum.b108gl';
// Xiaomi MIoT spec: urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-b108gl:1
const STATUS = { siid: 2, piid: 1 };
const FAULT = { siid: 2, piid: 2 };
const AREA = { siid: 2, piid: 5 };
const TIME = { siid: 2, piid: 6 };
const SUCTION = { siid: 2, piid: 8 };
const BATTERY = { siid: 3, piid: 1 };
const STATUS_MAP = {
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
function propertyKey({ siid, piid }) {
    return `${siid}:${piid}`;
}
function requireSuccess(result, operation) {
    if (!result || typeof result !== 'object' || !('code' in result)
        || typeof result.code !== 'number') {
        throw new Error(`S20+ MIoT ${operation}: invalid response`);
    }
    if (result.code !== 0) {
        throw new Error(`S20+ MIoT ${operation} rejected (code ${result.code})`);
    }
}
class S20PlusMiot {
    constructor(device) {
        this.device = device;
    }
    async getState() {
        const result = await this.device.call('get_properties', [
            STATUS, BATTERY, FAULT, SUCTION, AREA, TIME,
        ].map(property => ({ ...property, did: propertyKey(property) })));
        if (!Array.isArray(result)) {
            throw new Error('S20+ MIoT get_properties: invalid response');
        }
        // Some firmware replies with the device ID rather than our request's did.
        const values = new Map();
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
    startCleaning() { return this.action(2, 1); }
    pauseCleaning() { return this.action(2, 6); }
    resumeCleaning() { return this.action(6, 1); }
    returnToDock() { return this.action(3, 1); }
    findRobot() { return this.action(6, 6); }
    async setFanSpeed(speed) {
        const result = await this.device.call('set_properties', [
            { ...SUCTION, did: propertyKey(SUCTION), value: speed / 25 },
        ]);
        requireSuccess(Array.isArray(result) ? result[0] : undefined, 'set suction');
    }
    async action(siid, aiid) {
        const result = await this.device.call('action', { did: `call-${siid}-${aiid}`, siid, aiid, in: [] });
        requireSuccess(result, `action ${siid}/${aiid}`);
    }
}
exports.S20PlusMiot = S20PlusMiot;
//# sourceMappingURL=s20PlusMiot.js.map