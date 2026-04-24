const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, required: true, trim: true },
  code:     { type: String, default: '' },
}, { timestamps: true });

// Compound index: one user can't have two files with the same name
fileSchema.index({ userId: 1, fileName: 1 }, { unique: true });

module.exports = mongoose.model('File', fileSchema);
