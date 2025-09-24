import { Request, Response,RequestHandler } from 'express';
import { VerificationService } from '../services/verificationService';
import { GenerateAadharOTPRequest, VerifyAadharOTPRequest, ImageType } from '../models/verification';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
  imageUrl?: string; 
}

const verificationService = new VerificationService();


export const generateAadharVerificationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { aadhar_number,user_id }: GenerateAadharOTPRequest = req.body;
    console.log("aadhar_number",aadhar_number);
    if (!aadhar_number || !/^\d{12}$/.test(aadhar_number)) {
      res.status(400).json({
        success: false,
        error: 'Valid 12-digit Aadhar number is required'
      });
      return;
    }

    const result = await verificationService.generateAadharOTP(
      { aadhar_number, user_id },
      {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        device_info: {
          headers: req.headers,
          timestamp: new Date().toISOString()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error in generateAadharVerificationOTP:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate Aadhar OTP'
    });
  }
};

export const verifyAadharVerificationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ref_id, otp, user_id }: VerifyAadharOTPRequest = req.body;

    if (!ref_id || !otp) {
      res.status(400).json({
        success: false,
        error: 'Reference ID and OTP are required'
      });
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({
        success: false,
        error: 'OTP must be 6 digits'
      });
      return;
    }

    const result = await verificationService.verifyAadharOTP({user_id, ref_id, otp });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error in verifyAadharVerificationOTP:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify Aadhar OTP'
    });
  }
};


export const uploadSelfieImage= async (req:Request, res: Response): Promise<void> => {
  try {
    const authRequest = req as AuthenticatedRequest;
    const userId = authRequest.user.userId;
    const imageUrl = authRequest.imageUrl;
    
    if (!imageUrl) {
      res.status(400).json({
        success: false,
        error: 'Image upload failed'
      });
      return;
    }

    const result = await verificationService.uploadVerificationImage(userId, 'selfie', imageUrl);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error in uploadSelfieImage:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload selfie image'
    });
  }
};

export const uploadAadharImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const authRequest = req as AuthenticatedRequest;
    const userId = authRequest.user.userId;
    const imageUrl = authRequest.imageUrl;

    if (!imageUrl) {
      res.status(400).json({
        success: false,
        error: 'Image upload failed'
      });
      return;
    }

    const result = await verificationService.uploadVerificationImage(userId, 'aadhar', imageUrl);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error in uploadAadharImage:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload Aadhar image'
    });
  }
};

export const getVerificationStatus = async (req:Request, res: Response): Promise<void> => {
  try {
    const authRequest = req as AuthenticatedRequest;
    const userId = authRequest.user.userId;
    
    const result = await verificationService.getVerificationStatus(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getVerificationStatus:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get verification status'
    });
  }
};

export const getVerificationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const authRequest = req as AuthenticatedRequest;
    const userId = authRequest.user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await verificationService.getVerificationHistory({
      userId,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getVerificationHistory:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get verification history'
    });
  }
};

// Admin: Get all verifications
export const getAllVerifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as any;

    const result = await verificationService.getVerificationHistory({
      status,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getAllVerifications:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get verifications'
    });
  }
};

// Admin: Update verification status
export const updateVerificationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId } = req.params;
    const { status, admin_remarks } = req.body;

    if (!verificationId || typeof verificationId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Verification ID is required'
      });
      return;
    }

    if (!['pending', 'in_progress', 'verified', 'rejected', 'expired'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
      return;
    }

    const result = await verificationService.updateVerificationStatus(
      verificationId,
      status,
      admin_remarks
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error in updateVerificationStatus:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update verification status'
    });
  }
};
