// src/services/communicationService.ts
import axios from 'axios';
import nodemailer from 'nodemailer';

interface SMSCountryResponse {
  Success: string;
  Message: string;
  MessageId?: string;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class CommunicationService {
  private emailTransporter;

  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    } as EmailConfig);
  }


  async sendOtpToPhoneNumber(phoneNumber: string, message: string): Promise<{ success: boolean; data: SMSCountryResponse; messageId?: string }> {
    try {
      const sanitizedPhoneNumber = phoneNumber.startsWith('+')
        ? phoneNumber.slice(1)
        : phoneNumber;
      console.log("Sanitized Phone Number:", sanitizedPhoneNumber);
      
      const data = JSON.stringify({
        "Text": message,
        "Number": sanitizedPhoneNumber,
        "SenderId": "FRACSP",
        "DRNotifyUrl": "https://www.domainname.com/notifyurl",
        "DRNotifyHttpMethod": "POST",
        "Tool": "API"
      });
      console.log("sms basic",process.env.SMS_COUNTRY_AUTH_TOKEN);
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://restapi.smscountry.com/v0.1/Accounts/FdxnV4cAHHv8jPsvlM7M/SMSes/',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.SMS_COUNTRY_AUTH_TOKEN}`
        },
        data: data
      };
      console.log("SMS API Request Config:", config);

      const response = await axios(config);
      
      if (response.status !== 202) {
        throw new Error(`Failed to send OTP. Status code: ${response.status}`);
      }

      if (response.data?.Success === 'True') {
        return { 
          success: true, 
          data: response.data,
          messageId: response.data.MessageId
        };
      } else {
        throw new Error(`Failed to send OTP. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      console.error("Failed to send OTP:", error.message);
      if (error.response) {
        console.error("Response Data:", error.response.data);
        console.error("Response Status:", error.response.status);
      }
      throw new Error("Failed to send OTP to user phone number");
    }
  }

  async sendOtpToEmail(email: string, subject: string, message: string): Promise<{ success: boolean; messageId: string }> {
    try {
      const mailOptions = {
        from: `"Metropodz" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Metropodz - OTP Verification</h2>
            <p style="font-size: 16px; color: #666;">
              Your OTP for verification is:
            </p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">
                ${message.match(/\d{4,6}/)?.[0] || 'N/A'}
              </h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              This OTP will expire in 10 minutes. Please do not share this code with anyone.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        `,
        text: message
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error: any) {
      console.error("Failed to send email OTP:", error.message);
      throw new Error("Failed to send OTP to email");
    }
  }

  
  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // formatOTPMessage(otp: string, purpose: string = 'login'): string {
  //   return `Your Metropodz ${purpose} OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`;
  // }
  formatOTPMessage(otp:string,purpose:string='login'):string{
    return `Your OTP for login verification is: ${otp}. Please don't share it with anyone - FRACSPACE PRIVATE LIMITED`
  }
}

export const communicationService = new CommunicationService();
