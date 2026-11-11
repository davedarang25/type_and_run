// Smoke test: the app boots offline to the location menu.
// (Named widget_test.dart so `flutter create .` won't add its default counter test.)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:type_to_run/app.dart';
import 'package:type_to_run/repositories/local_repository.dart';
import 'package:type_to_run/state/game_engine.dart';

void main() {
  testWidgets('boots to the menu in offline mode', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [repositoryProvider.overrideWithValue(LocalRepository(MemoryStore()))],
      child: const TypeToRunApp(),
    ));
    await tester.pump();
    await tester.pump();
    expect(find.text('Type-to-Run'), findsOneWidget);
    expect(find.text('Old Dormitory'), findsOneWidget);
    expect(find.text('Sunken Chapel'), findsOneWidget);
  });
}
