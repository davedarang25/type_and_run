# Type-to-Run — React client

React 18 + TypeScript, **Zustand**, Tailwind v4, Vite. See the [root README](../README.md) for the game design, state machine and database.

```bash
npm install
npm run dev          # offline mode at http://localhost:5173 (no .env needed)
npm test             # engine + full game-flow tests (vitest)
npm run test:db      # ../supabase migration + seed + RPCs against an in-process Postgres (PGlite)
npm run content      # regenerate ../supabase/seed.sql and ../flutter/lib/data/seed.g.dart from src/data/seed.ts
npm run build        # production build → dist/
npm run build:demo   # single self-contained HTML → dist-demo/index.html (always offline)
```

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to use Supabase. A sign-in screen appears, and a database trigger creates the `users` row on sign-up.

```
src/
  types/db.ts               row types for all 10 tables
  data/seed.ts              ★ game content (single source of truth for both clients)
  engine/                   pure rules: typing, wordGenerator, ghostAI, ritual, rng
  store/gameEngine.ts       GameEngineState (Zustand vanilla store, injectable repo/rng/clock)
  repositories/             interfaces + Supabase and offline (localStorage) implementations
  components/ screens/      UI
  __tests__/                engine + game-flow tests
scripts/                    content generator, embedded-Postgres DB test
```
