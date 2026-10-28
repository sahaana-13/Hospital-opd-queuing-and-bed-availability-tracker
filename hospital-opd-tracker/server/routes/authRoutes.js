import { Router } from 'express'; import { register,login,me,logout } from '../controllers/authController.js'; import { authenticate } from '../middleware/authMiddleware.js';
const r=Router();r.post('/register',register);r.post('/login',login);r.post('/logout',authenticate,logout);r.get('/me',authenticate,me);export default r;
