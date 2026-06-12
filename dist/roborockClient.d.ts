import { Logger } from 'homebridge';
export type RoborockStatus = 'cleaning' | 'returning' | 'docked' | 'paused' | 'idle' | 'error';
export interface RoborockState {
    status: RoborockStatus;
    batteryLevel: number;
    fanSpeed: number;
    errorCode: number;
    cleanArea: number;
    cleanTime: number;
}
export declare class RoborockClient {
    private readonly ip;
    private readonly token;
    private readonly log;
    private device;
    constructor(ip: string, token: string, log: Logger);
    connect(): Promise<void>;
    isConnected(): boolean;
    getState(): Promise<RoborockState>;
    startCleaning(): Promise<void>;
    pauseCleaning(): Promise<void>;
    returnToDock(): Promise<void>;
    setFanSpeed(speedPercent: number): Promise<void>;
    findRobot(): Promise<void>;
    private assertConnected;
    destroy(): void;
}
//# sourceMappingURL=roborockClient.d.ts.map