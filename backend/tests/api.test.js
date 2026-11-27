// End-to-end API tests against a real MySQL/MariaDB database.
// Uses TEST_DB_NAME (default type_and_run_test) — it is DROPPED and recreated.
// Run: npm test   (needs DB_HOST/DB_USER/DB_PASSWORD in .env or the environment)
process.env.DB_NAME = process.env.TEST_DB_NAME || 'type_and_run_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { resetDb } = require('../scripts/resetDb');
const app = require('../server');
const { pool } = require('../config/database');

const api = request(app);
let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

before(async () => {
  await resetDb(process.env.DB_NAME);
});
after(async () => {
  await pool.end();
});

test('health', async () => {
  const res = await api.get('/api/health');
  assert.equal(res.status, 200);
});

test('register, duplicate, validation, login, me', async () => {
  const reg = await api.post('/api/users/register').send({ username: 'dave', email: 'Dave@Example.com', password: 'secret1' });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.email, 'dave@example.com');
  assert.equal(reg.body.user.password, undefined, 'password hash must never be returned');

  const [[row]] = await pool.query('SELECT password FROM users WHERE email = ?', ['dave@example.com']);
  assert.match(row.password, /^\$2[aby]\$/, 'stored as a bcrypt hash');

  assert.equal((await api.post('/api/users/register').send({ username: 'dave2', email: 'dave@example.com', password: 'secret1' })).status, 409);
  assert.equal((await api.post('/api/users/register').send({ username: 'x', email: 'bad', password: '1' })).status, 400);
  assert.equal((await api.post('/api/users/login').send({ email: 'dave@example.com', password: 'nope' })).status, 401);

  const login = await api.post('/api/users/login').send({ email: 'dave@example.com', password: 'secret1' });
  assert.equal(login.status, 200);
  token = login.body.token;

  assert.equal((await api.get('/api/users/me')).status, 401);
  assert.equal((await api.get('/api/users/me').set('Authorization', 'Bearer garbage')).status, 401);
  const me = await api.get('/api/users/me').set(auth());
  assert.equal(me.body.username, 'dave');
});

test('content endpoints', async () => {
  const words = await api.get('/api/game/words');
  assert.ok(words.body.length > 50);
  assert.deepEqual(Object.keys(words.body[0]).sort(), ['action_type', 'difficulty', 'time_limit', 'word', 'word_id']);
  assert.equal((await api.get('/api/game/items')).body.length, 5);

  const c = await api.get('/api/game/places/1');
  assert.equal(c.status, 200);
  assert.equal(c.body.place.is_unlocked, true);
  assert.equal(c.body.ghosts.length, 2);
  assert.equal(c.body.ghosts.find((g) => g.is_boss === true).ghost_name, 'Shadow Figure');
  assert.equal(c.body.spawns.length, 3);
  assert.deepEqual((await api.get('/api/game/places/1/ritual')).body, [{ item_id: 4, quantity_required: 2 }]);
  assert.equal((await api.get('/api/game/places/99')).status, 404);
});

test('only the starter place is unlocked; locked places refuse to start', async () => {
  const places = await api.get('/api/game/places').set(auth());
  assert.deepEqual(places.body.filter((p) => p.unlocked).map((p) => p.place.place_id), [1]);
  assert.equal((await api.post('/api/game/places/2/start').set(auth())).status, 403);
  const start = await api.post('/api/game/places/1/start').set(auth());
  assert.equal(start.body.status, 'in_progress');
  assert.equal(start.body.exploration_completed, false);
});

const save = (placeId, body) => api.post(`/api/game/places/${placeId}/results`).set(auth()).send(body);
const inventory = async () => (await api.get('/api/users/me/inventory').set(auth())).body;
const totals = async () => (await api.get('/api/users/me').set(auth())).body;

test('caught: playtime recorded, items lost, nothing completed', async () => {
  const r = await save(1, { outcome: 'caught', wpm: 40, accuracy: 90, playtimeSeconds: 60, collected: [{ item_id: 4, quantity: 1 }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.exploration_completed, false);
  assert.deepEqual(await inventory(), []);
  assert.equal((await totals()).total_playtime, 60);
});

test('exorcism without items is rejected and fully rolled back', async () => {
  const r = await save(1, { outcome: 'exorcised', wpm: 40, accuracy: 90, playtimeSeconds: 60, collected: [{ item_id: 4, quantity: 1 }] });
  assert.equal(r.status, 409);
  assert.deepEqual(await inventory(), []);
  assert.equal((await totals()).total_playtime, 60, 'playtime update rolled back too');
});

test('extracted: banks items (capped to the place), clears it, unlocks the next place', async () => {
  const r = await save(1, {
    outcome: 'extracted', wpm: 42.5, accuracy: 91, playtimeSeconds: 60,
    collected: [{ item_id: 4, quantity: 1 }, { item_id: 2, quantity: 9 }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'cleared');
  assert.equal(r.body.exploration_completed, true);
  assert.equal(r.body.best_wpm, 42.5);
  assert.deepEqual(await inventory(), [{ item_id: 4, quantity: 1 }]);
  const places = (await api.get('/api/game/places').set(auth())).body;
  assert.equal(places.find((p) => p.place.place_id === 2).unlocked, true);
  assert.equal(places.find((p) => p.place.place_id === 2).progress.status, 'unlocked');
  assert.equal((await api.post('/api/game/places/2/start').set(auth())).status, 200);
});

test('exorcised: consumes the ritual items and keeps best scores as maxima', async () => {
  const r = await save(1, { outcome: 'exorcised', wpm: 38, accuracy: 95, playtimeSeconds: 60, collected: [{ item_id: 4, quantity: 5 }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.ritual_completed, true);
  assert.equal(r.body.best_wpm, 42.5);
  assert.equal(r.body.best_accuracy, 95);
  assert.deepEqual(await inventory(), [{ item_id: 4, quantity: 1 }]); // 1 + min(5, cap 2) − 2
  const me = await totals();
  assert.equal(me.total_playtime, 180);
  assert.equal(me.total_locations_completed, 1, 'only the first clear counts');
});

test('ghost catalogue', async () => {
  const all = await api.get('/api/ghosts');
  assert.equal(all.body.length, 6);
  const g = await api.get('/api/ghosts/6');
  assert.equal(g.body.ghost_name, 'Manananggal');
  assert.deepEqual(g.body.required_items.map((i) => [i.item_name, i.quantity_required]), [
    ['Sea Salt Pouch', 3], ['Rosary', 1], ['Agimat Amulet', 1],
  ]);
  assert.deepEqual(g.body.appears_in, [{ place_id: 4, place_name: 'Sunken Chapel', spawn_chance: 30, is_boss: true }]);
  assert.equal((await api.get('/api/ghosts/99')).status, 404);
});

test('validation and isolation', async () => {
  assert.equal((await save(1, { outcome: 'won', wpm: 1, accuracy: 1 })).status, 400);
  assert.equal((await save(1, { outcome: 'extracted', wpm: 999, accuracy: 50 })).status, 400);
  assert.equal((await save(3, { outcome: 'extracted', wpm: 30, accuracy: 50 })).status, 403);
  assert.equal((await api.post('/api/game/places/1/results').send({ outcome: 'caught', wpm: 1, accuracy: 1 })).status, 401);

  const other = await api.post('/api/users/register').send({ username: 'mira', email: 'mira@example.com', password: 'secret2' });
  const theirs = await api.get('/api/users/me/inventory').set('Authorization', `Bearer ${other.body.token}`);
  assert.deepEqual(theirs.body, [], "another player's inventory is not visible");
});

test('CORS: local dev origins on any port are allowed, others are not', async () => {
  for (const origin of ['http://localhost:5173', 'http://localhost:61234', 'http://192.168.1.20:5173']) {
    const res = await api.get('/api/health').set('Origin', origin);
    assert.equal(res.headers['access-control-allow-origin'], origin);
  }
  const blocked = await api.get('/api/health').set('Origin', 'https://evil.example.com');
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);
});
