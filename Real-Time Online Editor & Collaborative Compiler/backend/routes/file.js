const router = require('express').Router();
const auth = require('../middleware/auth');
const { createFile, getUserFiles, deleteFile } = require('../controllers/fileController');

// All routes require a valid JWT
router.use(auth);

router.post('/',           createFile);    // POST  /api/file
router.get('/',            getUserFiles);  // GET   /api/files  (mounted separately — see server.js)
router.delete('/:fileId',  deleteFile);    // DELETE /api/file/:fileId

module.exports = router;
