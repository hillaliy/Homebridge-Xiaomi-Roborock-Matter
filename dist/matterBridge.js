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
// Apple Home uses the semantic tags as the visible mode names. Keep the
// required Vacuum tag on every mode, then add semantic tags for fan levels.
const MODE_TAG_QUIET = 0x0002;
const MODE_TAG_MAX = 0x0007;
const MODE_TAG_DEEP_CLEAN = 0x4000;
const MODE_TAG_VACUUM = 0x4001;
const SUPPORTED_RUN_MODES = [
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
];
const SUPPORTED_CLEAN_MODES = [
    {
        label: 'Quiet',
        mode: CLEAN_MODE_QUIET,
        modeTags: [{ value: MODE_TAG_VACUUM }, { value: MODE_TAG_QUIET }],
    },
    {
        label: 'Balanced',
        mode: CLEAN_MODE_BALANCED,
        modeTags: [{ value: MODE_TAG_VACUUM }],
    },
    {
        label: 'Turbo',
        mode: CLEAN_MODE_TURBO,
        modeTags: [
            { value: MODE_TAG_VACUUM },
            { value: MODE_TAG_DEEP_CLEAN },
        ],
    },
    {
        label: 'Max',
        mode: CLEAN_MODE_MAX,
        modeTags: [{ value: MODE_TAG_VACUUM }, { value: MODE_TAG_MAX }],
    },
];
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
// ── Matter PowerSource values ───────────────────────────────────────────────
const BATTERY_CHARGE_STATE_UNKNOWN = 0;
const BATTERY_CHARGE_STATE_CHARGING = 1;
const BATTERY_CHARGE_STATE_FULL = 2;
const BATTERY_CHARGE_STATE_NOT_CHARGING = 3;
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
    paused: OP_STATE_PAUSED,
    idle: OP_STATE_STOPPED,
    error: OP_STATE_ERROR,
};
function operationalStateFor(state) {
    if (state.status === 'docked') {
        return state.batteryLevel >= 100 ? OP_STATE_DOCKED : OP_STATE_CHARGING;
    }
    return STATUS_TO_OP_STATE[state.status];
}
const OPERATIONAL_STATE_LIST = [
    { operationalStateId: OP_STATE_STOPPED },
    { operationalStateId: OP_STATE_RUNNING },
    { operationalStateId: OP_STATE_PAUSED },
    { operationalStateId: OP_STATE_ERROR },
    { operationalStateId: OP_STATE_SEEKING_CHARGER },
    { operationalStateId: OP_STATE_CHARGING },
    { operationalStateId: OP_STATE_DOCKED },
];
const DEFAULT_MAP_ID = 1;
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
function batteryChargeStateFor(state) {
    if (state.status === 'docked' && state.batteryLevel >= 100) {
        return BATTERY_CHARGE_STATE_FULL;
    }
    if (state.status === 'docked') {
        return BATTERY_CHARGE_STATE_CHARGING;
    }
    return BATTERY_CHARGE_STATE_NOT_CHARGING;
}
function normalizeModel(model) {
    const trimmed = model.trim();
    return (trimmed || 'Roborock').slice(0, 32);
}
function cloneModes(modes) {
    return modes.map((mode) => ({
        ...mode,
        modeTags: [...mode.modeTags ?? []],
    }));
}
function runInBackground(action, onError) {
    action().catch(onError);
}
function getConfiguredRooms(config) {
    const seen = new Set();
    return (config.rooms ?? [])
        .filter((room) => room.name?.trim() && Number.isInteger(room.segmentId))
        .filter((room) => {
        if (seen.has(room.segmentId)) {
            return false;
        }
        seen.add(room.segmentId);
        return true;
    });
}
function buildServiceAreaCluster(rooms) {
    if (!rooms.length) {
        return undefined;
    }
    return {
        supportedMaps: [
            {
                mapId: DEFAULT_MAP_ID,
                name: 'Roborock Map',
            },
        ],
        supportedAreas: rooms.map((room) => ({
            areaId: room.segmentId,
            mapId: DEFAULT_MAP_ID,
            areaInfo: {
                locationInfo: {
                    locationName: room.name,
                    floorNumber: null,
                    areaType: null,
                },
                landmarkInfo: null,
            },
        })),
        selectedAreas: [],
        currentArea: null,
        estimatedEndTime: null,
        progress: [],
    };
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
        this.lastState = null;
        this.endpointNotReadyLogged = false;
        this.liveUpdateErrorLogged = false;
        this.model = 'Roborock';
    }
    /**
     * Register the device with Homebridge's Matter API.
     * Call this after api.matter is confirmed available.
     */
    async start() {
        const matter = this.api.matter; // safe: caller has gated on isMatterEnabled()
        const { name, ip } = this.config;
        const rooms = getConfiguredRooms(this.config);
        const serviceAreaCluster = buildServiceAreaCluster(rooms);
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
                    supportedModes: cloneModes(SUPPORTED_RUN_MODES),
                    currentMode: RUN_MODE_IDLE,
                },
                rvcCleanMode: {
                    supportedModes: cloneModes(SUPPORTED_CLEAN_MODES),
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
                    batChargeState: BATTERY_CHARGE_STATE_UNKNOWN,
                    status: 1, // 1 = Active
                },
                ...(serviceAreaCluster ? { serviceArea: serviceAreaCluster } : {}),
            },
            // ── Command handlers ───────────────────────────────────────────────────
            // Homebridge calls these when a Matter controller sends a command.
            handlers: {
                rvcRunMode: {
                    changeToMode: async ({ newMode }) => {
                        try {
                            if (newMode === RUN_MODE_CLEANING) {
                                if (this.lastState?.status === 'cleaning') {
                                    this.log.info(`[Matter] "${name}" → already cleaning`);
                                    return;
                                }
                                this.log.info(`[Matter] "${name}" → start cleaning`);
                                this.applyOptimisticState({ status: 'cleaning' });
                                runInBackground(() => this.client.startCleaning(), (err) => this.log.error(`[Matter] "${name}" async start cleaning error: ${err}`));
                            }
                            else {
                                if (this.lastState?.status === 'docked' ||
                                    this.lastState?.status === 'returning') {
                                    this.log.info(`[Matter] "${name}" → already returning/docked`);
                                    return;
                                }
                                this.log.info(`[Matter] "${name}" → return to dock`);
                                this.applyOptimisticState({ status: 'returning' });
                                runInBackground(() => this.client.returnToDock(), (err) => this.log.error(`[Matter] "${name}" async return to dock error: ${err}`));
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
                            this.log.debug(`[Matter] "${name}" → fan speed ${speed}%`);
                            this.applyOptimisticState({ fanSpeed: speed });
                            runInBackground(() => this.client.setFanSpeed(speed), (err) => this.log.error(`[Matter] "${name}" async fan speed error: ${err}`));
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
                            if (this.lastState?.status === 'paused') {
                                this.log.info(`[Matter] "${name}" → already paused`);
                                return;
                            }
                            this.log.info(`[Matter] "${name}" → pause`);
                            this.applyOptimisticState({ status: 'paused' });
                            runInBackground(() => this.client.pauseCleaning(), (err) => this.log.error(`[Matter] "${name}" async pause error: ${err}`));
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" pause error: ${err}`);
                            throw err;
                        }
                    },
                    resume: async () => {
                        try {
                            if (this.lastState?.status === 'cleaning') {
                                this.log.info(`[Matter] "${name}" → already cleaning`);
                                return;
                            }
                            this.log.info(`[Matter] "${name}" → resume`);
                            this.applyOptimisticState({ status: 'cleaning' });
                            runInBackground(() => this.client.startCleaning(), (err) => this.log.error(`[Matter] "${name}" async resume error: ${err}`));
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" resume error: ${err}`);
                            throw err;
                        }
                    },
                    goHome: async () => {
                        try {
                            if (this.lastState?.status === 'docked' ||
                                this.lastState?.status === 'returning') {
                                this.log.info(`[Matter] "${name}" → already returning/docked`);
                                return;
                            }
                            this.log.info(`[Matter] "${name}" → go home`);
                            this.applyOptimisticState({ status: 'returning' });
                            runInBackground(() => this.client.returnToDock(), (err) => this.log.error(`[Matter] "${name}" async goHome error: ${err}`));
                        }
                        catch (err) {
                            this.log.error(`[Matter] "${name}" goHome error: ${err}`);
                            throw err;
                        }
                    },
                },
                ...(serviceAreaCluster ? {
                    serviceArea: {
                        selectAreas: async ({ newAreas }) => {
                            try {
                                const segmentIds = this.getValidRoomSegmentIds(newAreas);
                                if (!segmentIds.length) {
                                    this.log.warn(`[Matter] "${name}" room clean requested without configured room IDs`);
                                    return;
                                }
                                this.log.info(`[Matter] "${name}" → clean room segment(s): ${segmentIds.join(', ')}`);
                                this.applySelectedRooms(segmentIds);
                                this.applyOptimisticState({ status: 'cleaning' });
                                runInBackground(() => this.client.cleanSegments(segmentIds), (err) => this.log.error(`[Matter] "${name}" async room clean error: ${err}`));
                            }
                            catch (err) {
                                this.log.error(`[Matter] "${name}" serviceArea selectAreas error: ${err}`);
                                throw err;
                            }
                        },
                    },
                } : {}),
            },
        };
        this.accessory = accessory;
        this.log.info(`[Matter] Registering "${name}" as RoboticVacuumCleaner: manufacturer=${accessory.manufacturer}, model=${accessory.model}, firmware=${accessory.firmwareRevision}, serial=${accessory.serialNumber}, uuid=${accessory.UUID}`);
        if (rooms.length) {
            this.log.info(`[Matter] "${name}" room selection enabled for ${rooms.length} configured room(s): ${rooms.map((room) => `${room.name}=${room.segmentId}`).join(', ')}`);
        }
        if (cachedAccessory) {
            await matter.updatePlatformAccessories([accessory]);
        }
        else {
            await matter.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                accessory,
            ]);
        }
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
        this.accessory.firmwareRevision = settings_1.PLUGIN_VERSION;
        this.accessory.context = {
            ...this.accessory.context,
            model: normalizedModel,
            firmwareRevision: settings_1.PLUGIN_VERSION,
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
        if (!this.uuid || !this.accessory)
            return; // not registered yet
        const matter = this.api.matter;
        const stateSummary = `status=${state.status}, battery=${state.batteryLevel}%, fan=${state.fanSpeed}%, error=${state.errorCode}, cleanTime=${state.cleanTime}s, cleanArea=${state.cleanArea}`;
        this.lastState = state;
        this.accessory.clusters = {
            ...this.accessory.clusters,
            rvcRunMode: {
                ...this.accessory.clusters?.rvcRunMode,
                supportedModes: cloneModes(SUPPORTED_RUN_MODES),
                currentMode: state.status === 'cleaning' ? RUN_MODE_CLEANING : RUN_MODE_IDLE,
            },
            rvcCleanMode: {
                ...this.accessory.clusters?.rvcCleanMode,
                supportedModes: cloneModes(SUPPORTED_CLEAN_MODES),
                currentMode: fanSpeedToCleanMode(state.fanSpeed),
            },
            rvcOperationalState: {
                ...this.accessory.clusters?.rvcOperationalState,
                operationalState: operationalStateFor(state),
                operationalError: roborockErrorToMatterError(state.errorCode),
            },
            powerSource: {
                ...this.accessory.clusters?.powerSource,
                batPercentRemaining: Math.max(0, Math.min(200, state.batteryLevel * 2)),
                batChargeState: batteryChargeStateFor(state),
            },
            ...(this.accessory.clusters?.serviceArea ? {
                serviceArea: {
                    ...this.accessory.clusters.serviceArea,
                    currentArea: state.status === 'cleaning'
                        ? this.getFirstSelectedRoomSegmentId()
                        : null,
                },
            } : {}),
        };
        const externalServer = this.getExternalMatterServer();
        if (!externalServer) {
            if (!this.endpointNotReadyLogged) {
                this.log.debug(`[Matter] "${this.config.name}" external endpoint is not ready for live state updates yet; will retry on the next poll.`);
                this.endpointNotReadyLogged = true;
            }
            return;
        }
        runInBackground(() => this.pushLiveState(externalServer, state), (err) => {
            if (!this.liveUpdateErrorLogged) {
                this.log.warn(`[Matter] "${this.config.name}" live state update failed: ${err}`);
                this.liveUpdateErrorLogged = true;
            }
            else {
                this.log.debug(`[Matter] "${this.config.name}" live state update still failing: ${err}`);
            }
        });
        if (stateSummary !== this.lastStateSummary) {
            this.log.info(`[Matter] "${this.config.name}" state updated: ${stateSummary}`);
            this.lastStateSummary = stateSummary;
        }
        else {
            this.log.debug(`[Matter] "${this.config.name}" state unchanged`);
        }
    }
    getExternalMatterServer() {
        if (!this.uuid) {
            return undefined;
        }
        return this.api._matterManager?.getExternalServer?.(this.uuid);
    }
    async pushLiveState(externalServer, state) {
        if (!this.uuid) {
            return;
        }
        const matter = this.api.matter;
        await externalServer.updateAccessoryState(this.uuid, matter.clusterNames.RvcRunMode, {
            currentMode: state.status === 'cleaning' ? RUN_MODE_CLEANING : RUN_MODE_IDLE,
        });
        await externalServer.updateAccessoryState(this.uuid, matter.clusterNames.RvcCleanMode, { currentMode: fanSpeedToCleanMode(state.fanSpeed) });
        await externalServer.updateAccessoryState(this.uuid, matter.clusterNames.RvcOperationalState, {
            operationalState: operationalStateFor(state),
            operationalError: roborockErrorToMatterError(state.errorCode),
        });
        await externalServer.updateAccessoryState(this.uuid, matter.clusterNames.PowerSource, {
            batPercentRemaining: Math.max(0, Math.min(200, state.batteryLevel * 2)),
            batChargeState: batteryChargeStateFor(state),
        });
        if (this.accessory?.clusters?.serviceArea) {
            await externalServer.updateAccessoryState(this.uuid, matter.clusterNames.ServiceArea, {
                selectedAreas: this.accessory.clusters.serviceArea.selectedAreas ?? [],
                currentArea: state.status === 'cleaning'
                    ? this.getFirstSelectedRoomSegmentId()
                    : null,
            });
        }
        this.liveUpdateErrorLogged = false;
    }
    applyOptimisticState(update) {
        if (!this.accessory) {
            return;
        }
        const nextState = {
            status: update.status ?? this.lastState?.status ?? 'idle',
            batteryLevel: this.lastState?.batteryLevel ?? 0,
            fanSpeed: update.fanSpeed ?? this.lastState?.fanSpeed ?? 50,
            errorCode: this.lastState?.errorCode ?? 0,
            cleanArea: this.lastState?.cleanArea ?? 0,
            cleanTime: this.lastState?.cleanTime ?? 0,
        };
        this.lastState = nextState;
        this.accessory.clusters = {
            ...this.accessory.clusters,
            rvcRunMode: {
                ...this.accessory.clusters?.rvcRunMode,
                currentMode: nextState.status === 'cleaning' ? RUN_MODE_CLEANING : RUN_MODE_IDLE,
            },
            rvcCleanMode: {
                ...this.accessory.clusters?.rvcCleanMode,
                currentMode: fanSpeedToCleanMode(nextState.fanSpeed),
            },
            rvcOperationalState: {
                ...this.accessory.clusters?.rvcOperationalState,
                operationalState: operationalStateFor(nextState),
                operationalError: roborockErrorToMatterError(nextState.errorCode),
            },
        };
        // Do not push a live Matter update from the command handler path.
        // Homebridge's command response can time out if a state transaction waits
        // on an offline controller while the UI is waiting for IPC completion.
        // The next poll pushes confirmed robot state instead.
    }
    getValidRoomSegmentIds(areaIds) {
        const configuredSegmentIds = new Set(getConfiguredRooms(this.config).map((room) => room.segmentId));
        return areaIds.filter((areaId) => configuredSegmentIds.has(areaId));
    }
    applySelectedRooms(segmentIds) {
        if (!this.accessory?.clusters?.serviceArea) {
            return;
        }
        this.accessory.clusters = {
            ...this.accessory.clusters,
            serviceArea: {
                ...this.accessory.clusters.serviceArea,
                selectedAreas: segmentIds,
                currentArea: segmentIds[0] ?? null,
            },
        };
    }
    getFirstSelectedRoomSegmentId() {
        const selectedAreas = this.accessory?.clusters?.serviceArea?.selectedAreas;
        if (!Array.isArray(selectedAreas) || selectedAreas.length === 0) {
            return null;
        }
        return selectedAreas[0];
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