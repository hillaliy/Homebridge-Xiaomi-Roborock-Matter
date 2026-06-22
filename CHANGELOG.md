# Changelog

## 1.0.8 - 2026-06-22

### Fixed

- Report `Charging` in HomeKit while the vacuum is docked below 100% battery.
- Report `Ready` after the docked vacuum reaches 100% battery.

### Changed

- Updated `actions/checkout` to version 7.
- Updated Node.js development types to version 26.
- Added package metadata and this changelog so Homebridge UI can locate and display GitHub release notes.

## 1.0.7 - 2026-06-18

### Added

- Automatic room discovery over the local miio connection.
- Matter room selection with LAN segment cleaning.
- Optional manual room-name overrides and fallback mappings.

### Fixed

- Improved Matter command handling and live state updates.
- Corrected battery charging-state values.
- Preserved cached Matter accessories and commissioning state across restarts.

### Documentation

- Documented local-network operation and miio token extraction.
