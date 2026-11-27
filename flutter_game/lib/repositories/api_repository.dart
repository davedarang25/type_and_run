// Online backend: the Express + MySQL REST API in ../backend.
// Same endpoints and behaviour as react_game/src/repositories/apiRepository.ts.
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/db.dart';
import 'game_repository.dart';
import 'local_repository.dart' show KeyValueStore;

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status; // 0 = server unreachable
  final String message;
  @override
  String toString() => message;
}

/// Thin JSON client; keeps the login token in a [KeyValueStore] (SharedPreferences in the app).
class ApiClient {
  ApiClient(String baseUrl, this._store, {http.Client? client})
      : baseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl,
        _http = client ?? http.Client(),
        _token = _store.read(_tokenKey);

  static const _tokenKey = 'type-to-run:token';
  final String baseUrl;
  final KeyValueStore _store;
  final http.Client _http;
  String? _token;

  bool get signedIn => _token != null;

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _store.remove(_tokenKey);
    } else {
      await _store.write(_tokenKey, token);
    }
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = {
      if (body != null) 'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
    http.Response res;
    try {
      res = method == 'GET'
          ? await _http.get(uri, headers: headers)
          : await _http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body));
    } catch (_) {
      throw ApiException(0, "Can't reach the game server at $baseUrl. Is the backend running?");
    }
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      data = null;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = data is Map && data['error'] is String ? data['error'] as String : 'Request failed (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return data;
  }
}

List<Map<String, dynamic>> _list(dynamic data) =>
    (data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();

Map<String, dynamic> _map(dynamic data) => Map<String, dynamic>.from(data as Map);

class ApiRepository implements GameRepository {
  ApiRepository(this._api);
  final ApiClient _api;
  List<WordBankRow>? _words;
  List<Item>? _items;

  @override
  String get mode => 'api';

  // ---- auth (USERS) ----
  Future<void> login(String email, String password) async {
    final r = _map(await _api.post('/users/login', {'email': email, 'password': password}));
    await _api.setToken(r['token'] as String);
  }

  Future<void> register(String username, String email, String password) async {
    final r = _map(await _api.post('/users/register', {'username': username, 'email': email, 'password': password}));
    await _api.setToken(r['token'] as String);
  }

  Future<void> logout() => _api.setToken(null);

  @override
  Future<PlayerSummary?> getPlayer() async {
    if (!_api.signedIn) return null;
    try {
      final u = UserRow.fromJson(_map(await _api.get('/users/me')));
      return PlayerSummary(
          username: u.username, totalPlaytime: u.totalPlaytime, totalLocationsCompleted: u.totalLocationsCompleted);
    } on ApiException catch (e) {
      if (e.status == 401) {
        await _api.setToken(null); // expired or invalid → show sign-in
        return null;
      }
      rethrow;
    }
  }

  // ---- content ----
  @override
  Future<List<Item>> listItems() async =>
      _items ??= _list(await _api.get('/game/items')).map(Item.fromJson).toList();

  @override
  Future<List<WordBankRow>> getWordBank() async =>
      _words ??= _list(await _api.get('/game/words')).map(WordBankRow.fromJson).toList();

  @override
  Future<PlaceContent> getPlaceContent(int placeId) async {
    final j = _map(await _api.get('/game/places/$placeId'));
    return PlaceContent(
      place: HauntedPlace.fromJson(_map(j['place'])),
      ghosts: _list(j['ghosts']).map(PlaceGhost.fromJson).toList(),
      spawns: _list(j['spawns']).map(PlaceItemSpawn.fromJson).toList(),
      items: _list(j['items']).map(Item.fromJson).toList(),
      requirements: _list(j['requirements']).map(GhostRequiredItem.fromJson).toList(),
    );
  }

  // ---- USER_PLACE_PROGRESS ----
  @override
  Future<List<PlaceCard>> listPlaces() async => [
        for (final c in _list(await _api.get('/game/places')))
          PlaceCard(
            place: HauntedPlace.fromJson(_map(c['place'])),
            progress: c['progress'] == null ? null : UserPlaceProgress.fromJson(_map(c['progress'])),
            unlocked: c['unlocked'] as bool,
          ),
      ];

  @override
  Future<UserPlaceProgress> startPlaceSession(int placeId) async =>
      UserPlaceProgress.fromJson(_map(await _api.post('/game/places/$placeId/start')));

  @override
  Future<UserPlaceProgress> saveSessionResults(SessionResultInput input) async {
    final res = await _api.post('/game/places/${input.placeId}/results', {
      'outcome': input.outcome.name,
      'wpm': input.wpm,
      'accuracy': input.accuracy,
      'playtimeSeconds': input.playtimeSeconds,
      'collected': [
        for (final e in input.collected.entries) {'item_id': e.key, 'quantity': e.value},
      ],
    });
    return UserPlaceProgress.fromJson(_map(res));
  }

  // ---- USER_INVENTORY ----
  @override
  Future<ItemQuantities> getInventory() async => {
        for (final r in _list(await _api.get('/users/me/inventory'))) r['item_id'] as int: r['quantity'] as int,
      };
}
