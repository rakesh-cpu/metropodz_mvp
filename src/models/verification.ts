// src/models/Verification.ts

export type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'rejected' | 'expired';
export type ImageType = 'selfie' | 'aadhar';

// Core Domain Models
export interface UserVerification {
  id: number;
  verification_id: string;
  user_id: string;
  
  // Aadhar Details
  aadhar_number?: string;
  aadhar_ref_id?: string;
  aadhar_otp_generated_at?: Date;
  aadhar_verified_at?: Date;
  
  // Verified Aadhar Data
  verified_name?: string;
  verified_dob?: Date;
  verified_gender?: string;
  verified_email?: string;
  verified_address?: string;
  verified_care_of?: string;
  verified_pincode?: string;
  verified_state?: string;
  verified_district?: string;
  year_of_birth?: number;
  mobile_hash?: string;
  share_code?: string;
  
  // Image URLs
  selfie_image_url?: string;
  aadhar_image_url?: string;
  
  // Status & Metadata
  verification_status: VerificationStatus;
  verification_notes?: string;
  admin_remarks?: string;
  
  // Audit Fields
  ip_address?: string;
  user_agent?: string;
  device_info?: Record<string, any>;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  verified_at?: Date;
  expires_at?: Date;
}

// Request/Response DTOs
export interface GenerateAadharOTPRequest {
  aadhar_number: string;
  user_id:string;
}

export interface VerifyAadharOTPRequest {
  ref_id: string;
  otp: string;
  user_id: string;
}

export interface UploadImageRequest {
  image_type: ImageType;
}

// API Response Models
export interface AadharOTPResponse {
  status: string;
  message: 'SUCCESS' | 'FAILED';
  ref_id: string;
}

export interface AadharVerifyResponse {
  ref_id: string;
  status: string;
  message: string;
  care_of: string;
  address: string;
  dob: Date;
  email: string;
  gender: string;
  name: string;
  split_address: {
    country: string;
    dist: string;
    house: string;
    landmark: string;
    pincode: number;
    po: string;
    state: string;
    street: string;
    subdist: string;
    vtc: string;
    locality: string;
  };
  year_of_birth: number;
  mobile_hash: string;
  photo_link: string;
  share_code: string;
  xml_file: string;
}

export interface VerificationResponse {
  verification_id: string;
  status: VerificationStatus;
  message: string;
  data?: any;
  next_step?: string;
}

// Configuration
export interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

export interface VerificationConfig {
  aadhar_otp_expiry_minutes: number;
  max_verification_attempts: number;
  image_upload_max_size: number;
  supported_image_formats: string[];
}
