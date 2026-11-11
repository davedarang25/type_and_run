// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'repositories/game_repository.dart';
import 'repositories/local_repository.dart';
import 'repositories/shared_prefs_store.dart';
import 'repositories/supabase_repository.dart';
import 'state/game_engine.dart';

/// Pass credentials at build time to use Supabase; omit them for offline mode:
///   flutter run --dart-define=SUPABASE_URL=https://xyz.supabase.co --dart-define=SUPABASE_ANON_KEY=...
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final GameRepository repo;
  if (supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
    repo = SupabaseRepository(Supabase.instance.client);
  } else {
    repo = LocalRepository(await SharedPrefsStore.create());
  }

  runApp(ProviderScope(
    overrides: [repositoryProvider.overrideWithValue(repo)],
    child: const TypeToRunApp(),
  ));
}
