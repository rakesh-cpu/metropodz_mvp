// src/services/verificationService.ts
import { verificationRepository } from '../repositories/verificationRepositories';
import { CashfreeVerificationService } from '../services/cashfreeVerificationService';


import {
  UserVerification,
  VerificationStatus,
  ImageType,
  VerificationResponse,
  GenerateAadharOTPRequest,
  VerifyAadharOTPRequest,
  VerificationConfig
} from '../models/verification';




export class VerificationService {
  private cashfreeService: CashfreeVerificationService;
  private config: VerificationConfig;

  constructor() {
    this.cashfreeService = new CashfreeVerificationService({
      clientId: process.env.CASHFREE_CLIENT_ID!,
      clientSecret: process.env.CASHFREE_CLIENT_SECRET!,
      baseUrl: process.env.CASHFREE_VERIFICATION_BASE_URL || 'https://api.cashfree.com/verification'
    });

    this.config = {
      aadhar_otp_expiry_minutes: parseInt(process.env.AADHAR_OTP_EXPIRY_MINUTES || '10'),
      max_verification_attempts: parseInt(process.env.MAX_VERIFICATION_ATTEMPTS || '3'),
      image_upload_max_size: parseInt(process.env.IMAGE_UPLOAD_MAX_SIZE || '15*1024*1024'), // 15MB
      supported_image_formats: ['image/jpeg', 'image/png', 'image/jpg']
    };
  }


  async generateAadharOTP(
    request: GenerateAadharOTPRequest,
    metadata?: { ip_address?: string; user_agent?: string; device_info?: any }
  ): Promise<VerificationResponse> {
    try {
      const verification = await verificationRepository.getOrCreateVerification(request.user_id, metadata);
      
      // const attemptCount = await verificationRepository.getAttemptsCount(
      //   verification.verification_id, 
      //   'aadhar_otp_generation'
      // );
      
      // if (attemptCount >= this.config.max_verification_attempts) {
      //   throw new Error('Maximum OTP generation attempts exceeded. Please try again later.');
      // }

      
      const otpResponse = await this.cashfreeService.generateAadharOTP(request.aadhar_number);
      
      
      await verificationRepository.updateAadharOTPGeneration(
        verification.verification_id,
        request.aadhar_number,
        otpResponse.ref_id
      );
    
      // await verificationRepository.logAttempt(
      //   verification.verification_id,
      //   'aadhar_otp_generation',
      //   { aadhar_number: this.maskAadharNumber(request.aadhar_number) },
      //   true
      // );

      return {
        verification_id: verification.verification_id,
        status: 'in_progress',
        message: 'Aadhar OTP generated successfully',
        data: {
          ref_id: otpResponse.ref_id,
          expires_in_minutes: this.config.aadhar_otp_expiry_minutes
        },
        next_step: 'verify_aadhar_otp'
      };

    } catch (error: any) {
    
      // const verification = await verificationRepository.findByUserId(request.user_id);
      // if (verification) {
      //   await verificationRepository.logAttempt(
      //     verification.verification_id,
      //     'aadhar_otp_generation',
      //     { aadhar_number: this.maskAadharNumber(request.aadhar_number) },
      //     false,
      //     error.message
      //   );
      // }
      
      throw new Error(`Generate Aadhar OTP failed: ${error.message}`);
    }
  }


  async verifyAadharOTP( 
    request: VerifyAadharOTPRequest
  ): Promise<VerificationResponse> {
    try {
    
      const verification = await verificationRepository.findByRefId(request.ref_id);
      
      if (!verification || verification.user_id !== request.user_id) {
        throw new Error('Invalid reference ID or user mismatch');
      }

      
      if (verification.aadhar_otp_generated_at) {
        const expiryTime = new Date(verification.aadhar_otp_generated_at.getTime() + 
          (this.config.aadhar_otp_expiry_minutes * 60 * 1000));
        
        if (new Date() > expiryTime) {
          throw new Error('OTP has expired. Please generate a new OTP.');
        }
      }

      
      const attemptCount = await verificationRepository.getAttemptsCount(
        verification.verification_id, 
        'aadhar_otp_verification'
      );
      
      if (attemptCount >= this.config.max_verification_attempts) {
        await verificationRepository.updateStatus(verification.verification_id, 'rejected');
        throw new Error('Maximum OTP verification attempts exceeded.');
      }

      
      const verifyResponse = await this.cashfreeService.verifyAadharOTP(
        request.ref_id, 
        request.otp
      );
      

      await verificationRepository.updateAadharVerificationData(
        verification.verification_id,
        verifyResponse
      );


      await verificationRepository.logAttempt(
        verification.verification_id,
        'aadhar_otp_verification',
        { ref_id: request.ref_id },
        true
      );

    
      const updatedVerification = await verificationRepository.findById(verification.verification_id);
      const isComplete = this.isVerificationComplete(updatedVerification!);
      const nextStep = this.getNextVerificationStep(updatedVerification!);

      return {
        verification_id: verification.verification_id,
        status: isComplete ? 'verified' : 'in_progress',
        message: 'Aadhar verification successful',
        data: {
          verified_name: verifyResponse.name,
          verified_dob: verifyResponse.dob,
          verified_address: verifyResponse.address,
          is_complete: isComplete
        },
        next_step: nextStep
      };

    } catch (error: any) {
      const verification = await verificationRepository.findByRefId(request.ref_id);
      if (verification) {
        await verificationRepository.logAttempt(
          verification.verification_id,
          'aadhar_otp_verification',
          { ref_id: request.ref_id },
          false,
          error.message
        );
      }
      
      throw new Error(`Verify Aadhar OTP failed: ${error.message}`);
    }
  }

  
  async uploadVerificationImage(
    userId: string, 
    imageType: ImageType, 
    imageUrl: string
  ): Promise<VerificationResponse> {
    try {

      const verification = await verificationRepository.getOrCreateVerification(userId);
      

      await verificationRepository.updateImageUrl(
        verification.verification_id,
        imageType,
        imageUrl
      );

      await verificationRepository.logAttempt(
        verification.verification_id,
        `${imageType}_upload`,
        { image_type: imageType },
        true
      );

      const updatedVerification = await verificationRepository.findById(verification.verification_id);
      const isComplete = this.isVerificationComplete(updatedVerification!);
      const nextStep = this.getNextVerificationStep(updatedVerification!);

      return {
        verification_id: verification.verification_id,
        status: isComplete ? 'verified' : 'in_progress',
        message: `${imageType} image uploaded successfully`,
        data: {
          image_url: imageUrl,
          is_complete: isComplete
        },
        next_step: nextStep
      };

    } catch (error: any) {
      throw new Error(`Upload ${imageType} image failed: ${error.message}`);
    }
  }


  async getVerificationStatus(userId: string): Promise<VerificationResponse> {
    try {
      const verification = await verificationRepository.findByUserId(userId);
      
      if (!verification) {
        return {
          verification_id: '',
          status: 'pending',
          message: 'Verification not started',
          next_step: 'start_verification'
        };
      }

      const nextStep = this.getNextVerificationStep(verification);
      const isComplete = this.isVerificationComplete(verification);

      return {
        verification_id: verification.verification_id,
        status: verification.verification_status,
        message: this.getStatusMessage(verification.verification_status),
        data: {
          verified_name: verification.verified_name,
          verified_dob: verification.verified_dob,
          verified_address: verification.verified_address,
          selfie_image_url: verification.selfie_image_url,
          aadhar_image_url: verification.aadhar_image_url,
          is_complete: isComplete,
          created_at: verification.created_at,
          updated_at: verification.updated_at
        },
        next_step: nextStep
      };

    } catch (error: any) {
      throw new Error(`Get verification status failed: ${error.message}`);
    }
  }


  async getVerificationHistory(options: {
    userId?: string;
    status?: VerificationStatus;
    page?: number;
    limit?: number;
  }): Promise<{ verifications: UserVerification[]; pagination: any }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const offset = (page - 1) * limit;

      const result = await verificationRepository.findAll({
        userId: options.userId,
        status: options.status,
        limit,
        offset,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      return {
        verifications: result.verifications,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
          has_next: page * limit < result.total,
          has_previous: page > 1
        }
      };

    } catch (error: any) {
      throw new Error(`Get verification history failed: ${error.message}`);
    }
  }

  // Admin: Update verification status
  async updateVerificationStatus(
    verificationId: string,
    status: VerificationStatus,
    adminRemarks?: string
  ): Promise<VerificationResponse> {
    try {
      await verificationRepository.updateStatus(verificationId, status, undefined, adminRemarks);
      
      const verification = await verificationRepository.findById(verificationId);
      if (!verification) {
        throw new Error('Verification not found');
      }

      return {
        verification_id: verificationId,
        status: status,
        message: `Verification status updated to ${status}`,
        data: {
          admin_remarks: adminRemarks,
          updated_at: new Date()
        }
      };

    } catch (error: any) {
      throw new Error(`Update verification status failed: ${error.message}`);
    }
  }

  // Cleanup expired verifications (cron job)
  async cleanupExpiredVerifications(): Promise<number> {
    try {
      return await verificationRepository.cleanupExpired();
    } catch (error: any) {
      console.error('Cleanup expired verifications failed:', error);
      throw error;
    }
  }

  // Private helper methods
  private isVerificationComplete(verification: UserVerification): boolean {
    return !!(
      verification.verified_name && 
      verification.selfie_image_url &&
      verification.aadhar_verified_at &&
      verification.verification_status === 'verified'
    );
  }

  private getNextVerificationStep(verification: UserVerification): string {
    if (!verification.aadhar_number) {
      return 'generate_aadhar_otp';
    }
    if (!verification.aadhar_verified_at) {
      return 'verify_aadhar_otp';
    }
    if (!verification.selfie_image_url) {
      return 'upload_selfie_image';
    }
    if (verification.verification_status === 'verified') {
      return 'verification_complete';
    }
    return 'pending_admin_review';
  }

  private getStatusMessage(status: VerificationStatus): string {
    const messages = {
      pending: 'Verification not started',
      in_progress: 'Verification in progress',
      verified: 'Verification completed successfully',
      rejected: 'Verification rejected',
      expired: 'Verification expired'
    };
    return messages[status] || 'Unknown status';
  }

  private maskAadharNumber(aadharNumber: string): string {
    if (aadharNumber.length !== 12) return aadharNumber;
    return `${'*'.repeat(8)}${aadharNumber.slice(-4)}`;
  }
}

export const verificationService = new VerificationService();
