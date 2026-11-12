// Server-side game rules. Mirrors react_game/src/repositories/rules.ts and
// flutter_game/lib/repositories/rules.dart so online and offline play behave the same.
const { HttpError } = require('../middleware/errors');
const rows = require('./rows');

const OUTCOMES = ['extracted', 'exorcised', 'caught'];

/** Items needed to exorcise a place: its boss ghost(s), or every ghost if there is no boss. */
async function ritualRequirements(db, placeId) {
  const [result] = await db.query(
    `SELECT gri.item_id, CAST(SUM(gri.quantity_required) AS SIGNED) AS quantity_required
       FROM ghost_required_items gri
       JOIN place_ghosts pg ON pg.ghost_id = gri.ghost_id AND pg.place_id = ?
      WHERE pg.is_boss
         OR NOT EXISTS (SELECT 1 FROM place_ghosts b WHERE b.place_id = ? AND b.is_boss)
      GROUP BY gri.item_id
      ORDER BY gri.item_id`,
    [placeId, placeId],
  );
  return result;
}

/** 404 if the place doesn't exist, 403 if this player hasn't unlocked it. */
async function assertPlaceUnlocked(db, userId, placeId) {
  const [[place]] = await db.query('SELECT place_id, is_unlocked FROM haunted_places WHERE place_id = ?', [placeId]);
  if (!place) throw new HttpError(404, `Location ${placeId} not found`);
  if (rows.bool(place.is_unlocked)) return;
  const [[p]] = await db.query('SELECT 1 AS ok FROM user_place_progress WHERE user_id = ? AND place_id = ?', [userId, placeId]);
  if (!p) throw new HttpError(403, `Location ${placeId} is locked`);
}

async function getProgress(db, userId, placeId, forUpdate = false) {
  const [[r]] = await db.query(
    `SELECT * FROM user_place_progress WHERE user_id = ? AND place_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [userId, placeId],
  );
  return rows.progress(r);
}

/** Flowchart "Initialize USER_PLACE_PROGRESS": mark the place in_progress (cleared stays cleared). */
async function startPlaceSession(db, userId, placeId) {
  await assertPlaceUnlocked(db, userId, placeId);
  await db.query(
    `INSERT INTO user_place_progress (user_id, place_id, status) VALUES (?, ?, 'in_progress')
     ON DUPLICATE KEY UPDATE status = IF(status = 'cleared', 'cleared', 'in_progress')`,
    [userId, placeId],
  );
  return getProgress(db, userId, placeId);
}

function validateResults(body) {
  const { outcome, wpm, accuracy, playtimeSeconds, collected = [] } = body || {};
  if (!OUTCOMES.includes(outcome)) throw new HttpError(400, `outcome must be one of ${OUTCOMES.join(', ')}`);
  if (typeof wpm !== 'number' || wpm < 0 || wpm > 400) throw new HttpError(400, 'wpm must be a number from 0 to 400');
  if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) throw new HttpError(400, 'accuracy must be a number from 0 to 100');
  if (!Array.isArray(collected)) throw new HttpError(400, 'collected must be an array of { item_id, quantity }');
  const items = collected.map((c) => ({ item_id: Number(c?.item_id), quantity: Number(c?.quantity) }));
  if (items.some((c) => !Number.isInteger(c.item_id) || !Number.isInteger(c.quantity) || c.quantity < 0)) {
    throw new HttpError(400, 'collected entries need integer item_id and quantity');
  }
  return {
    outcome,
    wpm: Math.round(wpm * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    playtimeSeconds: Math.max(0, Math.round(Number(playtimeSeconds) || 0)),
    collected: items,
  };
}

/**
 * Flowchart "Save Results" — one transaction:
 *   always: add playtime
 *   extracted/exorcised: bank collected items (capped at what the place spawns),
 *     exorcised: re-check ritual requirements server-side and consume the items,
 *     set cleared / exploration_completed / ritual_completed, keep best WPM & accuracy,
 *     first clear: bump total_locations_completed and unlock the next place.
 *   caught: nothing else (session items are lost).
 */
async function saveSessionResults(conn, userId, placeId, body) {
  const input = validateResults(body);
  await assertPlaceUnlocked(conn, userId, placeId);

  // Record this gameplay session.
  await conn.query(
    `INSERT INTO game_sessions
      (user_id, place_id, outcome, wpm, accuracy, playtime_seconds)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      placeId,
      input.outcome,
      input.wpm,
      input.accuracy,
      input.playtimeSeconds
    ]
  );

  // Locks this player's row, so two saves from the same player run one after the other.
  await conn.query('UPDATE users SET total_playtime = total_playtime + ? WHERE user_id = ?', [input.playtimeSeconds, userId]);
  await conn.query(
    `INSERT INTO user_place_progress (user_id, place_id, status) VALUES (?, ?, 'in_progress')
     ON DUPLICATE KEY UPDATE progress_id = progress_id`,
    [userId, placeId],
  );
  if (input.outcome === 'caught') return getProgress(conn, userId, placeId);

  // Bank collected items, capped at what the place can spawn.
  const [caps] = await conn.query(
    'SELECT item_id, CAST(SUM(quantity_available) AS SIGNED) AS cap FROM place_item_spawns WHERE place_id = ? GROUP BY item_id',
    [placeId],
  );
  const capOf = new Map(caps.map((c) => [c.item_id, c.cap]));
  const totals = new Map();
  for (const c of input.collected) totals.set(c.item_id, (totals.get(c.item_id) || 0) + c.quantity);
  for (const [itemId, qty] of totals) {
    const n = Math.min(qty, capOf.get(itemId) || 0);
    if (n <= 0) continue;
    await conn.query(
      `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [userId, itemId, n, n],
    );
  }

  if (input.outcome === 'exorcised') {
    const required = await ritualRequirements(conn, placeId);
    const [owned] = await conn.query('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? FOR UPDATE', [userId]);
    const have = new Map(owned.map((o) => [o.item_id, o.quantity]));
    if (required.some((r) => (have.get(r.item_id) || 0) < r.quantity_required)) {
      throw new HttpError(409, 'Ritual requirements not met');
    }
    for (const r of required) {
      await conn.query('UPDATE user_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?', [
        r.quantity_required, userId, r.item_id,
      ]);
    }
    await conn.query('DELETE FROM user_inventory WHERE user_id = ? AND quantity = 0', [userId]);
  }

  const before = await getProgress(conn, userId, placeId, true);
  await conn.query(
    `UPDATE user_place_progress
        SET status = 'cleared',
            exploration_completed = TRUE,
            ritual_completed = ritual_completed OR ?,
            best_wpm = GREATEST(COALESCE(best_wpm, 0), ?),
            best_accuracy = GREATEST(COALESCE(best_accuracy, 0), ?)
      WHERE progress_id = ?`,
    [input.outcome === 'exorcised', input.wpm, input.accuracy, before.progress_id],
  );

  if (!before.exploration_completed) {
    await conn.query('UPDATE users SET total_locations_completed = total_locations_completed + 1 WHERE user_id = ?', [userId]);
    const [[next]] = await conn.query('SELECT place_id FROM haunted_places WHERE place_id > ? ORDER BY place_id LIMIT 1', [placeId]);
    if (next) {
      await conn.query(
        `INSERT INTO user_place_progress (user_id, place_id, status) VALUES (?, ?, 'unlocked')
         ON DUPLICATE KEY UPDATE progress_id = progress_id`,
        [userId, next.place_id],
      );
    }
  }
  return getProgress(conn, userId, placeId);
}

module.exports = { ritualRequirements, assertPlaceUnlocked, startPlaceSession, saveSessionResults, validateResults };
