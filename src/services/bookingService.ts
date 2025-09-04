import pool from '../config/database';
import { CreateBookingRequest, BookingResponse } from '../models/Booking';
import { QRGenerator } from '../utils/qrGenerator';
import { ValidationUtils } from '../utils/validation';

export class BookingService {
  async createBooking(userId: number, bookingData: CreateBookingRequest): Promise<BookingResponse> {
    const { pod_id, check_in, check_out } = bookingData;

    if (!ValidationUtils.isValidDateRange(check_in, check_out)) {
      throw new Error('Invalid date range');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check pod availability
      const podQuery = `
        SELECT id, pod_id, status, price_per_hour, max_capacity 
        FROM pods 
        WHERE id = $1 AND status = 'available'
      `;
      const podResult = await client.query(podQuery, [pod_id]);

      if (podResult.rows.length === 0) {
        throw new Error('Pod not available');
      }

      const pod = podResult.rows[0];

      // Check for conflicting bookings
      const conflictQuery = `
        SELECT id FROM bookings 
        WHERE pod_id = $1 
        AND booking_status = 'confirmed'
        AND (
          (check_in <= $2 AND check_out > $2) OR
          (check_in < $3 AND check_out >= $3) OR
          (check_in >= $2 AND check_out <= $3)
        )
      `;
      const conflictResult = await client.query(conflictQuery, [pod_id, check_in, check_out]);

      if (conflictResult.rows.length > 0) {
        throw new Error('Pod already booked for this time slot');
      }

      // Calculate total price (hours * price_per_hour)
      const checkInDate = new Date(check_in);
      const checkOutDate = new Date(check_out);
      const hours = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60));
      const totalPrice = hours * parseFloat(pod.price_per_hour);

      // Create booking
      const bookingQuery = `
        INSERT INTO bookings (user_id, pod_id, booking_status, check_in, check_out, total_price)
        VALUES ($1, $2, 'pending', $3, $4, $5)
        RETURNING *
      `;
      const bookingResult = await client.query(bookingQuery, [userId, pod_id, check_in, check_out, totalPrice]);
      const newBooking = bookingResult.rows[0];

      // Generate access code and QR
      const accessPin = QRGenerator.generateAccessPin();
      const qrCode = await QRGenerator.generateAccessQRData(
        newBooking.booking_id,
        accessPin,
        checkInDate,
        checkOutDate
      );

      // Insert access code
      const accessQuery = `
        INSERT INTO access_code (booking_id, access_qr_code, access_pin, valid_from, valid_until, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING access_qr_code, access_pin, valid_from, valid_until
      `;
      const accessResult = await client.query(accessQuery, [
        newBooking.id, qrCode, accessPin, check_in, check_out
      ]);

      await client.query('COMMIT');

      // Get full booking details
      const fullBooking = await this.getBookingById(newBooking.booking_id);
      return {
        ...fullBooking,
        access_code: accessResult.rows[0]
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBookingById(bookingId: string): Promise<BookingResponse> {
    const query = `
      SELECT 
        b.*,
        json_build_object(
          'id', p.id,
          'pod_id', p.pod_id,
          'pod_number', p.pod_number,
          'description', p.description,
          'address', p.address,
          'price_per_hour', p.price_per_hour
        ) as pod,
        json_build_object(
          'name', u.name,
          'email', u.email,
          'phone_number', u.phone_number
        ) as user
      FROM bookings b
      JOIN pods p ON b.pod_id = p.id
      JOIN users u ON b.user_id = u.id
      WHERE b.booking_id = $1
    `;

    const result = await pool.query(query, [bookingId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found');
    }

    return result.rows[0];
  }

  async getUserBookings(userId: number): Promise<BookingResponse[]> {
    const query = `
      SELECT 
        b.*,
        json_build_object(
          'id', p.id,
          'pod_id', p.pod_id,
          'pod_number', p.pod_number,
          'description', p.description,
          'address', p.address,
          'price_per_hour', p.price_per_hour
        ) as pod
      FROM bookings b
      JOIN pods p ON b.pod_id = p.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async confirmBooking(bookingId: string): Promise<void> {
    const query = `
      UPDATE bookings 
      SET booking_status = 'confirmed', updated_at = NOW()
      WHERE booking_id = $1 AND booking_status = 'pending'
      RETURNING *
    `;

    const result = await pool.query(query, [bookingId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or already processed');
    }
  }

  async cancelBooking(bookingId: string, userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update booking status
      const updateQuery = `
        UPDATE bookings 
        SET booking_status = 'cancelled', updated_at = NOW()
        WHERE booking_id = $1 AND user_id = $2
        RETURNING *
      `;
      const result = await client.query(updateQuery, [bookingId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Booking not found or unauthorized');
      }

      // Revoke access code
      const revokeAccessQuery = `
        UPDATE access_code 
        SET status = 'revoked'
        WHERE booking_id = $1
      `;
      await client.query(revokeAccessQuery, [result.rows[0].id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
