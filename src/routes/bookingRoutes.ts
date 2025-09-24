import { Router } from 'express';
import { createBooking, getBooking, getUserBookings, confirmBooking, cancelBooking } from '../controllers/bookingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken,createBooking);
router.get('/user', authenticateToken, getUserBookings);
router.get('/:bookingId', authenticateToken, getBooking);
router.put('/:bookingId/confirm', authenticateToken, confirmBooking);
router.put('/:bookingId/cancel', authenticateToken, cancelBooking);

export default router;
