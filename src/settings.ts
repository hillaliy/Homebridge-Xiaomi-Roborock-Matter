export const PLUGIN_NAME = 'homebridge-xiaomi-roborock-matter';
export const PLATFORM_NAME = 'XiaomiRoborockMatter';
export const PLUGIN_VERSION = '1.0.9';

/** Optional room mapping for Matter ServiceArea. */
export interface RoborockRoomConfig {
  /** Room name shown by Matter controllers */
  name: string;
  /** Roborock map segment ID */
  segmentId: number;
}

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
  /** Optional room name overrides/fallbacks; rooms are discovered over LAN */
  rooms?: RoborockRoomConfig[];
}

/** Shape of the platform config block in config.json */
export interface RoborockPlatformConfig {
  platform: typeof PLATFORM_NAME;
  devices: RoborockDeviceConfig[];
}
