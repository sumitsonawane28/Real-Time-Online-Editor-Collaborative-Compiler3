const router = require('express').Router();
const { executeCode } = require('../services/codeRunner');

const SUPPORTED = ['c', 'cpp', 'python', 'javascript', 'typescript', 'java'];

router.post('/', async (req, res, next) => {
  try {
    const { code, language } = req.body;

    if (!code || !language)
      return res.status(400).json({ message: 'code and language are required' });

    const lang = language.toLowerCase();

    if (!SUPPORTED.includes(lang))
      return res.status(400).json({
        output: '',
        error: `Language "${language}" is not supported.\nSupported languages: ${SUPPORTED.join(', ')}`,
      });

    const result = await executeCode(code, lang);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
