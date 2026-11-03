const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { loginSchema } = require('../validators');

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), authController.postLogin);
router.post('/logout', requireAuth, authController.postLogout);
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
