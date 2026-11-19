import { defineConfig } from 'vitest/config';

// Game-logic tests only (engine + state machine) — no React Native needed.
export default defineConfig({
  test: { include: ['src/__tests__/**/*.test.ts'], environment: 'node' },
});
