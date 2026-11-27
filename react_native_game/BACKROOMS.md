# Type-to-Run · Backrooms — React Native (Expo) build

This archive is the **React Native version** of the game, separated from the
Flutter and React (web) builds.

## What changed in this build

1. **Realistic backrooms plates behind the camera feed.**
   `src/components/CameraFeed.tsx` now draws a photographic corridor under the
   existing SVG corridor and ghost: one plate per atmosphere
   (`flickering` lobby, `misty` / `sterile` grey warehouse, `flooded` poolrooms)
   plus `chase.jpg`, which fades in while an entity is chasing you.
   Images live in `assets/backrooms/`.

2. **Jumpscare overlay, ported from the Flutter build.**
   `src/components/JumpscareOverlay.tsx` reproduces
   `flutter_game/lib/ui/widgets/jumpscare_overlay.dart` with the native
   `Animated` API: the same shake / tilt / breathing zoom motion, a red flood
   over the plate, and an `onFinished` callback after the duration.
   `App.tsx` mounts it the moment the store enters `gameover`, before the
   results screen shows.

## Run it

    npm install
    npx expo start          # press i / a, or scan the QR code with Expo Go

The backend lives in the separate **typetorun-database** archive (MySQL schema,
seed data and the Express API both games talk to).
