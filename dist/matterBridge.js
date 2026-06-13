"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatterVacuumBridge = void 0;
const settings_1 = require("./settings");
// ── Run mode constants (must match supportedModes indices) ───────────────────
const RUN_MODE_IDLE = 0;
const RUN_MODE_CLEANING = 1;
// ── Clean mode constants ─────────────────────────────────────────────────────
const CLEAN_MODE_QUIET = 0;
const CLEAN_MODE_BALANCED = 1;
const CLEAN_MODE_TURBO = 2;
const CLEAN_MODE_MAX = 3;
// ── Matter RVC mode tags ────────────────────────────────────────────────────
// Apple Home displays these semantic tags as mode names. The Roborock fan
// levels therefore appear as Quiet, Vacuum, Deep Clean, and Max.
const MODE_TAG_QUIET = 0x0002;
const MODE_TAG_MAX = 0x0007;
const MODE_TAG_DEEP_CLEAN = 0x4000;
const MODE_TAG_VACUUM = 0x4001;
// ── RvcOperationalState values (from Matter spec / matter.js) ────────────────
// These numeric values are stable across matter.js versions.
const OP_STATE_STOPPED = 0x00;
const OP_STATE_RUNNING = 0x01;
const OP_STATE_PAUSED = 0x02;
const OP_STATE_ERROR = 0x03;
const OP_STATE_SEEKING_CHARGER = 0x40; // RVC-specific
const OP_STATE_CHARGING = 0x41; // RVC-specific
const OP_STATE_DOCKED = 0x42; // RVC-specific
// ── Matter RVC operational error states ─────────────────────────────────────
const OP_ERROR_NONE = 0x00;
const OP_ERROR_UNABLE_TO_COMPLETE = 0x02;
// ── Fan speed % → clean mode index ──────────────────────────────────────────
function fanSpeedToCleanMode(speedPercent) {
    if (speedPercent <= 25)
        return CLEAN_MODE_QUIET;
    if (speedPercent <= 50)
        return CLEAN_MODE_BALANCED;
    if (speedPercent <= 75)
        return CLEAN_MODE_TURBO;
    return CLEAN_MODE_MAX;
}
// ── Clean mode index → fan speed % ──────────────────────────────────────────
const CLEAN_MODE_TO_SPEED = {
    [CLEAN_MODE_QUIET]: 25,
    [CLEAN_MODE_BALANCED]: 50,
    [CLEAN_MODE_TURBO]: 75,
    [CLEAN_MODE_MAX]: 100,
};
// ── Roborock status → Matter operational state ───────────────────────────────
const STATUS_TO_OP_STATE = {
    cleaning: OP_STATE_RUNNING,
    returning: OP_STATE_SEEKING_CHARGER,
    docked: OP_STATE_DOCKED,
    paused: OP_STATE_PAUSED,
    idle: OP_STATE_STOPPED,
    error: OP_STATE_ERROR,
};
const OPERATIONAL_STATE_LIST = [
    { operationalStateId: OP_STATE_STOPPED },
    { operationalStateId: OP_STATE_RUNNING },
    { operationalStateId: OP_STATE_PAUSED },
    { operationalStateId: OP_STATE_ERROR },
    { operationalStateId: OP_STATE_SEEKING_CHARGER },
    { operationalStateId: OP_STATE_CHARGING },
    { operationalStateId: OP_STATE_DOCKED },
];
function roborockErrorToMatterError(errorCode) {
    if (errorCode === 0) {
        return { errorStateId: OP_ERROR_NONE };
    }
    return {
        errorStateId: OP_ERROR_UNABLE_TO_COMPLETE,
        errorStateLabel: 'Roborock Error',
        errorStateDetails: `Roborock error code ${errorCode}`,
    };
}
function normalizeModel(model) {
    const trimmed = model.trim();
    return (trimmed || 'Roborock').slice(0, 32);
}
class MatterVacuumBridge {
    constructor(config, client, api, log, cachedAccessories) {
        this.config = config;
        this.client = client;
        this.api = api;
        this.log = log;
        this.cachedAccessories = cachedAccessories;
        /** UUID of the registered Matter accessory — stored so we can push updates */
        this.uuid = null;
        this.accessory = null;
        this.lastStateSummary = null;
        this.model = 'Roborock';
    }
    /**
     * Register the device with Homebridge's Matter API.
     * Call this after api.matter is confirmed available.
     */
    async start() {
        const matter = this.api.matter; // safe: caller has gated on isMatterEnabled()
        const { name, ip } = this.config;
        this.uuid = matter.uuid.generate(`roborock-${ip}`);
        const cachedAccessory = this.cachedAccessories.get(this.uuid);
        if (cachedAccessory) {
            this.log.info(`[Matter] Reusing cached accessory for "${name}" (${this.uuid})`);
        }
        else {
            this.log.info(`[Matter] Creating new accessory for "${name}" (${this.uuid})`);
        }
        const accessory = {
            // ── Identity ───────────────────────────────────────────────────────────
            UUID: this.uuid,
            displayName: name,
            deviceType: matter.deviceTypes.RoboticVacuumCleaner,
            serialNumber: ip.replace(/\./g, ''),
            manufacturer: 'Xiaomi',
            model: this.model,
            firmwareRevision: settings_1.PLUGIN_VERSION,
            context: {
                ...(cachedAccessory?.context ?? {}),
                ip,
                name,
                model: this.model,
            },
            // ── Initial cluster state ──────────────────────────────────────────────
            // Homebridge persists and restores this after first creation.
            clusters: {
                rvcRunMode: {
                    supportedModes: [
                        {
                            label: 'Idle',
                            mode: RUN_MODE_IDLE,
                            modeTags: [{ value: 0x4000 }], // ModeTag.Idle
                        },
                        {
                            label: 'Cleaning',
                            mode: RUN_MODE_CLEANING,
                            modeTags: [{ value: 0x4001 }], // ModeTag.Cleaning
                        },
                    ],
                    currentMode: RUN_MODE_IDLE,
                },
                rvcCleanMode: {
                    supportedModes: [
                        {
                            label: 'Quiet',
                            mode: CLEAN_MODE_QUIET,
                            modeTags: [{ value: MODE_TAG_QUIET }],
                        },
                        {
                            label: 'Vacuum',
                            mode: CLEAN_MODE_BALANCED,
                            modeTags: [{ value: MODE_TAG_VACUUM }],
                        },
                        {
                            label: 'Deep Clean',
                            mode: CLEAN_MODE_TURBO,
                            modeTags: [{ value: MODE_TAG_DEEP_CLEAN }],
                        },
                        {
                            label: 'Max',
                            mode: CLEAN_MODE_MAX,
                            modeTags: [{ value: MODE_TAG_MAX }],
                        },
                    ],
                    currentMode: CLEAN_MODE_BALANCED,
                },
                rvcOperationalState: {
                    phaseList: null,
                    currentPhase: null,
                    operationalStateList: OPERATIONAL_STATE_LIST,
                    operationalState: OP_STATE_STOPPED,
                    operationalError: { errorStateId: OP_ERROR_NONE },
                },
                powerSource: {
                    batPercentRemaining: 200, // 0-200 = 0-100% in 0.5% steps
                    batChargeState: 0, // 0 = Unknown
                    status: 1, // 1 = Active
                },
            },
            // ── Command handlers ───────────────────────────────────────────────────
            // Homebridge calls these when a Matter controller sends a command.
            handlers: {
                rvcRunMode: {
                    changeToMode: async ({ newMode }) => {
                        try {
                            if (newMode === RUN_MODE_CLEANING) {
                                await this.client.startCleaning();
                                this.log.info(`[Matter] "${name}" → start cleaning`);
                            }
                            else {
                                await this.client.returnToDock();
                                this.log.info(`[Matter] "${name}" → return to dock`);
                            }
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" rvcRunMode changeToMode error: ${err}`);
                            throw err;
                        }
                    },
                },
                rvcCleanMode: {
                    changeToMode: async ({ newMode }) => {
                        const speed = CLEAN_MODE_TO_SPEED[newMode] ?? 50;
                        try {
                            await this.client.setFanSpeed(speed);
                            this.log.debug(`[Matter] "${name}" → fan speed ${speed}%`);
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" rvcCleanMode changeToMode error: ${err}`);
                            throw err;
                        }
                    },
                },
                rvcOperationalState: {
                    pause: async () => {
                        try {
                            await this.client.pauseCleaning();
                            this.log.info(`[Matter] "${name}" → pause`);
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" pause error: ${err}`);
                            throw err;
                        }
                    },
                    resume: async () => {
                        try {
                            await this.client.startCleaning();
                            this.log.info(`[Matter] "${name}" → resume`);
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" resume error: ${err}`);
                            throw err;
                        }
                    },
                    goHome: async () => {
                        try {
                            await this.client.returnToDock();
                            this.log.info(`[Matter] "${name}" → go home`);
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" goHome error: ${err}`);
                            throw err;
                        }
                    },
                },
            },
        };
        this.accessory = accessory;
        this.log.debug(`[Matter] Registering "${name}" with Homebridge Matter API as RoboticVacuumCleaner`);
        await matter.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
            accessory,
        ]);
        this.log.info(`[Matter] "${name}" registration request accepted by Homebridge Matter API.`);
    }
    async updateModel(model) {
        const normalizedModel = normalizeModel(model);
        if (normalizedModel === this.model) {
            return;
        }
        this.model = normalizedModel;
        if (!this.accessory) {
            return;
        }
        this.accessory.model = normalizedModel;
        this.accessory.context = {
            ...this.accessory.context,
            model: normalizedModel,
        };
        try {
            await this.api.matter?.updatePlatformAccessories([this.accessory]);
            this.log.info(`[Matter] "${this.config.name}" model updated from miio: ${normalizedModel}`);
        }
        catch (err) {
            this.log.warn(`[Matter] Failed to update model for "${this.config.name}": ${err}`);
        }
    }
    /**
     * Push the latest device state into the Matter clusters.
     * Call this from your poll loop whenever the Roborock state changes.
     */
    async updateState(state) {
        if (!this.uuid)
            return; // not registered yet
        const matter = this.api.matter;
        const stateSummary = `status=${state.status}, battery=${state.batteryLevel}%, fan=${state.fanSpeed}%, error=${state.errorCode}, cleanTime=${state.cleanTime}s, cleanArea=${state.cleanArea}`;
        try {
            await Promise.all([
                matter.updateAccessoryState(this.uuid, matter.clusterNames.RvcRunMode, {
                    currentMode: state.status === 'cleaning' ? RUN_MODE_CLEANING : RUN_MODE_IDLE,
                }),
                matter.updateAccessoryState(this.uuid, matter.clusterNames.RvcCleanMode, {
                    currentMode: fanSpeedToCleanMode(state.fanSpeed),
                }),
                matter.updateAccessoryState(this.uuid, matter.clusterNames.RvcOperationalState, {
                    operationalState: STATUS_TO_OP_STATE[state.status],
                    operationalError: roborockErrorToMatterError(state.errorCode),
                }),
                matter.updateAccessoryState(this.uuid, matter.clusterNames.PowerSource, {
                    batPercentRemaining: Math.max(0, Math.min(200, state.batteryLevel * 2)),
                    batChargeState: state.status === 'docked' ? 1 : 2, // 1=Charging, 2=NotCharging
                }),
            ]);
        }
        catch (err) {
            this.log.warn(`[Matter] Failed to update state for "${this.config.name}": ${err}`);
            throw err;
        }
        if (stateSummary !== this.lastStateSummary) {
            this.log.info(`[Matter] "${this.config.name}" state updated: ${stateSummary}`);
            this.lastStateSummary = stateSummary;
        }
        else {
            this.log.debug(`[Matter] "${this.config.name}" state unchanged`);
        }
    }
    /**
     * Stop runtime work owned by this bridge.
     *
     * Do not unregister here: unregistering would remove the Matter accessory and
     * its commissioning state from Homebridge's cache on every shutdown.
     */
    async stop() {
        this.uuid = null;
    }
    async unregister() {
        if (!this.uuid || !this.accessory)
            return;
        try {
            const matter = this.api.matter;
            await matter.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                this.accessory,
            ]);
            this.log.debug(`[Matter] "${this.config.name}" unregistered`);
        }
        catch (err) {
            this.log.warn(`[Matter] unregister failed for "${this.config.name}": ${err}`);
        }
        this.uuid = null;
        this.accessory = null;
    }
}
exports.MatterVacuumBridge = MatterVacuumBridge;
//# sourceMappingURL=matterBridge.js.map