const crypto = require('crypto');
const Room = require('../models/Room');

const genId = () => crypto.randomBytes(4).toString('hex');

exports.createRoom = async (req, res, next) => {
  try {
    const { name, language } = req.body;
    if (!name) return res.status(400).json({ message: 'Room name required' });

    const room = await Room.create({
      roomId: genId(),
      name,
      language: language || 'javascript',
      owner: req.user?.id,
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
};

exports.joinRoom = async (req, res, next) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    next(err);
  }
};

exports.getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().select('-code').sort('-createdAt').limit(20);
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};
