import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

import { registerValidation, loginValidation, validate } from '../utils/validator.js';



const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/forgot-password', requestPasswordReset);
router.patch('/reset-password/:token', resetPassword);

export default router;