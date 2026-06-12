"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoborockMatterPlatform = void 0;
const matterBridge_1 = require("./matterBridge");
const roborockClient_1 = require("./roborockClient");
class RoborockMatterPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.devices = new Map();
        this.matterAccessories = new Map();
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.log.info(`Xiaomi Roborock Matter platform loaded on Homebridge ${api.serverVersion}`);
        this.log.debug(`Matter available=${api.isMatterAvailable()} enabled=${api.isMatterEnabled()}`);
        // Wait for Homebridge to finish launching before we do anything
        this.api.on('didFinishLaunching', () => {
            this.discoverDevices().catch((err) => {
                this.log.error(`Discovery failed: ${err}`);
            });
        });
        this.api.on('shutdown', () => {
            this.teardown().catch((err) => {
                this.log.warn(`Shutdown cleanup failed: ${err}`);
            });
        });
    }
    // Homebridge calls this for cached accessories on startup — we don't use cache
    // for Matter devices since matter.js manages its own persistence.
    configureAccessory(_accessory) {
        this.log.debug('Ignoring cached accessory (Matter devices are self-managed)');
    }
    configureMatterAccessory(accessory) {
        this.log.info(`Loaded cached Matter accessory "${accessory.displayName}" (${accessory.UUID})`);
        this.matterAccessories.set(accessory.UUID, accessory);
    }
    async discoverDevices() {
        this.log.info('Starting Roborock Matter discovery');
        this.log.debug(`Matter status: available=${this.api.isMatterAvailable()} enabled=${this.api.isMatterEnabled()} api=${this.api.matter ? 'present' : 'missing'}`);
        if (!this.api.isMatterEnabled() || !this.api.matter) {
            this.log.error('Matter is not enabled for this Homebridge instance. Enable bridge.matter before using this plugin.');
            return;
        }
        const platformConfig = this.config;
        if (!platformConfig.devices?.length) {
            this.log.warn('No devices configured. Add devices to your config.json under the RoborockMatter platform.');
            return;
        }
        this.log.info(`Configured Roborock devices: ${platformConfig.devices.length}. Cached Matter accessories: ${this.matterAccessories.size}.`);
        for (const deviceConfig of platformConfig.devices) {
            await this.startDevice(deviceConfig);
        }
    }
    async startDevice(deviceConfig) {
        const { name, ip, token, pollInterval = 10000 } = deviceConfig;
        if (!name || !ip || !token) {
            this.log.warn('Skipping device with missing name, ip, or token.');
            return;
        }
        if (this.devices.has(ip)) {
            this.log.warn(`Skipping duplicate device config for ${ip}`);
            return;
        }
        if (!/^[0-9a-fA-F]{32}$/.test(token)) {
            this.log.warn(`Device "${name}" has a token that is not 32 hex characters. Connection will probably fail.`);
        }
        this.log.info(`Setting up device "${name}" at ${ip} with poll interval ${pollInterval} ms`);
        this.log.debug(`Device "${name}" token length: ${token.length}`);
        const client = new roborockClient_1.RoborockClient(ip, token, this.log);
        const bridge = new matterBridge_1.MatterVacuumBridge(deviceConfig, client, this.api, this.log, this.matterAccessories);
        try {
            await client.connect();
            await bridge.updateModel(client.getModel());
            this.log.info(`Detected "${name}" miio model before Matter registration: ${client.getModel()}`);
        }
        catch (err) {
            this.log.warn(`Could not detect model for "${name}" before Matter registration: ${err}. Using fallback model until the robot connects.`);
        }
        try {
            this.log.info(`Registering "${name}" as a Matter robotic vacuum`);
            await bridge.start();
        }
        catch (err) {
            this.log.error(`Failed to register Matter device "${name}": ${err}`);
            client.destroy();
            return;
        }
        this.devices.set(ip, {
            client,
            bridge,
            pollTimer: this.createPollTimer(name, client, bridge, pollInterval),
        });
        this.log.info(`Device "${name}" is registered with Matter`);
        // Initial connection and state push. If this fails, the poll loop keeps
        // retrying so the Matter device can still be discovered and commissioned.
        try {
            if (!client.isConnected()) {
                await client.connect();
                await bridge.updateModel(client.getModel());
            }
            await bridge.updateModel(client.getModel());
            const state = await client.getState();
            await bridge.updateState(state);
            this.log.info(`Initial state for "${name}" (${client.getModel()}): status=${state.status}, battery=${state.batteryLevel}%, fan=${state.fanSpeed}%, error=${state.errorCode}`);
        }
        catch (err) {
            this.log.warn(`Could not connect to "${name}" or fetch initial state yet: ${err}. Will retry every ${pollInterval} ms.`);
        }
    }
    createPollTimer(name, client, bridge, pollInterval) {
        return setInterval(async () => {
            try {
                if (!client.isConnected()) {
                    this.log.info(`[Roborock] "${name}" is offline, retrying connection`);
                    await client.connect();
                    await bridge.updateModel(client.getModel());
                }
                const state = await client.getState();
                await bridge.updateState(state);
            }
            catch (err) {
                this.log.warn(`Poll failed for "${name}": ${err}`);
            }
        }, pollInterval);
    }
    async teardown() {
        this.log.info('Shutting down all Roborock Matter devices...');
        for (const [ip, { client, bridge, pollTimer }] of this.devices) {
            clearInterval(pollTimer);
            await bridge.stop();
            client.destroy();
            this.log.debug(`Stopped device at ${ip}`);
        }
        this.devices.clear();
    }
}
exports.RoborockMatterPlatform = RoborockMatterPlatform;
//# sourceMappingURL=platform.js.map