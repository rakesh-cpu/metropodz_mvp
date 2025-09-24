import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const handleMulterError = (error: any, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File size too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE'
        });
        
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files. Please upload one image at a time.',
          code: 'TOO_MANY_FILES'
        });
        
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field. Please check the field name.',
          code: 'UNEXPECTED_FILE'
        });
        
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many parts in multipart form.',
          code: 'TOO_MANY_PARTS'
        });
        
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error: ' + error.message,
          code: 'UPLOAD_ERROR'
        });
    }
  }
  
  if (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during file upload.',
      code: 'INTERNAL_ERROR'
    });
  }
  
  return next();
};
