
const bool = (value) =>
  value === true ||
  value === 1 ||
  value === '1';

const place = (row) => ({
  ...row,
  is_unlocked: bool(row.is_unlocked),
});

const progress = (row) =>
  row && {
    ...row,
    exploration_completed: bool(
      row.exploration_completed
    ),
    ritual_completed: bool(
      row.ritual_completed
    ),
  };

const placeGhost = (row) => ({
  ...row,
  is_boss: bool(row.is_boss),
});

// Return user data without the password hash.
const user = ({ password, ...rest }) => rest;

module.exports = {
  bool,
  place,
  progress,
  placeGhost,
  user,
};
