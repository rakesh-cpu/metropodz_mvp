import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { CreateUserRequest, LoginRequest, User } from '../models/User';
import { ValidationUtils } from '../utils/validation';

export class AuthService {
  private jwtSecret = process.env.JWT_SECRET || 'metropodz_mvp';

  async register(userData: CreateUserRequest): Promise<{ user: Omit<User, 'password_hash'>, token: string }> {
    const { name, email, phone_number, country_code, password, area, address, city, state, country, pincode, latitude, longitude } = userData;

    // Validation
    if (!ValidationUtils.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!ValidationUtils.isValidPhoneNumber(phone_number)) {
      throw new Error('Invalid phone number format');
    }

    // Check if user already exists
    const existingUserQuery = `
      SELECT id FROM users WHERE email = $1 OR phone_number = $2
    `;
    const existingUser = await pool.query(existingUserQuery, [email, phone_number]);
    
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email or phone number');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create internationalized phone number
    const internationalPhone = `${country_code}${phone_number}`;

    // Prepare location if coordinates provided
    let locationPoint = null;
    if (latitude && longitude && ValidationUtils.isValidCoordinates(latitude, longitude)) {
      locationPoint = `POINT(${longitude} ${latitude})`;
    }

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

    const token = this.generateToken(newUser.id, newUser.user_id);

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

    const token = this.generateToken(user.id, user.user_id);
    const { password_hash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  private generateToken(userId: number, userUuid: string): string {
    return jwt.sign(
      { userId, userUuid },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): { userId: number; userUuid: string } {
    try {
      return jwt.verify(token, this.jwtSecret) as { userId: number; userUuid: string };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
