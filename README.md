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
- Quiet, Balanced, Turbo, and Max clean modes
- Battery and operational-state updates
- miio model metadata when the vacuum reports it
- Homebridge UI configuration schema

## <img src="https://api.iconify.design/lucide:list-checks.svg" width="18" alt=""> Requirements

- Homebridge 2.0 or newer with Matter enabled
- Node.js 22 or newer
- Static LAN IP address for each Roborock
- 32-character miio token for each Roborock

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
| Quiet / Balanced / Turbo / Max | `set_custom_mode` |

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
