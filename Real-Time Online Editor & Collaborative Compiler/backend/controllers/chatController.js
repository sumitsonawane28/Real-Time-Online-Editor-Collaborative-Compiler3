const Message = require('../models/Message');

exports.getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort('createdAt')
      .limit(100);
    res.json(messages);
  } catch (err) {
    next(err);
  }
};
