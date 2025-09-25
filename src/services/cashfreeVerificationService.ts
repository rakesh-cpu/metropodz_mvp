// src/services/providers/cashfreeVerificationService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { CashfreeConfig, AadharOTPResponse, AadharVerifyResponse } from '../models/verification';

export class CashfreeVerificationService {
  private client: AxiosInstance;
  private config: CashfreeConfig;

  constructor(config: CashfreeConfig) {
    console.log("Cashfree config",config.baseUrl);
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 second timeout
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Cashfree] ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data
        });
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Cashfree] Response:`, {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        console.error(`[Cashfree] Error:`, {
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  async generateAadharOTP(aadharNumber: string): Promise<AadharOTPResponse> {
    try {
      const response = await this.client.post('/verification/offline-aadhaar/otp', {
        aadhaar_number: aadharNumber
      });

      if (response.data.message !== 'SUCCESS') {
        throw new Error(`Cashfree API returned: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      throw this.handleError('Aadhar OTP generation failed', error);
    }
  }

  async verifyAadharOTP(refId: string, otp: string): Promise<AadharVerifyResponse> {
    try {
      const response = await this.client.post('/verification/offline-aadhaar/verify', {
        otp: otp,
        ref_id: refId
      });

      return response.data;
    } catch (error) {
      throw this.handleError('Aadhar OTP verification failed', error);
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // You can implement a health check endpoint if Cashfree provides one
      return true;
    } catch (error) {
      console.error('[Cashfree] Health check failed:', error);
      return false;
    }
  }

  private handleError(message: string, error: any): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const data = axiosError.response?.data as { message?: string; error?: string } | undefined;
      const errorMessage = data?.message || data?.error || axiosError.message;
      return new Error(`${message}: ${errorMessage}`);
    }
    return new Error(`${message}: ${error.message || 'Unknown error'}`);
  }
}
