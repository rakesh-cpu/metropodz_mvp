// src/middleware/uploadMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { memoryStorage, uploadToS3 } from '../config/AWSS3';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
  imageUrl?: string;
}

export const uploadSelfieImage = (req: Request, res: Response, next: NextFunction): void => {
  const upload = memoryStorage.single('selfie');

  upload(req, res, (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Selfie upload failed',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No selfie file provided',
      });
    }

    const userId = (req as AuthenticatedRequest).user.userId;

    uploadToS3(req.file, userId, 'selfie')
      .then((imageUrl) => {
        (req as AuthenticatedRequest).imageUrl = imageUrl;
        return next(); 
      })
      .catch(() => {
        return res.status(500).json({
          success: false,
          error: 'Failed to upload selfie',
        });
      });

    return; 
  });
};

export const uploadAadharImage = (req: Request, res: Response, next: NextFunction): void => {
  const upload = memoryStorage.single('aadhar');

  upload(req, res, (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Aadhar upload failed',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No aadhar file provided',
      });
    }

    const userId = (req as AuthenticatedRequest).user.userId;

    uploadToS3(req.file, userId, 'aadhar')
      .then((imageUrl) => {
        (req as AuthenticatedRequest).imageUrl = imageUrl;
        return next();
      })
      .catch(() => {
        return res.status(500).json({
          success: false,
          error: 'Failed to upload aadhar image',
        });
      });

    return; 
  });
};
