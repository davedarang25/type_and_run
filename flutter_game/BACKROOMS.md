# Type-to-Run · Backrooms — Flutter build

This archive is the **Flutter version** of the game, separated from the React
(web) and React Native builds. It is the original build that owns the jumpscare
feature; nothing about the jumpscare was changed here.

## What changed in this build

**Realistic backrooms plates behind the camera feed.**
`lib/ui/widgets/camera_feed.dart` now draws a photographic corridor beneath the
existing `CorridorPainter` geometry and ghost painter: one plate per atmosphere
(`flickering` lobby, `misty` / `sterile` grey warehouse, `flooded` poolrooms)
plus `backroom_chase.jpg`, which fades in through an `AnimatedOpacity` while an
entity is chasing you. Plates live in `assets/images/`, already covered by the
`assets/images/` entry in `pubspec.yaml`.

The jumpscare itself (`lib/ui/widgets/jumpscare_overlay.dart` plus the
`assets/images/jumpscare_*.png` faces) is untouched — it is the reference the
React and React Native builds were ported from.

## Run it

    flutter pub get
    flutter run -d chrome      # or macos / an attached device

First time on a new machine: `bash tool/setup.sh` adds the platform folders and
network permissions.

The backend lives in the separate **typetorun-database** archive (MySQL schema,
seed data and the Express API both games talk to).
