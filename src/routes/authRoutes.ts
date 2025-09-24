import { Router } from 'express';
import { register, login , sendLoginOTP, verifyOTP, loginWithOTP } from '../controllers/authController';
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post("/sendLoginOTP", sendLoginOTP);
router.post("/verifyLoginOTP", verifyOTP);
router.post("/loginWithOTP", loginWithOTP);



export default router;
