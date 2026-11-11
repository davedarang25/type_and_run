// /api/users — accounts (USERS) and the player's items (USER_INVENTORY)
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const game = require('../controllers/gameController');

router.post('/register', asyncHandler(game.register));
router.post('/login', asyncHandler(game.login));
router.get('/me', requireAuth, asyncHandler(game.me));
router.get('/me/inventory', requireAuth, asyncHandler(game.getInventory));

module.exports = router;
