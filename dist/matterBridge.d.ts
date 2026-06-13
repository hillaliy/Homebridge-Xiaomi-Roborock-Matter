/**
 * matterBridge.ts
 *
 * Registers each Roborock device as a Matter RoboticVacuumCleaner accessory
 * using the Homebridge 2.0 built-in api.matter API.
 *
 * NO @project-chip/matter-node.js dependency needed —
 * Homebridge 2.0 bundles matter.js internally and exposes it via api.matter.
 *
 * Clusters used:
 *  - rvcRunMode        → Idle / Cleaning run modes
 *  - rvcCleanMode      → Fan speed / cleaning intensity
 *  - rvcOperationalState → Running, Paused, Docked, Charging, Error + commands
 *  - powerSource       → Battery level + charge state
 */
import type { API, Logger, MatterAccessory } from 'homebridge';
import type { RoborockClient, RoborockState } from './roborockClient';
import type { RoborockDeviceConfig } from './settings';
export declare class MatterVacuumBridge {
    private readonly config;
    private readonly client;
    private readonly api;
    private readonly log;
    private readonly cachedAccessories;
    /** UUID of the registered Matter accessory — stored so we can push updates */
    private uuid;
    private accessory;
    private lastStateSummary;
    private model;
    constructor(config: RoborockDeviceConfig, client: RoborockClient, api: API, log: Logger, cachedAccessories: Map<string, MatterAccessory>);
    /**
     * Register the device with Homebridge's Matter API.
     * Call this after api.matter is confirmed available.
     */
    start(): Promise<void>;
    private refreshMatterMetadata;
    updateModel(model: string): Promise<void>;
    /**
     * Push the latest device state into the Matter clusters.
     * Call this from your poll loop whenever the Roborock state changes.
     */
    updateState(state: RoborockState): Promise<void>;
    /**
     * Stop runtime work owned by this bridge.
     *
     * Do not unregister here: unregistering would remove the Matter accessory and
     * its commissioning state from Homebridge's cache on every shutdown.
     */
    stop(): Promise<void>;
    unregister(): Promise<void>;
}
//# sourceMappingURL=matterBridge.d.ts.map