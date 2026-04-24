const router = require('express').Router();
const { getMessages } = require('../controllers/chatController');

router.get('/:roomId', getMessages);

module.exports = router;
