# homebridge-xiaomi-roborock-matter

Homebridge platform plugin that exposes Xiaomi Roborock vacuum cleaners as Matter Robotic Vacuum Cleaner devices using local miio LAN control.

## How It Works

```text
Roborock vacuum (LAN/miio) <-> Homebridge plugin <-> Homebridge Matter <-> Matter controllers
```

The plugin communicates with the robot locally over your LAN and registers each configured robot with Homebridge's built-in Matter API. No Xiaomi cloud account is used at runtime.

## Requirements

- Homebridge 2.0 or newer with Matter enabled
- Node.js 22 or newer
- A static LAN IP address for each Roborock
- The 32-character miio token for each Roborock

## Installation

```bash
npm install -g homebridge-xiaomi-roborock-matter
```

Or install it from the Homebridge UI by searching for `homebridge-xiaomi-roborock-matter`.

## Configuration

Add a platform block to `config.json`:

```json
{
  "platform": "XiaomiRoborockMatter",
  "devices": [
    {
      "name": "Living Room Vacuum",
      "ip": "192.168.1.100",
      "token": "your32charactertoken0000000000000",
      "pollInterval": 10000
    }
  ]
}
```

### Fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Name shown to Matter controllers. |
| `ip` | Yes | Robot LAN IP address. Use a static DHCP lease. |
| `token` | Yes | 32-character miio token. |
| `pollInterval` | No | State refresh interval in milliseconds. Defaults to `10000`. |

The `discriminator` and `passcode` fields are reserved for future standalone commissioning support. Homebridge currently owns Matter commissioning for registered platform accessories.

## Supported Controls

| Matter command | Roborock command |
| --- | --- |
| Start cleaning | `app_start` |
| Pause | `app_pause` |
| Resume | `app_start` |
| Go home / return to dock | `app_charge` |
| Quiet / Balanced / Turbo / Max clean mode | `set_custom_mode` |

## Development

```bash
npm install
npm run build
npm run lint
```

`npm run lint` runs TypeScript in no-emit mode.

## Troubleshooting

- `Matter is not enabled`: enable Matter in your Homebridge bridge configuration.
- `Failed to connect`: verify the IP address, token, and that LAN miio control is still supported by the robot firmware.
- Battery or status is stale: lower `pollInterval` to refresh more often.

## License

MIT
