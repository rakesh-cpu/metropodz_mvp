// src/repositories/verificationRepository.ts
import pool from '../config/database';
import { UserVerification, VerificationStatus, ImageType, AadharVerifyResponse } from '../models/verification';

export class VerificationRepository {
  async getOrCreateVerification(
    userId: string, 
    metadata?: { 
      ip_address?: string; 
      user_agent?: string; 
      device_info?: Record<string, any> 
    }
  ): Promise<UserVerification> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let sql = `SELECT * FROM user_verification WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`;
      let result = await client.query(sql, [userId]);
      
      if (result.rows.length > 0) {
        await client.query('COMMIT');
        return this.mapToUserVerification(result.rows[0]);
      }
      
      sql = `
        INSERT INTO user_verification (user_id, ip_address, user_agent, device_info)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const values = [
        userId,
        metadata?.ip_address || null,
        metadata?.user_agent || null,
        metadata?.device_info ? JSON.stringify(metadata.device_info) : null
      ];
      
      result = await client.query(sql, values);
      await client.query('COMMIT');
      
      return this.mapToUserVerification(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAadharOTPGeneration(
    verificationId: string, 
    aadharNumber: string, 
    refId: string
  ): Promise<void> {
    const sql = `
      UPDATE user_verification 
      SET 
        aadhar_number = $1, 
        aadhar_ref_id = $2, 
        aadhar_otp_generated_at = NOW(),
        verification_status = 'in_progress', 
        updated_at = NOW()
      WHERE verification_id = $3
    `;
    
    await pool.query(sql, [aadharNumber, refId, verificationId]);
  }

  async updateAadharVerificationData(
    verificationId: string, 
    aadharData: AadharVerifyResponse
  ): Promise<void> {
    const sql = `
      UPDATE user_verification 
      SET 
        aadhar_verified_at = NOW(),
        verified_name = $1,
        verified_dob = $2,
        verified_gender = $3,
        verified_email = $4,
        verified_address = $5,
        verified_care_of = $6,
        verified_pincode = $7,
        verified_state = $8,
        verified_district = $9,
        year_of_birth = $10,
        mobile_hash = $11,
        share_code = $12,
        verification_status = CASE 
          WHEN selfie_image_url IS NOT NULL THEN 'verified'
          ELSE 'in_progress'
        END,
        updated_at = NOW()
      WHERE verification_id = $13
    `;
    
    const values = [
      aadharData.name,
      aadharData.dob,
      aadharData.gender,
      aadharData.email,
      aadharData.address,
      aadharData.care_of,
      aadharData.split_address?.pincode?.toString(),
      aadharData.split_address?.state,
      aadharData.split_address?.dist,
      aadharData.year_of_birth,
      aadharData.mobile_hash,
      aadharData.share_code,
      verificationId
    ];
    
    await pool.query(sql, values);
  }

  async updateImageUrl(
    verificationId: string, 
    imageType: ImageType, 
    imageUrl: string
  ): Promise<void> {
    const column = imageType === 'selfie' ? 'selfie_image_url' : 'aadhar_image_url';
    
    const sql = `
      UPDATE user_verification 
      SET 
        ${column} = $1,
        verification_status = CASE 
          WHEN verified_name IS NOT NULL AND selfie_image_url IS NOT NULL THEN 'verified'
          ELSE verification_status
        END,
        updated_at = NOW()
      WHERE verification_id = $2
    `;
    
    await pool.query(sql, [imageUrl, verificationId]);
  }


  async findByUserId(userId: string): Promise<UserVerification | null> {
    const sql = `
      SELECT * FROM user_verification 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await pool.query(sql, [userId]);
    return result.rows[0] ? this.mapToUserVerification(result.rows[0]) : null;
  }

  async findById(verificationId: string): Promise<UserVerification | null> {
    const sql = `SELECT * FROM user_verification WHERE verification_id = $1`;
    const result = await pool.query(sql, [verificationId]);
    return result.rows[0] ? this.mapToUserVerification(result.rows[0]) : null;
  }


  async findByRefId(refId: string): Promise<UserVerification | null> {
    const sql = `SELECT * FROM user_verification WHERE aadhar_ref_id = $1`;
    const result = await pool.query(sql, [refId]);
    return result.rows[0] ? this.mapToUserVerification(result.rows[0]) : null;
  }

  async updateStatus(
    verificationId: string, 
    status: VerificationStatus, 
    notes?: string,
    adminRemarks?: string
  ): Promise<void> {
    const sql = `
      UPDATE user_verification 
      SET 
        verification_status = $1, 
        verification_notes = COALESCE($2, verification_notes),
        admin_remarks = COALESCE($3, admin_remarks),
        updated_at = NOW()
      WHERE verification_id = $4
    `;
    
    await pool.query(sql, [status, notes, adminRemarks, verificationId]);
  }
  async logAttempt(
    verificationId: string,
    attemptType: string,
    attemptData: any,
    isSuccessful: boolean,
    errorMessage?: string
  ): Promise<void> {
    const sql = `
      INSERT INTO verification_attempts (
        verification_id, attempt_type, attempt_data, 
        is_successful, error_message
      )
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    const values = [
      verificationId,
      attemptType,
      JSON.stringify(attemptData),
      isSuccessful,
      errorMessage || null
    ];
    
    await pool.query(sql, values);
  }


  async getAttemptsCount(verificationId: string, attemptType?: string): Promise<number> {
    let sql = `SELECT COUNT(*) FROM verification_attempts WHERE verification_id = $1`;
    const values: any[] = [verificationId];
    
    if (attemptType) {
      sql += ` AND attempt_type = $2`;
      values.push(attemptType);
    }
    
    const result = await pool.query(sql, values);
    return parseInt(result.rows[0].count);
  }


  async findAll(options: {
    status?: VerificationStatus;
    userId?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ verifications: UserVerification[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      whereClause += ` AND v.verification_status = $${paramIndex}`;
      values.push(options.status);
      paramIndex++;
    }

    if (options.userId) {
      whereClause += ` AND v.user_id = $${paramIndex}`;
      values.push(options.userId);
      paramIndex++;
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'DESC';
    const limit = options.limit || 50;
    const offset = options.offset || 0;


    const countSql = `
      SELECT COUNT(*) 
      FROM user_verification v
      JOIN users u ON v.user_id = u.user_id
      ${whereClause}
    `;
    
    const countResult = await pool.query(countSql, values);
    const total = parseInt(countResult.rows[0].count);


    const sql = `
      SELECT v.*, u.name as user_name, u.email as user_email, u.phone_number
      FROM user_verification v
      JOIN users u ON v.user_id = u.user_id
      ${whereClause}
      ORDER BY v.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    values.push(limit, offset);
    const result = await pool.query(sql, values);
    
    const verifications = result.rows.map(row => this.mapToUserVerification(row));

    return { verifications, total };
  }


  async cleanupExpired(): Promise<number> {
    const sql = `
      UPDATE user_verification 
      SET verification_status = 'expired' 
      WHERE verification_status IN ('pending', 'in_progress') 
        AND expires_at < NOW()
    `;
    
    const result = await pool.query(sql);
    return result.rowCount || 0;
  }

  private mapToUserVerification(row: any): UserVerification {
    return {
      id: row.id,
      verification_id: row.verification_id,
      user_id: row.user_id,
      aadhar_number: row.aadhar_number,
      aadhar_ref_id: row.aadhar_ref_id,
      aadhar_otp_generated_at: row.aadhar_otp_generated_at,
      aadhar_verified_at: row.aadhar_verified_at,
      verified_name: row.verified_name,
      verified_dob: row.verified_dob,
      verified_gender: row.verified_gender,
      verified_email: row.verified_email,
      verified_address: row.verified_address,
      verified_care_of: row.verified_care_of,
      verified_pincode: row.verified_pincode,
      verified_state: row.verified_state,
      verified_district: row.verified_district,
      year_of_birth: row.year_of_birth,
      mobile_hash: row.mobile_hash,
      share_code: row.share_code,
      selfie_image_url: row.selfie_image_url,
      aadhar_image_url: row.aadhar_image_url,
      verification_status: row.verification_status,
      verification_notes: row.verification_notes,
      admin_remarks: row.admin_remarks,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      device_info: row.device_info ? JSON.parse(row.device_info) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      verified_at: row.verified_at,
      expires_at: row.expires_at
    };
  }
}

export const verificationRepository = new VerificationRepository();
