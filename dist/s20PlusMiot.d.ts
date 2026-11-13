import type { RoborockState } from './roborockClient';
export declare const S20_PLUS_MODEL = "xiaomi.vacuum.b108gl";
interface MiotDevice {
    call(method: string, params: unknown[] | Record<string, unknown>): Promise<unknown>;
}
export declare class S20PlusMiot {
    private readonly device;
    constructor(device: MiotDevice);
    getState(): Promise<RoborockState>;
    startCleaning(): Promise<void>;
    pauseCleaning(): Promise<void>;
    resumeCleaning(): Promise<void>;
    returnToDock(): Promise<void>;
    findRobot(): Promise<void>;
    setFanSpeed(speed: 25 | 50 | 75 | 100): Promise<void>;
    private action;
}
export {};
//# sourceMappingURL=s20PlusMiot.d.ts.map