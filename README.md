<p align="center">
  <img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-wordmark-logo-vertical.png" width="190" alt="Homebridge">
</p>

<h1 align="center">Homebridge Xiaomi Roborock Matter</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/homebridge-xiaomi-roborock-matter">
    <img src="https://img.shields.io/npm/v/homebridge-xiaomi-roborock-matter?label=npm%20version" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/homebridge-xiaomi-roborock-matter">
    <img src="https://img.shields.io/npm/dt/homebridge-xiaomi-roborock-matter?label=npm%20downloads" alt="npm downloads">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen" alt="Node.js >= 22">
  <img src="https://img.shields.io/badge/homebridge-%3E%3D2.0.0-purple" alt="Homebridge >= 2">
</p>

<p align="center">
  <a href="https://www.paypal.me/hillaliy">
    <img src="https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal" alt="Donate with PayPal">
  </a>
</p>

Expose Xiaomi Roborock vacuum cleaners as Matter Robotic Vacuum Cleaner devices through Homebridge, using local miio LAN control.

This plugin is designed to keep runtime control local. Xiaomi Cloud is not used after setup; Homebridge talks to the vacuum over your LAN and exposes it through Homebridge's built-in Matter support.

## <img src="https://api.iconify.design/lucide:sparkles.svg" width="18" alt=""> Features

- Matter Robotic Vacuum Cleaner accessory registration through Homebridge 2.x
- Local Roborock control over miio
- Start, pause, resume, and return-to-dock commands
- Quiet, Vacuum, Deep Clean, and Max clean modes
- Automatic LAN room discovery and Matter room selection
- Battery and operational-state updates
- miio model metadata when the vacuum reports it
- Homebridge UI configuration schema

## <img src="https://api.iconify.design/lucide:list-checks.svg" width="18" alt=""> Requirements

- Homebridge 2.0 or newer with Matter enabled
- Node.js 22 or newer
- Static LAN IP address for each Roborock
- 32-character miio token for each Roborock

## <img src="https://api.iconify.design/lucide:wifi.svg" width="18" alt=""> Local Network Control

This plugin communicates directly with the vacuum on your local network using the Xiaomi miio protocol. Starting, pausing, docking, status polling, fan-mode changes, and room discovery do not use the Xiaomi or Roborock cloud.

Homebridge and the vacuum must be able to reach each other on the same LAN. Assign the vacuum a static DHCP lease because both its IP address and miio token are used for the connection.

## <img src="https://api.iconify.design/lucide:key-round.svg" width="18" alt=""> Extracting the miio Token

The token is a 32-character hexadecimal value, for example `0123456789abcdef0123456789abcdef`. It is different from your Xiaomi account password.

### Xiaomi Cloud Tokens Extractor

1. Download and run the [Xiaomi Cloud Tokens Extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor).
2. Sign in with the Xiaomi account and region used by the Mi Home app.
3. Find the vacuum in the returned device list.
4. Copy its IP address and 32-character token into the Homebridge plugin settings.

### python-miio

Install [python-miio](https://github.com/rytilahti/python-miio), then start its interactive Xiaomi Cloud device lookup:

```bash
pipx install python-miio
miiocli cloud
```

Select the correct Xiaomi region and copy the token shown for the vacuum. The [Home Assistant Xiaomi Miio documentation](https://www.home-assistant.io/integrations/xiaomi_miio/#retrieving-the-access-token) also describes token retrieval methods.

Cloud access is needed only by these external extraction tools. Do not add your Xiaomi username or password to this plugin. The plugin stores only the IP address and token in the Homebridge configuration, never prints the token, and uses local miio communication during normal operation.

Some devices paired exclusively through the Roborock app may not expose a compatible Xiaomi miio token. This plugin requires a model and firmware that accept local miio commands.

## <img src="https://api.iconify.design/lucide:package-plus.svg" width="18" alt=""> Installation

Install from the Homebridge UI by searching for:

```text
homebridge-xiaomi-roborock-matter
```

Or install from npm:

```bash
npm install -g homebridge-xiaomi-roborock-matter
```

## <img src="https://api.iconify.design/lucide:settings.svg" width="18" alt=""> Configuration

You can configure the plugin from the Homebridge UI, or add a platform entry manually:

```json
{
  "platform": "XiaomiRoborockMatter",
  "devices": [
    {
      "name": "Living Room Vacuum",
      "ip": "192.168.1.100",
      "token": "0123456789abcdef0123456789abcdef",
      "pollInterval": 10000
    }
  ]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Name shown in Matter controllers. |
| `ip` | Yes | Vacuum LAN IP address. Use a static DHCP lease. |
| `token` | Yes | 32-character hexadecimal miio token. |
| `pollInterval` | No | State refresh interval in milliseconds. Defaults to `10000`. |
| `rooms` | No | Optional room name overrides or fallback mappings. Rooms are discovered over LAN. |
| `rooms[].name` | Yes, when using rooms | Room name shown in Matter controllers. |
| `rooms[].segmentId` | Yes, when using rooms | Roborock room segment ID from the active map. |

Room support uses `get_room_mapping` and `app_segment_clean` over the LAN. On startup, the plugin discovers segment IDs and room names before registering the Matter accessory. You can omit `rooms` entirely. Manual entries override a discovered room name with the same segment ID and act as a fallback when discovery is unavailable.

## <img src="https://api.iconify.design/lucide:house-plug.svg" width="18" alt=""> Matter Setup

Matter must be enabled in Homebridge. The plugin registers each configured Roborock as a Matter accessory through the Homebridge Matter API.

If the vacuum does not appear:

- Confirm Homebridge Matter is enabled.
- Confirm the Homebridge Matter bridge or accessory is commissioned in your Matter controller.
- Check the Homebridge logs for Matter registration errors.

## <img src="https://api.iconify.design/lucide:sliders-horizontal.svg" width="18" alt=""> Supported Controls

| Matter control | Roborock action |
| --- | --- |
| Start cleaning | `app_start` |
| Pause | `app_pause` |
| Resume | `app_start` |
| Return to dock | `app_charge` |
| Quiet / Vacuum / Deep Clean / Max | `set_custom_mode` |
| Room selection | `app_segment_clean` |

Mop-specific controls are not exposed yet. Mop-capable Roborock models usually require additional model-specific miio commands, so this plugin currently presents the device as a vacuum cleaner.

## <img src="https://api.iconify.design/lucide:workflow.svg" width="18" alt=""> How It Works

```text
Roborock vacuum
  <-> local miio LAN control
  <-> Homebridge plugin
  <-> Homebridge Matter
  <-> Apple Home / Google Home / other Matter controllers
```

## <img src="https://api.iconify.design/lucide:terminal.svg" width="18" alt=""> Development

```bash
npm install
npm run lint
npm run build
npm pack --dry-run
```

`npm run lint` runs TypeScript in no-emit mode.

## <img src="https://api.iconify.design/lucide:circle-help.svg" width="18" alt=""> Troubleshooting

- `Matter is not enabled`: enable Matter in your Homebridge bridge configuration.
- `Failed to connect`: verify the vacuum IP, miio token, and LAN miio support.
- `Behaviors have errors`: update to the latest plugin version and check Homebridge Matter logs.
- Battery or status is stale: lower `pollInterval`, but avoid polling too aggressively.

## <img src="https://api.iconify.design/lucide:heart-handshake.svg" width="18" alt=""> Support Development

If this plugin is useful to you, donations help cover time spent testing devices, maintaining compatibility, and improving Homebridge Matter support.

<p>
  <a href="https://www.paypal.me/hillaliy">
    <img src="https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal" alt="Donate with PayPal">
  </a>
</p>

## <img src="https://api.iconify.design/lucide:scale.svg" width="18" alt=""> License

MIT
