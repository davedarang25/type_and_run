// Runs the migration + seed + RPCs against an in-process Postgres (PGlite),
// with a tiny stub of Supabase's auth schema.  Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const db = new PGlite();
const q = async (sql) => (await db.query(sql)).rows;
const fails = async (sql, msg) => assert.rejects(() => db.query(sql), new RegExp(msg));

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create table auth.session (uid uuid);
  create function auth.uid() returns uuid language sql stable as $$ select uid from auth.session limit 1 $$;
  create role anon; create role authenticated;
`);
await db.exec(read('supabase/migrations/001_schema.sql'));
await db.exec(read('supabase/seed.sql'));

// sign-up trigger creates the game profile
await db.exec(`
  insert into auth.users values ('00000000-0000-0000-0000-000000000001', 'dave@example.com', '{"username":"dave"}');
  insert into auth.session values ('00000000-0000-0000-0000-000000000001');
`);
assert.equal((await q('select username from users'))[0].username, 'dave');

assert.deepEqual(await q('select * from place_ritual_requirements(1)'), [{ item_id: 4, quantity_required: 2 }]);
assert.equal((await q('select status from start_place_session(1)'))[0].status, 'in_progress');
await fails('select * from start_place_session(2)', 'locked');

// caught: nothing banked, no completion
await q(`select * from save_session_results(1, 'caught', 40, 90, 60, '[{"item_id":4,"quantity":1}]')`);
assert.deepEqual(await q('select * from user_inventory'), []);

// exorcism without items is rejected atomically
await fails(`select * from save_session_results(1, 'exorcised', 40, 90, 60, '[{"item_id":4,"quantity":1}]')`, 'requirements');
assert.deepEqual(await q('select * from user_inventory'), []);

// extraction banks items (capped to what the place spawns), clears, unlocks next place
const ex = (await q(`select * from save_session_results(1, 'extracted', 42.5, 91, 60,
  '[{"item_id":4,"quantity":1},{"item_id":2,"quantity":9}]')`))[0];
assert.equal(ex.status, 'cleared');
assert.equal(ex.exploration_completed, true);
assert.deepEqual(await q('select item_id, quantity from user_inventory'), [{ item_id: 4, quantity: 1 }]);
assert.deepEqual(await q('select place_id, status from user_place_progress order by place_id'),
  [{ place_id: 1, status: 'cleared' }, { place_id: 2, status: 'unlocked' }]);

// exorcism consumes the 2 candles; best scores keep the max of each
const ri = (await q(`select * from save_session_results(1, 'exorcised', 38, 95, 60, '[{"item_id":4,"quantity":5}]')`))[0];
assert.equal(ri.ritual_completed, true);
assert.equal(Number(ri.best_wpm), 42.5);
assert.equal(Number(ri.best_accuracy), 95);
assert.deepEqual(await q('select item_id, quantity from user_inventory'), [{ item_id: 4, quantity: 1 }]);

const u = (await q('select total_playtime, total_locations_completed from users'))[0];
assert.deepEqual(u, { total_playtime: 180, total_locations_completed: 1 }); // the rejected call rolled back too

await fails(`select * from save_session_results(1, 'extracted', 999, 90, 1, '[]')`, 'range');
console.log('✓ schema, seed, RLS helpers and RPCs behave as specified');
