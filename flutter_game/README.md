# Type-to-Run — Flutter client

Flutter + **Riverpod** (`Notifier`), `supabase_flutter`, `shared_preferences`. It targets Android, iOS, Web, Windows, macOS and Linux. See the [root README](../README.md) for the game design, state machine and database.

## First run

This folder has the app code (`lib/`, `test/`, `pubspec.yaml`) but not the per-platform folders. Generate them once. Existing files are kept:

```bash
flutter create . --project-name type_to_run
flutter pub get
flutter test            # engine, full game flow, and an app smoke test
flutter analyze
flutter run -d chrome   # or -d windows / macos / linux, or a phone/emulator
```

Requires Flutter ≥ 3.27, because the code uses `Color.withValues`.

## Supabase

Credentials are passed at build time. Leave them out for offline mode:

```bash
flutter run --dart-define=SUPABASE_URL=https://xyz.supabase.co --dart-define=SUPABASE_ANON_KEY=eyJ...
```

For release builds, allow network access:
- **Android:** add `<uses-permission android:name="android.permission.INTERNET"/>` to `android/app/src/main/AndroidManifest.xml`.
- **macOS:** add `com.apple.security.network.client` = `true` to both `.entitlements` files in `macos/Runner/`.

## Layout

```
lib/
  main.dart                  picks SupabaseRepository or LocalRepository, overrides repositoryProvider
  app.dart                   phase → screen
  models/db.dart             row classes for all 10 tables (+ fromJson)
  data/seed.g.dart           GENERATED from react/src/data/seed.ts (cd ../react && npm run content)
  engine/                    pure rules: typing, word_generator, ghost_ai, ritual, rng
  state/game_engine.dart     GameEngineState + GameEngine Notifier (repo/rng/clock via providers)
  repositories/              GameRepository interface, Supabase + offline implementations
  ui/                        theme, screens (menu, run, results, auth), widgets
test/
  engine_test.dart           same cases as react/src/__tests__/engine.test.ts
  game_flow_test.dart        same cases as react/src/__tests__/gameFlow.test.ts
  widget_test.dart           app boots to the menu
```

Typing works with physical keyboards and on-screen keyboards. `TypingInput` keeps an invisible, autocorrect-free text field focused and forwards each character to `GameEngine.pressKey`. On mobile, tap the screen to bring the keyboard back.
