# Type-to-Run — React game

React 18 + TypeScript, **Zustand**, Tailwind v4, Vite. See the [root README](../README.md) for the game design and the [backend README](../backend/README.md) for the API.

```bash
npm install
npm run dev            # http://localhost:5173. Connects to http://localhost:3000/api automatically
npm test               # engine + full game-flow tests (vitest)
npm run content        # regenerate ../backend/database/seed.sql and ../flutter_game/lib/data/seed.g.dart
npm run build          # production build → dist/
npm run build:demo     # single self-contained offline HTML → dist-demo/index.html
```

The game connects to port 3000 on the same host that serves it, so it needs no configuration. Set `VITE_API_URL` in `.env` only if the backend runs somewhere else, or `VITE_OFFLINE=true` to play without one. The login token is kept in `localStorage`, and progress saves to your account in MySQL.

```
src/
  types/db.ts               row types for all 10 tables
  data/seed.ts              ★ game content (source for the backend seed and the Flutter copy)
  engine/                   pure rules: typing, wordGenerator, ghostAI, ritual, rng
  store/gameEngine.ts       GameEngineState (Zustand vanilla store, injectable repo/rng/clock)
  lib/api.ts                fetch wrapper + token storage
  repositories/             GameRepository interface; ApiRepository (backend) and LocalRepository (offline)
  components/ screens/      UI
  __tests__/                engine + game-flow tests
scripts/gen-content.ts      content generator
```
