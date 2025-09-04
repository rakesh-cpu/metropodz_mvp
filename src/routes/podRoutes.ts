import { Router } from 'express';
import { createPod, updatePod, getPod, getAllPods, getPodsNearUser } from '../controllers/podController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createPod);
router.put('/:podId', authenticateToken, updatePod);
router.get('/:podId', getPod);
router.get('/', getAllPods);
router.post('/search/nearby', getPodsNearUser);

export default router;
