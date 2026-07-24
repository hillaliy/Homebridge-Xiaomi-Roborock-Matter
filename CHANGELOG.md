# Changelog

## 1.0.12 - 2026-07-24

### Fixed

- Fixed room cleaning command parameters for Roborock models that expect `app_segment_clean` to receive the segment list directly.

## 1.0.11 - 2026-06-23

### Fixed

- Added the required top-level `name` property to the Homebridge config schema.
- Removed `homebridge` from `peerDependencies` so it remains only in development dependencies.

## 1.0.10 - 2026-06-23

### Fixed

- Added a distinct Matter `Auto` mode tag to the Balanced clean mode so HomeKit can show the 50% fan mode as a selectable option.

## 1.0.9 - 2026-06-23

### Fixed

- Fixed clean-mode control for `rockrobo.vacuum.v1` by using legacy miio fan codes.
- Recognize both legacy and modern Roborock fan-speed codes when reading status.
- Reduced normal cleaning log noise by ignoring battery, clean-time, and clean-area changes for `info` state-update logging.

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
