import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, MatterAccessory } from 'homebridge';
export declare class RoborockMatterPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    private readonly devices;
    private readonly matterAccessories;
    constructor(log: Logger, config: PlatformConfig, api: API);
    configureAccessory(_accessory: PlatformAccessory): void;
    configureMatterAccessory(accessory: MatterAccessory): void;
    private discoverDevices;
    private startDevice;
    private discoverRooms;
    private mergeRooms;
    private createPollTimer;
    private teardown;
}
//# sourceMappingURL=platform.d.ts.map