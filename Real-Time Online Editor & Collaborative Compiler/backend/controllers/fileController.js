const File = require('../models/File');

// POST /api/file  — create or overwrite a file for the logged-in user
exports.createFile = async (req, res, next) => {
  try {
    const { fileName, code } = req.body;
    if (!fileName) return res.status(400).json({ message: 'fileName is required' });

    // Upsert: update if same user+fileName already exists, otherwise insert
    const file = await File.findOneAndUpdate(
      { userId: req.user.id, fileName },
      { code: code ?? '' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
};

// GET /api/files  — return all files belonging to the logged-in user
exports.getUserFiles = async (req, res, next) => {
  try {
    const files = await File.find({ userId: req.user.id })
      .select('fileName code createdAt updatedAt')
      .sort('-updatedAt');

    res.json(files);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/file/:fileId  — delete a file owned by the logged-in user
exports.deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOneAndDelete({ _id: req.params.fileId, userId: req.user.id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
};
