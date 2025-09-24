import pool from '../config/database';
import { OTPRequest, OTPDeliveryLog, OTPType, OTPStatus, OTPDeliveryMethod } from '../models/OTP';

export class OTPRepository {
  async createOTPRequest(data: {
    user_id?: string;
    phone_number?: string;
    email?: string;
    country_code?: string;
    internationalized_phone_number?: string;
    otp_code: string;
    otp_type: OTPType;
    delivery_method: OTPDeliveryMethod;
    expires_at: Date;
    provider_response?: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<OTPRequest> {
    const sql = `
      INSERT INTO otp_requests (
        user_id, phone_number, email, country_code, internationalized_phone_number,
        otp_code, otp_type, delivery_method, expires_at, provider_response,
        ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      data.user_id || null,
      data.phone_number || null,
      data.email || null,
      data.country_code || null,
      data.internationalized_phone_number || null,
      data.otp_code,
      data.otp_type,
      data.delivery_method,
      data.expires_at,
      data.provider_response ? JSON.stringify(data.provider_response) : null,
      data.ip_address || null,
      data.user_agent || null
    ];
    
    const result = await pool.query(sql, values);
    return result.rows[0];
  }


  async getActiveOTP(identifier: string, otpType: OTPType): Promise<OTPRequest | null> {
    const sql = `
      SELECT * FROM otp_requests 
      WHERE (phone_number = $1 OR email = $1 OR internationalized_phone_number = $1)
        AND otp_type = $2 
        AND otp_status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(sql, [identifier, otpType]);
    return result.rows[0] || null;
  }

  async verifyOTP(otpId: string, otpCode: string): Promise<{ success: boolean; otp?: OTPRequest }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const getOTPSql = `
        SELECT * FROM otp_requests 
        WHERE otp_id = $1 AND otp_status = 'pending' AND expires_at > NOW()
        FOR UPDATE
      `;
      const otpResult = await client.query(getOTPSql, [otpId]);
      
      if (otpResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false };
      }
      
      const otp = otpResult.rows[0];
      

      const updateAttemptsSql = `
        UPDATE otp_requests 
        SET attempts_count = attempts_count + 1, updated_at = NOW()
        WHERE otp_id = $1
      `;
      await client.query(updateAttemptsSql, [otpId]);
      
    
      if (otp.otp_code === otpCode) {
        const verifySql = `
          UPDATE otp_requests 
          SET otp_status = 'verified', verified_at = NOW(), updated_at = NOW()
          WHERE otp_id = $1
          RETURNING *
        `;
        const verifiedResult = await client.query(verifySql, [otpId]);
        
        await client.query('COMMIT');
        return { success: true, otp: verifiedResult.rows[0] };
      } else {
        if (otp.attempts_count + 1 >= otp.max_attempts) {
          const failSql = `
            UPDATE otp_requests 
            SET otp_status = 'failed', updated_at = NOW()
            WHERE otp_id = $1
          `;
          await client.query(failSql, [otpId]);
        }
        
        await client.query('COMMIT');
        return { success: false };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markExpiredOTPs(): Promise<void> {
    const sql = `
      UPDATE otp_requests 
      SET otp_status = 'expired', updated_at = NOW()
      WHERE otp_status = 'pending' AND expires_at <= NOW()
    `;
    await pool.query(sql);
  }

  async logOTPDelivery(data: {
    otp_request_id: number;
    delivery_method: OTPDeliveryMethod;
    recipient: string;
    provider_name: string;
    provider_message_id?: string;
    delivery_status: string;
    provider_response?: any;
  }): Promise<OTPDeliveryLog> {
    const sql = `
      INSERT INTO otp_delivery_logs (
        otp_request_id, delivery_method, recipient, provider_name,
        provider_message_id, delivery_status, provider_response
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      data.otp_request_id,
      data.delivery_method,
      data.recipient,
      data.provider_name,
      data.provider_message_id || null,
      data.delivery_status,
      data.provider_response ? JSON.stringify(data.provider_response) : null
    ];
    
    const result = await pool.query(sql, values);
    return result.rows[0];
  }

  async cleanOldOTPs(olderThanHours: number = 24): Promise<number> {
    const sql = `
      DELETE FROM otp_requests 
      WHERE created_at < NOW() - INTERVAL '${olderThanHours} hours'
    `;
    const result = await pool.query(sql);
    return result.rowCount || 0;
  }
}

export const otpRepository = new OTPRepository();
