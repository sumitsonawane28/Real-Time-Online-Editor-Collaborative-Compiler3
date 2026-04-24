const router = require('express').Router();
const { createRoom, joinRoom, getRooms } = require('../controllers/roomController');
const auth = require('../middleware/auth');

router.get('/', getRooms);
router.post('/', auth, createRoom);
router.get('/:roomId', joinRoom);

module.exports = router;
