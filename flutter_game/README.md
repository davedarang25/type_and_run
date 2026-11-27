# Type-to-Run — Flutter client

Flutter + **Riverpod** (`Notifier`), `http`, `shared_preferences`. It targets Android, iOS, Web, Windows, macOS and Linux. See the [root README](../README.md) for the game design and the [backend README](../backend/README.md) for the API.

## First run (macOS)

```bash
bash tool/setup.sh      # generates platform folders + enables network access (macOS, Android, iOS)
flutter test            # engine, full game flow, API client, app smoke test
flutter analyze
flutter run -d macos    # or -d chrome, or an emulator. Start the backend first: cd ../backend && npm run dev
```

Requires Flutter ≥ 3.27. Commit the generated platform folders so teammates don't have to run the setup themselves.

## Connecting to the backend

It connects automatically. `defaultApiUrl()` in `lib/main.dart` picks the right address:

| Platform | Backend address |
|---|---|
| web | `http://<host serving the page>:3000/api` |
| macOS, Windows, Linux, iOS simulator | `http://localhost:3000/api` |
| Android emulator | `http://10.0.2.2:3000/api` |
| real phone | `flutter run --dart-define=API_URL=http://<your Mac's LAN IP>:3000/api` |

Play without a server: `flutter run --dart-define=OFFLINE=true`.

`tool/setup.sh` makes these one-time platform changes:
- **macOS:** adds the `com.apple.security.network.client` entitlement. Without it, the app sandbox blocks all network calls and sign-in fails with "Can't reach the game server".
- **Android:** adds the `INTERNET` permission and allows plain `http://` to the dev backend.
- **iOS:** allows plain `http://` to local addresses.

## Layout

```
lib/
  main.dart                  ApiRepository (default; API_URL overrides) or LocalRepository (OFFLINE=true)
  app.dart                   phase → screen
  models/db.dart             row classes for all 10 tables (+ fromJson)
  data/seed.g.dart           GENERATED from react_game/src/data/seed.ts (cd ../react_game && npm run content)
  engine/                    pure rules: typing, word_generator, ghost_ai, ritual, rng
  state/game_engine.dart     GameEngineState + GameEngine Notifier (repo/rng/clock via providers)
  repositories/              GameRepository interface; ApiRepository (backend, package:http) and LocalRepository (offline)
  ui/                        theme, screens (menu, run, results, auth), widgets
test/
  engine_test.dart           same cases as react_game/src/__tests__/engine.test.ts
  game_flow_test.dart        same cases as react_game/src/__tests__/gameFlow.test.ts
  api_repository_test.dart   ApiRepository against responses recorded from the real backend (fixtures/)
  widget_test.dart           app boots to the menu
```

Typing works with physical keyboards and on-screen keyboards. A single `TypingInput`, mounted once in `app.dart` above every screen, keeps an invisible, autocorrect-free text field focused and forwards each character to `GameEngine.pressKey`. It takes focus back on every new prompt or phase, when the app returns to the foreground, and if anything steals it. So the next game accepts letters right away, without tapping the screen. `test/widget_test.dart` plays three games in a row to guard this.
