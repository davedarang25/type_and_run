// /api/game — content the game loop needs, plus starting and saving a run
const router = require('express').Router();
const { asyncHandler } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const game = require('../controllers/gameController');

router.get('/words', asyncHandler(game.getWords));
router.get('/items', asyncHandler(game.getItems));
router.get('/places', requireAuth, asyncHandler(game.listPlaces));
router.get('/places/:placeId(\\d+)', asyncHandler(game.getPlaceContent));
router.get('/places/:placeId(\\d+)/ritual', asyncHandler(game.getRitual));
router.post('/places/:placeId(\\d+)/start', requireAuth, asyncHandler(game.startPlace));
router.post('/places/:placeId(\\d+)/results', requireAuth, asyncHandler(game.saveResults));

module.exports = router;
