// src/routes/verificationRoutes.ts
import { Router } from 'express';
// import { authenticateToken } from '../middleware/auth';
import { 
  uploadSelfieImage, 
  uploadAadharImage
} from '../middleware/uploadMiddleware';
import { handleMulterError } from '../middleware/uploadErrorHandler';
import {
  generateAadharVerificationOTP,
  verifyAadharVerificationOTP,
  uploadSelfieImage as uploadSelfie,
  uploadAadharImage as uploadAadhar,
  getVerificationStatus
} from '../controllers/verificationController';

const router = Router();


router.post("/generateAadharVerificationOTP",generateAadharVerificationOTP);
router.post("/verifyAadharVerificationOTP",verifyAadharVerificationOTP);

// router.use(authenticateToken);




router.post('/upload/selfie', 
  uploadSelfieImage, 
  uploadSelfie
);

router.post('/upload/aadhar',
  uploadAadharImage, 
  uploadAadhar
);

// Status route
router.get('/status', getVerificationStatus);

export default router;
