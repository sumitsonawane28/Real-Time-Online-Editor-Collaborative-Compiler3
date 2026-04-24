const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId:   { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  language: { type: String, default: 'javascript' },
  code:     { type: String, default: '' },
  members:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
