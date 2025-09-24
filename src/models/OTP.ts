export type OTPType = 'login' | 'registration' | 'password_reset' | 'phone_verification';
export type OTPStatus = 'pending' | 'verified' | 'expired' | 'failed';
export type OTPDeliveryMethod = 'sms' | 'email';

export interface OTPRequest {
  id: number;
  otp_id: string;
  user_id?: string;
  phone_number?: string;
  email?: string;
  country_code?: string;
  internationalized_phone_number?: string;
  otp_code: string;
  otp_type: OTPType;
  otp_status: OTPStatus;
  delivery_method: OTPDeliveryMethod;
  attempts_count: number;
  max_attempts: number;
  provider_response?: any;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}


export interface OTPDeliveryLog {
  id: number;
  otp_request_id: number;
  delivery_method: OTPDeliveryMethod;
  recipient: string;
  provider_name: string;
  provider_message_id?: string;
  delivery_status: string;
  provider_response?: any;
  sent_at: Date;
  delivered_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
}

// Request/Response interfaces
export interface SendOTPRequest {
  phone_number?: string;
  email?: string;
  country_code?: string;
  otp_type: OTPType;
  ip_address?: string;
  user_agent?: string;
}

export interface VerifyOTPRequest {
  phone_number?: string;
  email?: string;
  otp_code: string;
  otp_type: OTPType;
}

export interface OTPResponse {
  otp_id: string;
  delivery_method: OTPDeliveryMethod;
  recipient: string;
  expires_at: Date;
  attempts_remaining: number;
}

export interface LoginWithOTPRequest {
  phone_number?: string;
  email?: string;
  country_code?: string;
  otp_code: string;
}
