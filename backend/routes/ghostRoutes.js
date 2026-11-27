// /api/ghosts — ghost catalogue (GHOST_TYPE) with what each one needs to be exorcised
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const game = require('../controllers/gameController');

router.get('/', asyncHandler(game.listGhosts));
router.get('/:ghostId(\\d+)', asyncHandler(game.getGhost));

module.exports = router;
