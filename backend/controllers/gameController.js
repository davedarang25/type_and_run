
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/database');
const { signToken } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const rules = require('../services/gameRules');
const rows = require('../services/rows');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idParam = (req, name) => Number(req.params[name]);

// ============================================================
// USERS

async function register(req, res) {
  const username = String(req.body?.username || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (username.length < 3 || username.length > 40) {
    throw new HttpError(400, 'Username must be 3–40 characters');
  }

  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, 'Enter a valid email address');
  }

  if (password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, hash]
    );

    const user = result.rows[0];

    res.status(201).json({
      token: signToken(user.user_id),
      user: rows.user(user),
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new HttpError(409, 'An account with that email already exists');
    }

    throw err;
  }
}

async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, 'Wrong email or password');
  }

  res.json({
    token: signToken(user.user_id),
    user: rows.user(user),
  });
}

async function me(req, res) {
  const result = await pool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [req.userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new HttpError(401, 'Account no longer exists');
  }

  res.json(rows.user(user));
}

async function getInventory(req, res) {
  const result = await pool.query(
    `SELECT item_id, quantity
       FROM user_inventory
      WHERE user_id = $1 AND quantity > 0
      ORDER BY item_id`,
    [req.userId]
  );

  res.json(result.rows);
}

// ============================================================
// GHOSTS

async function listGhosts(req, res) {
  const result = await pool.query(
    'SELECT * FROM ghost_type ORDER BY ghost_id'
  );

  res.json(result.rows);
}

async function getGhost(req, res) {
  const ghostId = idParam(req, 'ghostId');

  const ghostResult = await pool.query(
    'SELECT * FROM ghost_type WHERE ghost_id = $1',
    [ghostId]
  );

  const ghost = ghostResult.rows[0];

  if (!ghost) {
    throw new HttpError(404, `Ghost ${ghostId} not found`);
  }

  const requiredItemsResult = await pool.query(
    `SELECT i.item_id, i.item_name, i.item_type, gri.quantity_required
       FROM ghost_required_items gri
       JOIN items i ON i.item_id = gri.item_id
      WHERE gri.ghost_id = $1
      ORDER BY i.item_id`,
    [ghostId]
  );

  const appearsInResult = await pool.query(
    `SELECT p.place_id, p.place_name, pg.spawn_chance, pg.is_boss
       FROM place_ghosts pg
       JOIN haunted_places p ON p.place_id = pg.place_id
      WHERE pg.ghost_id = $1
      ORDER BY p.place_id`,
    [ghostId]
  );

  res.json({
    ...ghost,
    required_items: requiredItemsResult.rows,
    appears_in: appearsInResult.rows.map(rows.placeGhost),
  });
}

// ============================================================
// GAME CONTENT AND PROGRESS

async function getWords(req, res) {
  const result = await pool.query(
    'SELECT * FROM word_bank ORDER BY word_id'
  );

  res.json(result.rows);
}

async function getItems(req, res) {
  const result = await pool.query(
    'SELECT * FROM items ORDER BY item_id'
  );

  res.json(result.rows);
}

async function listPlaces(req, res) {
  const placesResult = await pool.query(
    'SELECT * FROM haunted_places ORDER BY place_id'
  );

  const progressResult = await pool.query(
    'SELECT * FROM user_place_progress WHERE user_id = $1',
    [req.userId]
  );

  const byPlace = new Map(
    progressResult.rows.map((p) => [
      p.place_id,
      rows.progress(p),
    ])
  );

  const response = placesResult.rows.map((p) => {
    const place = rows.place(p);
    const progress = byPlace.get(place.place_id) || null;

    return {
      place,
      progress,
      unlocked: place.is_unlocked || progress !== null,
    };
  });

  res.json(response);
}

async function getPlaceContent(req, res) {
  const placeId = idParam(req, 'placeId');

  const placeResult = await pool.query(
    'SELECT * FROM haunted_places WHERE place_id = $1',
    [placeId]
  );

  const place = placeResult.rows[0];

  if (!place) {
    throw new HttpError(404, `Location ${placeId} not found`);
  }

  const ghostsResult = await pool.query(
    `SELECT g.*, pg.spawn_chance, pg.is_boss
       FROM place_ghosts pg
       JOIN ghost_type g ON g.ghost_id = pg.ghost_id
      WHERE pg.place_id = $1
      ORDER BY pg.place_ghost_id`,
    [placeId]
  );

  const spawnsResult = await pool.query(
    `SELECT *
       FROM place_item_spawns
      WHERE place_id = $1
      ORDER BY spawn_id`,
    [placeId]
  );

  const itemsResult = await pool.query(
    'SELECT * FROM items ORDER BY item_id'
  );

  const requirementsResult = await pool.query(
    `SELECT gri.*
       FROM ghost_required_items gri
       JOIN place_ghosts pg
         ON pg.ghost_id = gri.ghost_id
        AND pg.place_id = $1
      ORDER BY gri.requirement_id`,
    [placeId]
  );

  res.json({
    place: rows.place(place),
    ghosts: ghostsResult.rows.map(rows.placeGhost),
    spawns: spawnsResult.rows,
    items: itemsResult.rows,
    requirements: requirementsResult.rows,
  });
}

async function getRitual(req, res) {
  const result = await rules.ritualRequirements(
    pool,
    idParam(req, 'placeId')
  );

  res.json(result);
}

async function startPlace(req, res) {
  const progress = await rules.startPlaceSession(
    pool,
    req.userId,
    idParam(req, 'placeId')
  );

  res.json(progress);
}

async function saveResults(req, res) {
  const placeId = idParam(req, 'placeId');

  const progress = await withTransaction((client) =>
    rules.saveSessionResults(
      client,
      req.userId,
      placeId,
      req.body
    )
  );

  res.json(progress);
}

module.exports = {
  register,
  login,
  me,
  getInventory,
  listGhosts,
  getGhost,
  getWords,
  getItems,
  listPlaces,
  getPlaceContent,
  getRitual,
  startPlace,
  saveResults,
};
