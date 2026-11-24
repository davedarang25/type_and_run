
const { HttpError } = require('../middleware/errors');
const rows = require('./rows');

const OUTCOMES = ['extracted', 'exorcised', 'caught'];

/**
 * Items needed to exorcise a place:
 * its boss ghost(s), or every ghost if there is no boss.
 */
async function ritualRequirements(db, placeId) {
  const result = await db.query(
    `SELECT gri.item_id,
            SUM(gri.quantity_required)::INTEGER AS quantity_required
       FROM ghost_required_items gri
       JOIN place_ghosts pg
         ON pg.ghost_id = gri.ghost_id
        AND pg.place_id = $1
      WHERE pg.is_boss = TRUE
         OR NOT EXISTS (
           SELECT 1
             FROM place_ghosts b
            WHERE b.place_id = $2
              AND b.is_boss = TRUE
         )
      GROUP BY gri.item_id
      ORDER BY gri.item_id`,
    [placeId, placeId]
  );

  return result.rows;
}

/**
 * 404 if the place doesn't exist.
 * 403 if this player hasn't unlocked it.
 */
async function assertPlaceUnlocked(db, userId, placeId) {
  const placeResult = await db.query(
    `SELECT place_id, is_unlocked
       FROM haunted_places
      WHERE place_id = $1`,
    [placeId]
  );

  const place = placeResult.rows[0];

  if (!place) {
    throw new HttpError(404, `Location ${placeId} not found`);
  }

  if (rows.bool(place.is_unlocked)) {
    return;
  }

  const progressResult = await db.query(
    `SELECT 1 AS ok
       FROM user_place_progress
      WHERE user_id = $1 AND place_id = $2`,
    [userId, placeId]
  );

  if (progressResult.rows.length === 0) {
    throw new HttpError(403, `Location ${placeId} is locked`);
  }
}

async function getProgress(db, userId, placeId, forUpdate = false) {
  const result = await db.query(
    `SELECT *
       FROM user_place_progress
      WHERE user_id = $1 AND place_id = $2
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId, placeId]
  );

  return rows.progress(result.rows[0]);
}

/**
 * Initialize USER_PLACE_PROGRESS.
 * Keep cleared locations cleared.
 */
async function startPlaceSession(db, userId, placeId) {
  await assertPlaceUnlocked(db, userId, placeId);

  await db.query(
    `INSERT INTO user_place_progress
       (user_id, place_id, status)
     VALUES ($1, $2, 'in_progress')
     ON CONFLICT (user_id, place_id)
     DO UPDATE SET status =
       CASE
         WHEN user_place_progress.status = 'cleared'
         THEN 'cleared'
         ELSE 'in_progress'
       END`,
    [userId, placeId]
  );

  return getProgress(db, userId, placeId);
}

function validateResults(body) {
  const {
    outcome,
    wpm,
    accuracy,
    playtimeSeconds,
    collected = [],
  } = body || {};

  if (!OUTCOMES.includes(outcome)) {
    throw new HttpError(
      400,
      `outcome must be one of ${OUTCOMES.join(', ')}`
    );
  }

  if (
    typeof wpm !== 'number' ||
    wpm < 0 ||
    wpm > 400
  ) {
    throw new HttpError(
      400,
      'wpm must be a number from 0 to 400'
    );
  }

  if (
    typeof accuracy !== 'number' ||
    accuracy < 0 ||
    accuracy > 100
  ) {
    throw new HttpError(
      400,
      'accuracy must be a number from 0 to 100'
    );
  }

  if (!Array.isArray(collected)) {
    throw new HttpError(
      400,
      'collected must be an array of { item_id, quantity }'
    );
  }

  const items = collected.map((item) => ({
    item_id: Number(item?.item_id),
    quantity: Number(item?.quantity),
  }));

  if (
    items.some(
      (item) =>
        !Number.isInteger(item.item_id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 0
    )
  ) {
    throw new HttpError(
      400,
      'collected entries need integer item_id and quantity'
    );
  }

  return {
    outcome,
    wpm: Math.round(wpm * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    playtimeSeconds: Math.max(
      0,
      Math.round(Number(playtimeSeconds) || 0)
    ),
    collected: items,
  };
}

/**
 * Save a gameplay session in one transaction.
 *
 * Always:
 *   - Record the session.
 *   - Add playtime.
 *
 * Extracted or exorcised:
 *   - Bank collected items, capped at place spawn quantities.
 *   - Mark exploration completed.
 *   - Save best WPM and accuracy.
 *   - Unlock the next place on first clear.
 *
 * Exorcised:
 *   - Check ritual requirements.
 *   - Consume required items.
 *
 * Caught:
 *   - Session items are lost.
 */
async function saveSessionResults(
  conn,
  userId,
  placeId,
  body
) {
  const input = validateResults(body);

  await assertPlaceUnlocked(conn, userId, placeId);

  // Record this gameplay session.
  await conn.query(
    `INSERT INTO game_sessions
       (user_id, place_id, outcome, wpm, accuracy, playtime_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      placeId,
      input.outcome,
      input.wpm,
      input.accuracy,
      input.playtimeSeconds,
    ]
  );

  // Add total playtime.
  await conn.query(
    `UPDATE users
        SET total_playtime = total_playtime + $1
      WHERE user_id = $2`,
    [input.playtimeSeconds, userId]
  );

  // Ensure a progress row exists.
  await conn.query(
    `INSERT INTO user_place_progress
       (user_id, place_id, status)
     VALUES ($1, $2, 'in_progress')
     ON CONFLICT (user_id, place_id)
     DO NOTHING`,
    [userId, placeId]
  );

  if (input.outcome === 'caught') {
    return getProgress(conn, userId, placeId);
  }

  // Get the maximum amount of each item this place can spawn.
  const capsResult = await conn.query(
    `SELECT item_id,
            SUM(quantity_available)::INTEGER AS cap
       FROM place_item_spawns
      WHERE place_id = $1
      GROUP BY item_id`,
    [placeId]
  );

  const capOf = new Map(
    capsResult.rows.map((item) => [
      item.item_id,
      item.cap,
    ])
  );

  // Combine duplicate collected item entries.
  const totals = new Map();

  for (const item of input.collected) {
    totals.set(
      item.item_id,
      (totals.get(item.item_id) || 0) + item.quantity
    );
  }

  // Add items to the player's inventory.
  for (const [itemId, quantity] of totals) {
    const amount = Math.min(
      quantity,
      capOf.get(itemId) || 0
    );

    if (amount <= 0) continue;

    await conn.query(
      `INSERT INTO user_inventory
         (user_id, item_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id)
       DO UPDATE SET quantity =
         user_inventory.quantity + EXCLUDED.quantity`,
      [userId, itemId, amount]
    );
  }

  // Perform the exorcism if requested.
  if (input.outcome === 'exorcised') {
    const required = await ritualRequirements(
      conn,
      placeId
    );

    const ownedResult = await conn.query(
      `SELECT item_id, quantity
         FROM user_inventory
        WHERE user_id = $1
        FOR UPDATE`,
      [userId]
    );

    const have = new Map(
      ownedResult.rows.map((item) => [
        item.item_id,
        item.quantity,
      ])
    );

    const missingItems = required.some(
      (item) =>
        (have.get(item.item_id) || 0) <
        item.quantity_required
    );

    if (missingItems) {
      throw new HttpError(
        409,
        'Ritual requirements not met'
      );
    }

    for (const item of required) {
      await conn.query(
        `UPDATE user_inventory
            SET quantity = quantity - $1
          WHERE user_id = $2 AND item_id = $3`,
        [
          item.quantity_required,
          userId,
          item.item_id,
        ]
      );
    }

    await conn.query(
      `DELETE FROM user_inventory
        WHERE user_id = $1 AND quantity = 0`,
      [userId]
    );
  }

  // Lock progress before updating it.
  const before = await getProgress(
    conn,
    userId,
    placeId,
    true
  );

  await conn.query(
    `UPDATE user_place_progress
        SET status = 'cleared',
            exploration_completed = TRUE,
            ritual_completed =
              ritual_completed OR $1,
            best_wpm =
              GREATEST(COALESCE(best_wpm, 0), $2),
            best_accuracy =
              GREATEST(COALESCE(best_accuracy, 0), $3)
      WHERE progress_id = $4`,
    [
      input.outcome === 'exorcised',
      input.wpm,
      input.accuracy,
      before.progress_id,
    ]
  );

  // Unlock the next location only on the first exploration clear.
  if (!before.exploration_completed) {
    await conn.query(
      `UPDATE users
          SET total_locations_completed =
            total_locations_completed + 1
        WHERE user_id = $1`,
      [userId]
    );

    const nextResult = await conn.query(
      `SELECT place_id
         FROM haunted_places
        WHERE place_id > $1
        ORDER BY place_id
        LIMIT 1`,
      [placeId]
    );

    const next = nextResult.rows[0];

    if (next) {
      await conn.query(
        `INSERT INTO user_place_progress
           (user_id, place_id, status)
         VALUES ($1, $2, 'unlocked')
         ON CONFLICT (user_id, place_id)
         DO NOTHING`,
        [userId, next.place_id]
      );
    }
  }

  return getProgress(conn, userId, placeId);
}

module.exports = {
  ritualRequirements,
  assertPlaceUnlocked,
  startPlaceSession,
  saveSessionResults,
  validateResults,
};
