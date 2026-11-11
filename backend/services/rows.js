// MySQL returns BOOLEAN columns as 0/1; the clients expect true/false.
const bool = (v) => v === 1 || v === true || v === '1';

const place = (r) => ({ ...r, is_unlocked: bool(r.is_unlocked) });

const progress = (r) =>
  r && {
    ...r,
    exploration_completed: bool(r.exploration_completed),
    ritual_completed: bool(r.ritual_completed),
  };

const placeGhost = (r) => ({ ...r, is_boss: bool(r.is_boss) });

/** users row without the password hash. */
const user = ({ password, ...rest }) => rest; // eslint-disable-line no-unused-vars

module.exports = { bool, place, progress, placeGhost, user };
