// App-level tests. (Named widget_test.dart so `flutter create .` won't add its default counter test.)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:type_to_run/app.dart';
import 'package:type_to_run/repositories/local_repository.dart';
import 'package:type_to_run/state/game_engine.dart';
import 'package:type_to_run/ui/widgets/typing_input.dart';

Widget _app() => ProviderScope(
      overrides: [
        repositoryProvider.overrideWithValue(LocalRepository(MemoryStore())),
        rngProvider.overrideWithValue(() => 0.99), // no ghosts, no items: a predictable run
      ],
      child: const TypeToRunApp(),
    );

void main() {
  testWidgets('boots to the menu in offline mode', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pump();
    await tester.pump();
    expect(find.text('Type-to-Run'), findsOneWidget);
    expect(find.text('Old Dormitory'), findsOneWidget);
    expect(find.text('Sunken Chapel'), findsOneWidget);
  });

  testWidgets('typing keeps working in the next game without tapping the screen', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app());
    await tester.pump();
    await tester.pump();
    final container = ProviderScope.containerOf(tester.element(find.byType(TypeToRunApp)));
    GameEngineState st() => container.read(gameEngineProvider);
    bool inputFocused() => tester.widget<TextField>(find.byKey(TypingInput.fieldKey)).focusNode!.hasFocus;

    Future<void> settle() async {
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    // Like a real keyboard: one character at a time into the focused hidden field.
    // enterText throws if the field isn't focused/connected — exactly the bug we guard against.
    Future<void> type(String text) async {
      for (final ch in text.split('')) {
        tester.testTextInput.enterText(ch);
        await tester.pump();
      }
    }

    Future<void> playOneRun(String label) async {
      expect(inputFocused(), isTrue, reason: '$label: typing should be armed without a tap');
      for (var i = 0; i < 3; i++) {
        await type(st().prompt!.options.first);
      }
      expect(st().phase, Phase.decision, reason: label);
      await type('wrap up');
      await type('go home');
      await settle();
      expect(st().phase, Phase.results, reason: label);
      expect(inputFocused(), isTrue, reason: '$label: results screen should accept typing');
    }

    await tester.tap(find.text('Old Dormitory'));
    await settle();
    await playOneRun('game 1');

    await type('retry'); // continue straight into the next game
    await settle();
    expect(st().phase, Phase.exploring);
    await playOneRun('game 2 (retry)');

    await type('menu'); // back to the menu, pick the place again
    await settle();
    expect(st().phase, Phase.menu);
    await tester.tap(find.text('Old Dormitory'));
    await settle();
    await playOneRun('game 3 (from menu)');

    await tester.pumpWidget(const SizedBox()); // dispose timers/tickers
  });
}
