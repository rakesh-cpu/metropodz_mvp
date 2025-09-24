import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { CreateUserRequest, LoginRequest, User } from '../models/User';
import { ValidationUtils } from '../utils/validation';
import { OTPRepository } from '../repositories/otpRepository';
import { communicationService } from './communicationService';
import { OTPType, OTPDeliveryMethod } from '../models/OTP';

const otpRepository = new OTPRepository();

interface SendOTPRequest {
  phone_number?: string;
  email?: string;
  country_code: string;
  otp_type: OTPType;
  ip_address?: string;
  user_agent?: string;
}

interface OTPResponse {
  otp_id: string;
  delivery_method: OTPDeliveryMethod;
  recipient: string | undefined;
  expires_at: Date;
  attempts_remaining: number;
}

interface LoginWithOTPRequest {
  phone_number?: string;
  email?: string;
  country_code: string;
  otp_code: string;
}

interface VerifyOTPRequest {
  phone_number?: string;
  email?: string;
  otp_code: string;
  otp_type: OTPType;
} 

export class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'metropodz_mvp';

  async register(userData: CreateUserRequest): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    const { name, email, phone_number, country_code, password, area, address, city, state, country, pincode, latitude, longitude } = userData;

    if (!ValidationUtils.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!ValidationUtils.isValidPhoneNumber(phone_number)) {
      throw new Error('Invalid phone number format');
    }


    const existingUserQuery = `
      SELECT id FROM users WHERE email = $1 OR phone_number = $2
    `;
    const existingUser = await pool.query(existingUserQuery, [email, phone_number]);
    
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email or phone number');
    }

  
    const passwordHash = await bcrypt.hash(password, 10);

    const internationalPhone = `${country_code}${phone_number}`;

    // Prepare location if coordinates provided
    let locationPoint = null;
    if (latitude && longitude && ValidationUtils.isValidCoordinates(latitude, longitude)) {
      locationPoint = `POINT(${longitude} ${latitude})`;
    }
  const query = `
      SELECT id, user_id, name, email, phone_number, country_code, password_hash, user_type, area, address, city, state, country, pincode, created_at, updated_at
      FROM users 
      WHERE ${email ? 'email = $1' : 'phone_number = $1'}
    `;
    const insertQuery = `
      INSERT INTO users (name, email, phone_number, country_code, internationalized_phone_number, password_hash, area, address, city, state, country, pincode, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${locationPoint ? 'ST_SetSRID(ST_GeomFromText($13), 4326)' : 'NULL'})
      RETURNING id, user_id, name, email, phone_number, country_code, user_type, area, address, city, state, country, pincode, created_at, updated_at
    `;

    const values = locationPoint 
      ? [name, email, phone_number, country_code, internationalPhone, passwordHash, area, address, city, state, country, pincode, locationPoint]
      : [name, email, phone_number, country_code, internationalPhone, passwordHash, area, address, city, state, country, pincode];

    const result = await pool.query(insertQuery, values);
    const newUser = result.rows[0];
 
    const token = this.generateToken(newUser.id, newUser.user_id,newUser.email);

    return { user: newUser, token };
  }

  async login(loginData: LoginRequest): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    const { email, phone_number, password } = loginData;

    if (!email && !phone_number) {
      throw new Error('Either email or phone number must be provided');
    }

    const query = `
      SELECT id, user_id, name, email, phone_number, country_code, password_hash, user_type, area, address, city, state, country, pincode, created_at, updated_at
      FROM users 
      WHERE ${email ? 'email = $1' : 'phone_number = $1'}
    `;

    const result = await pool.query(query, [email || phone_number]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.user_id,user.email);
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  private generateToken(userId: number, userUuid: string,email:string): string {
    return jwt.sign(
      { userId, userUuid,email },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): { userId: number; userUuid: string, email:string } {
    try {
      return jwt.verify(token, this.jwtSecret) as { userId: number; userUuid: string, email:string };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async sendLoginOTP(data: SendOTPRequest): Promise<OTPResponse> {
    const { phone_number, email, country_code, ip_address, user_agent } = data;
    
    if (!phone_number && !email) {
      throw new Error('Either phone number or email must be provided');
    }

    const isIndianNumber = country_code === '+91' || country_code === '91';
    const deliveryMethod = phone_number && isIndianNumber ? 'sms' : 'email';
    const recipient = deliveryMethod === 'sms' ? phone_number! : email!;


    let existingUser = null;
    if (phone_number) {
      const userQuery = `SELECT user_id FROM users WHERE phone_number = $1 OR internationalized_phone_number = $2`;
      const internationalPhone = `${country_code}${phone_number}`;
      const userResult = await pool.query(userQuery, [phone_number, internationalPhone]);
      existingUser = userResult.rows[0];
    } else if (email) {
      const userQuery = `SELECT user_id FROM users WHERE email = $1`;
      const userResult = await pool.query(userQuery, [email]);
      existingUser = userResult.rows[0];
    }

    
    const otpCode = communicationService.generateOTP(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

    let deliveryResponse;
    let providerMessageId;
    
    
    if (deliveryMethod === 'sms' && phone_number) {
      const message = communicationService.formatOTPMessage(otpCode, 'login');
      const internationalPhone = phone_number.startsWith('+') ? phone_number : `${country_code}${phone_number}`;
      
      deliveryResponse = await communicationService.sendOtpToPhoneNumber(internationalPhone, message);
      providerMessageId = deliveryResponse.messageId;
    } else if (deliveryMethod === 'email' && email) {
      const message = communicationService.formatOTPMessage(otpCode, 'login');
      const subject = 'Metropodz - Login OTP';
      
      deliveryResponse = await communicationService.sendOtpToEmail(email, subject, message);
      providerMessageId = deliveryResponse.messageId;
    } else {
      throw new Error('Invalid delivery method configuration');
    }

  
    const otpRequest = await otpRepository.createOTPRequest({
      user_id: existingUser?.user_id,
      phone_number: deliveryMethod === 'sms' ? phone_number : undefined,
      email: deliveryMethod === 'email' ? email : undefined,
      country_code,
      internationalized_phone_number: phone_number ? `${country_code}${phone_number}` : undefined,
      otp_code: otpCode,
      otp_type: 'login',
      delivery_method: deliveryMethod,
      expires_at: expiresAt,
      provider_response: deliveryResponse,
      ip_address,
      user_agent,
    });

    await otpRepository.logOTPDelivery({
      otp_request_id: otpRequest.id,
      delivery_method: deliveryMethod,
      recipient,
      provider_name: deliveryMethod === 'sms' ? 'sms_country' : 'email',
      provider_message_id: providerMessageId,
      delivery_status: 'sent',
      provider_response: deliveryResponse,
    });

    return {
      otp_id: otpRequest.otp_id,
      delivery_method: deliveryMethod,
      recipient:deliveryMethod === 'sms' ? phone_number : email,
      expires_at: expiresAt,
      attempts_remaining: otpRequest.max_attempts,
    };
  }

  
  async loginWithOTP(data: LoginWithOTPRequest): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    const { phone_number, email, country_code, otp_code } = data;
    
    if (!phone_number && !email) {
      throw new Error('Either phone number or email must be provided');
    }

    if (!otp_code) {
      throw new Error('OTP code is required');
    }

    const identifier = phone_number ? 
      (phone_number.startsWith('+') ? phone_number : `${country_code}${phone_number}`) : 
      email!;
    
    const otpRequest = await otpRepository.getActiveOTP(identifier, 'login');
    
    if (!otpRequest) {
      throw new Error('No active OTP found. Please request a new OTP.');
    }
    const verificationResult = await otpRepository.verifyOTP(otpRequest.otp_id, otp_code);
    
    if (!verificationResult.success) {
      const remainingAttempts = otpRequest.max_attempts - (otpRequest.attempts_count + 1);
      if (remainingAttempts <= 0) {
        throw new Error('Maximum OTP attempts exceeded. Please request a new OTP.');
      }
      throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining.`);
    }

  
    let user;
    if (phone_number) {
      const userQuery = `
        SELECT id, user_id, name, email, phone_number, country_code, user_type, 
               area, address, city, state, country, pincode, created_at, updated_at
        FROM users 
        WHERE phone_number = $1 OR internationalized_phone_number = $2
      `;
      const internationalPhone = `${country_code}${phone_number}`;
      const userResult = await pool.query(userQuery, [phone_number, internationalPhone]);
      user = userResult.rows[0];
      
      if (!user) {
        throw new Error('User not found. Please register first.');
      }
    } else if (email) {
      const userQuery = `
        SELECT id, user_id, name, email, phone_number, country_code, user_type, 
               area, address, city, state, country, pincode, created_at, updated_at
        FROM users 
        WHERE email = $1
      `;
      const userResult = await pool.query(userQuery, [email]);
      user = userResult.rows[0];
      
      if (!user) {
        throw new Error('User not found. Please register first.');
      }
    }

    const token = this.generateToken(user.id, user.user_id, user.email);

    return { user, token };
  }


  async verifyOTP(data: VerifyOTPRequest): Promise<{ success: boolean; message: string }> {
    const { phone_number, email, otp_code, otp_type } = data;
    
    if (!phone_number && !email) {
      throw new Error('Either phone number or email must be provided');
    }

    const identifier = phone_number || email!;
    const otpRequest = await otpRepository.getActiveOTP(identifier, otp_type);
    
    if (!otpRequest) {
      throw new Error('No active OTP found for verification');
    }

    const verificationResult = await otpRepository.verifyOTP(otpRequest.otp_id, otp_code);
    
    if (verificationResult.success) {
      return { success: true, message: 'OTP verified successfully' };
    } else {
      const remainingAttempts = otpRequest.max_attempts - (otpRequest.attempts_count + 1);
      if (remainingAttempts <= 0) {
        return { success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' };
      }
      return { success: false, message: `Invalid OTP. ${remainingAttempts} attempts remaining.` };
    }
  }
}



