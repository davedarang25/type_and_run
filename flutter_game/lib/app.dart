import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/game_engine.dart';
import 'ui/screens/auth_screen.dart';
import 'ui/screens/menu_screen.dart';
import 'ui/screens/results_screen.dart';
import 'ui/screens/run_screen.dart';
import 'ui/theme.dart';

class TypeToRunApp extends ConsumerStatefulWidget {
  const TypeToRunApp({super.key});
  @override
  ConsumerState<TypeToRunApp> createState() => _TypeToRunAppState();
}

class _TypeToRunAppState extends ConsumerState<TypeToRunApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(gameEngineProvider.notifier).init());
  }

  @override
  Widget build(BuildContext context) {
    final phase = ref.watch(gameEngineProvider.select((s) => s.phase));
    final Widget screen = switch (phase) {
      Phase.boot || Phase.loading => Center(child: Text('CONNECTING TO STREAM…', style: label())),
      Phase.auth => const AuthScreen(),
      Phase.menu => const MenuScreen(),
      Phase.results || Phase.gameover => const ResultsScreen(),
      _ => const RunScreen(),
    };
    return MaterialApp(
      title: 'Type-to-Run',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Scaffold(body: SafeArea(child: screen)),
    );
  }
}
