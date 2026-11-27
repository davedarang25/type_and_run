# Type-to-Run · Backrooms — React (web) build

This archive is the **ReactJS version** of the game, separated from the Flutter
and React Native builds.

## What changed in this build

1. **Realistic backrooms plate behind the camera feed.**
   `src/components/CameraFeed.tsx` layers a photographic corridor behind the
   existing grain / scanlines / vignette — one plate per atmosphere
   (`flickering` to lobby, `misty` / `sterile` to the grey warehouse,
   `flooded` to the poolrooms) plus a `chase.jpg` plate that fades in while an
   entity is chasing you. Plates live in `public/backrooms/`.

2. **Jumpscare overlay, ported from the Flutter build.**
   `src/components/JumpscareOverlay.tsx` reproduces
   `flutter_game/lib/ui/widgets/jumpscare_overlay.dart`: the same
   `phase / amp / dx / dy / tilt / zoom` math, the same radial blood gradient and
   the same `onFinished` callback. `src/App.tsx` mounts it the moment the store
   enters `gameover`, so being caught cuts to the face before the results screen.
   Styles are in `src/index.css` (`.scare*`, `.feed-plate*`).

## Run it

```bash
npm install
# copy the example environment file if you want to point at your own backend
npm run dev                 # http://localhost:5173
```

Offline mode: `VITE_OFFLINE=true npm run dev`.

The backend lives in the separate **typetorun-database** archive (MySQL schema,
seed data and the Express API both games talk to).
