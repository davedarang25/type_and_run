// ApiRepository against responses recorded from the real Express + MySQL backend
// (test/fixtures/*.json), served by package:http's MockClient.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:type_to_run/models/db.dart';
import 'package:type_to_run/repositories/api_repository.dart';
import 'package:type_to_run/repositories/game_repository.dart';
import 'package:type_to_run/repositories/local_repository.dart';

String fixture(String name) => File('test/fixtures/$name.json').readAsStringSync();

void main() {
  late List<http.Request> requests;
  late MemoryStore store;

  ApiRepository repoWith(Map<String, (int, String)> routes) {
    final client = MockClient((req) async {
      requests.add(req);
      final key = '${req.method} ${req.url.path}';
      final hit = routes[key];
      if (hit == null) return http.Response('{"error":"No route for $key"}', 404);
      return http.Response(hit.$2, hit.$1, headers: {'content-type': 'application/json'});
    });
    return ApiRepository(ApiClient('http://api.test/api/', store, client: client));
  }

  setUp(() {
    requests = [];
    store = MemoryStore();
  });

  test('login stores the token and sends it as a Bearer header', () async {
    final repo = repoWith({
      'POST /api/users/login': (200, fixture('login')),
      'GET /api/users/me': (200, fixture('me')),
    });
    expect(await repo.getPlayer(), isNull, reason: 'no token yet → sign-in screen');
    await repo.login('dave@example.com', 'secret1');
    expect(store.read('type-to-run:token'), 'TEST_TOKEN');
    expect(jsonDecode(requests.first.body), {'email': 'dave@example.com', 'password': 'secret1'});

    final player = await repo.getPlayer();
    expect(player!.username, 'dave');
    expect(player.totalLocationsCompleted, 1);
    expect(requests.last.headers['Authorization'], 'Bearer TEST_TOKEN');
  });

  test('an expired token clears itself and returns to sign-in', () async {
    await store.write('type-to-run:token', 'OLD');
    final repo = repoWith({'GET /api/users/me': (401, fixture('unauthorized'))});
    expect(await repo.getPlayer(), isNull);
    expect(store.read('type-to-run:token'), isNull);
  });

  test('parses places, place content, inventory and content lists', () async {
    await store.write('type-to-run:token', 'TEST_TOKEN');
    final repo = repoWith({
      'GET /api/game/places': (200, fixture('places')),
      'GET /api/game/places/1': (200, fixture('place_1_content')),
      'GET /api/users/me/inventory': (200, fixture('inventory')),
      'GET /api/game/items': (200, fixture('items')),
      'GET /api/game/words': (200, fixture('words')),
    });

    final places = await repo.listPlaces();
    expect(places.length, 4);
    expect(places.first.progress!.status, ProgressStatus.cleared);
    expect(places.first.progress!.bestAccuracy, 100.0);
    expect(places[1].unlocked, isTrue);
    expect(places[2].unlocked, isFalse);

    final c = await repo.getPlaceContent(1);
    expect(c.place.placeName, 'Old Dormitory');
    expect(c.ghosts.where((g) => g.isBoss).single.ghostName, 'Shadow Figure');
    expect(c.spawns.length, 3);
    expect(c.requirements.isNotEmpty, isTrue);

    expect(await repo.getInventory(), {1: 1, 4: 2});
    expect((await repo.listItems()).first.itemType, ItemType.ritualSalt);
    expect((await repo.getWordBank()).first.actionType, ActionType.movement);
  });

  test('start and save results send the right payloads', () async {
    await store.write('type-to-run:token', 'TEST_TOKEN');
    final repo = repoWith({
      'POST /api/game/places/1/start': (200, fixture('start')),
      'POST /api/game/places/1/results': (200, fixture('results')),
    });
    final start = await repo.startPlaceSession(1);
    expect(start.placeId, 1);

    final saved = await repo.saveSessionResults(const SessionResultInput(
      placeId: 1,
      outcome: SessionOutcome.exorcised,
      wpm: 41.5,
      accuracy: 97,
      playtimeSeconds: 90,
      collected: {4: 2},
    ));
    expect(saved.explorationCompleted, isTrue);
    expect(jsonDecode(requests.last.body), {
      'outcome': 'exorcised',
      'wpm': 41.5,
      'accuracy': 97.0,
      'playtimeSeconds': 90,
      'collected': [
        {'item_id': 4, 'quantity': 2},
      ],
    });
  });

  test('server errors surface the API message', () async {
    await store.write('type-to-run:token', 'TEST_TOKEN');
    final repo = repoWith({'POST /api/game/places/2/start': (403, '{"error":"Location 2 is locked"}')});
    expect(
      () => repo.startPlaceSession(2),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 403).having((e) => e.message, 'message', 'Location 2 is locked')),
    );
  });
}
