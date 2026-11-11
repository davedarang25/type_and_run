// All request handlers for the Type-to-Run API, grouped by the route file that uses them:
//   userRoutes.js  → register, login, me, getInventory          (USERS, USER_INVENTORY)
//   ghostRoutes.js → listGhosts, getGhost                       (GHOST_TYPE, GHOST_REQUIRED_ITEMS)
//   gameRoutes.js  → words, items, places, place content,       (WORD_BANK, ITEMS, HAUNTED_PLACES,
//                    ritual, start, results                      PLACE_GHOSTS, PLACE_ITEM_SPAWNS,
//                                                               USER_PLACE_PROGRESS)
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/database');
const { signToken } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const rules = require('../services/gameRules');
const rows = require('../services/rows');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idParam = (req, name) => Number(req.params[name]);

// ============================================================ users (USERS)

// POST /api/users/register  { username, email, password } → 201 { token, user }
async function register(req, res) {
  const username = String(req.body?.username || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (username.length < 3 || username.length > 40) throw new HttpError(400, 'Username must be 3–40 characters');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash]);
    const [[user]] = await pool.query('SELECT * FROM users WHERE user_id = ?', [r.insertId]);
    res.status(201).json({ token: signToken(user.user_id), user: rows.user(user) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with that email already exists');
    throw err;
  }
}

// POST /api/users/login  { email, password } → { token, user }
async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password))) throw new HttpError(401, 'Wrong email or password');
  res.json({ token: signToken(user.user_id), user: rows.user(user) });
}

// GET /api/users/me 🔒 → users row (no password)
async function me(req, res) {
  const [[user]] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.userId]);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json(rows.user(user));
}

// GET /api/users/me/inventory 🔒 → [{ item_id, quantity }]   (USER_INVENTORY)
async function getInventory(req, res) {
  const [inv] = await pool.query(
    'SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND quantity > 0 ORDER BY item_id',
    [req.userId],
  );
  res.json(inv);
}

// ======================================== ghosts (GHOST_TYPE, GHOST_REQUIRED_ITEMS)

// GET /api/ghosts → GHOST_TYPE rows
async function listGhosts(req, res) {
  const [ghosts] = await pool.query('SELECT * FROM ghost_type ORDER BY ghost_id');
  res.json(ghosts);
}

// GET /api/ghosts/:ghostId → { ...ghost, required_items: [{ item_id, item_name, item_type, quantity_required }],
//                              appears_in: [{ place_id, place_name, spawn_chance, is_boss }] }
async function getGhost(req, res) {
  const ghostId = idParam(req, 'ghostId');
  const [[ghost]] = await pool.query('SELECT * FROM ghost_type WHERE ghost_id = ?', [ghostId]);
  if (!ghost) throw new HttpError(404, `Ghost ${ghostId} not found`);
  const [requiredItems] = await pool.query(
    `SELECT i.item_id, i.item_name, i.item_type, gri.quantity_required
       FROM ghost_required_items gri JOIN items i ON i.item_id = gri.item_id
      WHERE gri.ghost_id = ? ORDER BY i.item_id`,
    [ghostId],
  );
  const [appearsIn] = await pool.query(
    `SELECT p.place_id, p.place_name, pg.spawn_chance, pg.is_boss
       FROM place_ghosts pg JOIN haunted_places p ON p.place_id = pg.place_id
      WHERE pg.ghost_id = ? ORDER BY p.place_id`,
    [ghostId],
  );
  res.json({ ...ghost, required_items: requiredItems, appears_in: appearsIn.map(rows.placeGhost) });
}

// =================================================== game content + progress

// GET /api/game/words → WORD_BANK rows
async function getWords(req, res) {
  const [words] = await pool.query('SELECT * FROM word_bank ORDER BY word_id');
  res.json(words);
}

// GET /api/game/items → ITEMS rows
async function getItems(req, res) {
  const [items] = await pool.query('SELECT * FROM items ORDER BY item_id');
  res.json(items);
}

// GET /api/game/places 🔒 → [{ place, progress | null, unlocked }]   (HAUNTED_PLACES + USER_PLACE_PROGRESS)
async function listPlaces(req, res) {
  const [places] = await pool.query('SELECT * FROM haunted_places ORDER BY place_id');
  const [progress] = await pool.query('SELECT * FROM user_place_progress WHERE user_id = ?', [req.userId]);
  const byPlace = new Map(progress.map((p) => [p.place_id, rows.progress(p)]));
  res.json(
    places.map((p) => {
      const place = rows.place(p);
      const prog = byPlace.get(place.place_id) || null;
      return { place, progress: prog, unlocked: place.is_unlocked || prog !== null };
    }),
  );
}

// GET /api/game/places/:placeId → { place, ghosts, spawns, items, requirements }
async function getPlaceContent(req, res) {
  const placeId = idParam(req, 'placeId');
  const [[place]] = await pool.query('SELECT * FROM haunted_places WHERE place_id = ?', [placeId]);
  if (!place) throw new HttpError(404, `Location ${placeId} not found`);
  const [ghosts] = await pool.query(
    `SELECT g.*, pg.spawn_chance, pg.is_boss
       FROM place_ghosts pg JOIN ghost_type g ON g.ghost_id = pg.ghost_id
      WHERE pg.place_id = ? ORDER BY pg.place_ghost_id`,
    [placeId],
  );
  const [spawns] = await pool.query('SELECT * FROM place_item_spawns WHERE place_id = ? ORDER BY spawn_id', [placeId]);
  const [items] = await pool.query('SELECT * FROM items ORDER BY item_id');
  const [requirements] = await pool.query(
    `SELECT gri.* FROM ghost_required_items gri
       JOIN place_ghosts pg ON pg.ghost_id = gri.ghost_id AND pg.place_id = ?
      ORDER BY gri.requirement_id`,
    [placeId],
  );
  res.json({ place: rows.place(place), ghosts: ghosts.map(rows.placeGhost), spawns, items, requirements });
}

// GET /api/game/places/:placeId/ritual → [{ item_id, quantity_required }] for the place's boss
async function getRitual(req, res) {
  res.json(await rules.ritualRequirements(pool, idParam(req, 'placeId')));
}

// POST /api/game/places/:placeId/start 🔒 → progress row   (flowchart: "Initialize USER_PLACE_PROGRESS")
async function startPlace(req, res) {
  res.json(await rules.startPlaceSession(pool, req.userId, idParam(req, 'placeId')));
}

// POST /api/game/places/:placeId/results 🔒  (flowchart: "Save Results")
//   { outcome: extracted|exorcised|caught, wpm, accuracy, playtimeSeconds, collected: [{ item_id, quantity }] }
//   → progress row; one transaction over USERS, USER_INVENTORY and USER_PLACE_PROGRESS
async function saveResults(req, res) {
  const placeId = idParam(req, 'placeId');
  res.json(await withTransaction((conn) => rules.saveSessionResults(conn, req.userId, placeId, req.body)));
}

module.exports = {
  // users
  register, login, me, getInventory,
  // ghosts
  listGhosts, getGhost,
  // game
  getWords, getItems, listPlaces, getPlaceContent, getRitual, startPlace, saveResults,
};
