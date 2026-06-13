export declare const PLUGIN_NAME = "homebridge-xiaomi-roborock-matter";
export declare const PLATFORM_NAME = "XiaomiRoborockMatter";
export declare const PLUGIN_VERSION = "1.0.2";
/** Shape of a single device in config.json */
export interface RoborockDeviceConfig {
    /** Friendly name shown in HomeKit / Matter */
    name: string;
    /** Device IP address on your LAN */
    ip: string;
    /** 32-character miio token (from Mi Home app or router) */
    token: string;
    /**
     * Optional Matter discriminator (0–4095).
     * Each device must have a unique one. Defaults to a hash of the IP.
     */
    discriminator?: number;
    /**
     * Optional Matter passcode (1–99999998).
     * Defaults to 20202021 (Matter spec default for testing — change in production!).
     */
    passcode?: number;
    /** Poll interval in milliseconds. Default: 10000 */
    pollInterval?: number;
}
/** Shape of the platform config block in config.json */
export interface RoborockPlatformConfig {
    platform: typeof PLATFORM_NAME;
    devices: RoborockDeviceConfig[];
}
//# sourceMappingURL=settings.d.ts.map