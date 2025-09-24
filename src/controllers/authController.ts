import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { CreateUserRequest, LoginRequest } from '../models/User';

const authService = new AuthService();

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData: CreateUserRequest = req.body;
    const result = await authService.register(userData);
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in register controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const loginData: LoginRequest = req.body;
    const result = await authService.login(loginData);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    console.error('Error in login controller:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
};

  export const sendLoginOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone_number, email, country_code } = req.body;
      console.log("Request Body:", req.body);
    if (!phone_number && !email) {
      res.status(400).json({
        success: false,
        error: 'Either phone number or email must be provided'
      });
      return;
    }

    const result = await authService.sendLoginOTP({
      phone_number,
      email,
      country_code: country_code || '+91',
      otp_type: 'login',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in sendLoginOTP controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send OTP'
    });
  }
};

export const loginWithOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone_number, email, country_code, otp_code } = req.body;
    
    if (!otp_code) {
      res.status(400).json({
        success: false,
        error: 'OTP code is required'
      });
      return;
    }

    const result = await authService.loginWithOTP({
      phone_number,
      email,
      country_code: country_code || '+91',
      otp_code,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    console.error('Error in loginWithOTP controller:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'OTP login failed'
    });
  }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone_number, email, otp_code, otp_type } = req.body;
    
    if (!otp_code || !otp_type) {
      res.status(400).json({
        success: false,
        error: 'OTP code and type are required'
      });
      return;
    }

    const result = await authService.verifyOTP({
      phone_number,
      email,
      otp_code,
      otp_type,
    });

    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error in verifyOTP controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'OTP verification failed'
    });
  }
};





