import { Logger } from 'homebridge';
import miio from 'miio';

export type RoborockStatus =
  | 'cleaning'
  | 'returning'
  | 'docked'
  | 'paused'
  | 'idle'
  | 'error';

export interface RoborockState {
  status: RoborockStatus;
  batteryLevel: number; // 0–100
  fanSpeed: number; // 0–100 (mapped from Roborock speed modes)
  errorCode: number;
  cleanArea: number; // cm²
  cleanTime: number; // seconds
}

export interface RoborockRoom {
  name: string;
  segmentId: number;
}

/** Maps Roborock status codes to our simplified status enum */
const STATUS_MAP: Record<number, RoborockStatus> = {
  1: 'idle', // Initiating
  2: 'idle', // Sleeping
  3: 'idle', // Idle
  4: 'returning', // Remote control
  5: 'cleaning',
  6: 'returning', // Returning home
  7: 'cleaning', // Manual mode
  8: 'docked',
  9: 'error',
  10: 'paused',
  11: 'cleaning', // Spot cleaning
  12: 'error',
  13: 'idle', // Shutting down
  14: 'idle', // Updating
  15: 'idle', // Docking
  16: 'cleaning', // Go to spot
  17: 'cleaning', // Zone cleaning
  18: 'cleaning', // Room cleaning
};

/** Maps fan speed codes to 0-100 percentage */
const FAN_SPEED_MAP: Record<number, number> = {
  38: 25, // Quiet / Silent on older rockrobo models
  60: 50, // Balanced / Standard on older rockrobo models
  75: 75, // Turbo / Medium on older rockrobo models
  100: 100, // Max / Turbo on older rockrobo models
  101: 25, // Quiet
  102: 50, // Balanced
  103: 75, // Turbo
  104: 100, // Max
  105: 50, // Mop mode
};

const LEGACY_FAN_SPEED_CODES: Record<number, number> = {
  25: 38,
  50: 60,
  75: 75,
  100: 100,
};

const MODERN_FAN_SPEED_CODES: Record<number, number> = {
  25: 101,
  50: 102,
  75: 103,
  100: 104,
};

function normalizeFanSpeed(speedPercent: number): 25 | 50 | 75 | 100 {
  if (speedPercent <= 25) return 25;
  if (speedPercent <= 50) return 50;
  if (speedPercent <= 75) return 75;
  return 100;
}

export class RoborockClient {
  private device: any = null;
  private model: string | null = null;

  constructor(
    private readonly ip: string,
    private readonly token: string,
    private readonly log: Logger,
  ) {}

  async connect(): Promise<void> {
    try {
      if (this.device) {
        this.log.debug(`[Roborock ${this.ip}] Already connected`);
        return;
      }

      this.log.info(`[Roborock ${this.ip}] Connecting over miio`);
      this.device = await miio.device({ address: this.ip, token: this.token });
      this.model = this.device.miioModel ?? null;
      this.log.info(
        `[Roborock] Connected to ${this.ip} (model: ${this.getModel()})`,
      );
    } catch (err) {
      this.log.error(`[Roborock] Failed to connect to ${this.ip}: ${err}`);
      throw err;
    }
  }

  isConnected(): boolean {
    return Boolean(this.device);
  }

  getModel(): string {
    return this.model ?? 'Roborock';
  }

  async getState(): Promise<RoborockState> {
    this.assertConnected();
    this.log.debug(`[Roborock ${this.ip}] Reading status`);
    const statusResult = await this.device.call('get_status', []);

    const s = statusResult[0] ?? statusResult;
    let batteryLevel = s.battery ?? 0;

    if (!batteryLevel) {
      try {
        const batteryResult = await this.device.call('get_battery_info', []);
        batteryLevel = (batteryResult[0] ?? batteryResult)?.battery ?? 0;
      } catch (err) {
        this.log.debug(
          `[Roborock ${this.ip}] get_battery_info unavailable: ${err}`,
        );
      }
    }

    const state = {
      status: STATUS_MAP[s.state] ?? 'idle',
      batteryLevel,
      fanSpeed: FAN_SPEED_MAP[s.fan_power] ?? 50,
      errorCode: s.error_code ?? 0,
      cleanArea: s.clean_area ?? 0,
      cleanTime: s.clean_time ?? 0,
    };
    this.log.debug(
      `[Roborock ${this.ip}] Parsed state: status=${state.status}, battery=${state.batteryLevel}%, fan=${state.fanSpeed}% (raw ${s.fan_power ?? 'unknown'}), error=${state.errorCode}`,
    );
    return state;
  }

  async startCleaning(): Promise<void> {
    this.assertConnected();
    await this.device.call('app_start', []);
    this.log.info(`[Roborock ${this.ip}] Start cleaning`);
  }

  async pauseCleaning(): Promise<void> {
    this.assertConnected();
    await this.device.call('app_pause', []);
    this.log.info(`[Roborock ${this.ip}] Pause cleaning`);
  }

  async returnToDock(): Promise<void> {
    this.assertConnected();
    await this.device.call('app_charge', []);
    this.log.info(`[Roborock ${this.ip}] Return to dock`);
  }

  async setFanSpeed(speedPercent: number): Promise<void> {
    this.assertConnected();
    const normalizedSpeed = normalizeFanSpeed(speedPercent);
    const codeMap = this.usesLegacyFanSpeedCodes()
      ? LEGACY_FAN_SPEED_CODES
      : MODERN_FAN_SPEED_CODES;
    const code = codeMap[normalizedSpeed];
    await this.device.call('set_custom_mode', [code]);
    this.log.debug(
      `[Roborock ${this.ip}] Fan speed → ${normalizedSpeed}% (code ${code})`,
    );
  }

  async cleanSegments(segmentIds: number[]): Promise<void> {
    this.assertConnected();
    await this.device.call('app_segment_clean', [segmentIds]);
    this.log.info(
      `[Roborock ${this.ip}] Clean room segment(s): ${segmentIds.join(', ')}`,
    );
  }

  async getRoomMapping(): Promise<RoborockRoom[]> {
    this.assertConnected();
    this.log.debug(`[Roborock ${this.ip}] Reading room mapping`);
    const result = await this.device.call('get_room_mapping', []);
    this.log.debug(
      `[Roborock ${this.ip}] Raw room mapping: ${JSON.stringify(result)}`,
    );
    const entries = Array.isArray(result) ? result : [];
    const rooms: RoborockRoom[] = [];
    const seen = new Set<number>();

    for (const entry of entries) {
      const segmentId = Array.isArray(entry)
        ? Number(entry[0])
        : Number(entry?.segment_id ?? entry?.segmentId ?? entry?.id);
      const rawName = Array.isArray(entry)
        ? entry[1]
        : entry?.name ?? entry?.room_name ?? entry?.roomName;

      if (!Number.isInteger(segmentId) || segmentId <= 0 || seen.has(segmentId)) {
        continue;
      }

      seen.add(segmentId);
      rooms.push({
        segmentId,
        name: typeof rawName === 'string' && rawName.trim()
          ? rawName.trim()
          : `Room ${segmentId}`,
      });
    }

    this.log.info(
      rooms.length
        ? `[Roborock ${this.ip}] Discovered ${rooms.length} room(s): ${rooms.map((room) => `${room.name}=${room.segmentId}`).join(', ')}`
        : `[Roborock ${this.ip}] Room mapping is empty`,
    );
    return rooms;
  }

  async findRobot(): Promise<void> {
    this.assertConnected();
    await this.device.call('find_me', []);
  }

  private assertConnected() {
    if (!this.device) {
      throw new Error(`Not connected to Roborock at ${this.ip}`);
    }
  }

  private usesLegacyFanSpeedCodes(): boolean {
    return /^rockrobo\.vacuum\.v1\b/.test(this.getModel());
  }

  destroy() {
    this.log.debug(`[Roborock ${this.ip}] Destroying miio client`);
    this.device?.destroy?.();
    this.device = null;
    this.model = null;
  }
}
