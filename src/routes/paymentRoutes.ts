import { Router } from 'express';
import { 
  createBookingPayment, 
  getPaymentStatus, 
  handleWebhook,
  createPaymentLink,
  createRefund,
  getUserPaymentHistory,
  getPaymentsByBooking
} from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();


router.post('/webhook', handleWebhook); 

router.post('/booking', authenticateToken, createBookingPayment); 
router.post('/link', authenticateToken, createPaymentLink); 
router.post('/refund', authenticateToken, createRefund); 


router.get('/history', authenticateToken, getUserPaymentHistory); 
router.get('/status/:orderId', authenticateToken, getPaymentStatus);
router.get('/booking/:bookingId', authenticateToken, getPaymentsByBooking);

export default router;
