import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'repositories/api_repository.dart';
import 'repositories/game_repository.dart';
import 'repositories/local_repository.dart';
import 'repositories/shared_prefs_store.dart';
import 'state/game_engine.dart';

/// The game connects to the backend by default (see [defaultApiUrl]).
///   Different server:  flutter run --dart-define=API_URL=http://192.168.1.20:3000/api
///   No server at all:  flutter run --dart-define=OFFLINE=true
const _apiUrlOverride = String.fromEnvironment('API_URL');
const _offline = bool.fromEnvironment('OFFLINE');

/// Where the backend is when nobody says otherwise:
///   web               → port 3000 on the host serving the page (localhost or your LAN IP)
///   Android emulator  → 10.0.2.2 is the emulator's alias for your computer
///   macOS/Windows/Linux/iOS simulator → localhost
/// A real phone needs --dart-define=API_URL=http://<your computer's LAN IP>:3000/api
String defaultApiUrl() {
  if (kIsWeb) return '${Uri.base.scheme}://${Uri.base.host}:3000/api';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:3000/api';
  return 'http://localhost:3000/api';
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = await SharedPrefsStore.create();

  final GameRepository repo = _offline
      ? LocalRepository(store)
      : ApiRepository(ApiClient(_apiUrlOverride.isNotEmpty ? _apiUrlOverride : defaultApiUrl(), store));

  runApp(ProviderScope(
    overrides: [repositoryProvider.overrideWithValue(repo)],
    child: const TypeToRunApp(),
  ));
}
