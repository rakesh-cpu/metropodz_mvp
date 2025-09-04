export interface User {
  id: number;
  user_id: string;
  name: string;
  email: string;
  phone_number: string;
  country_code: string;
  internationalized_phone_number: string;
  password_hash: string;
  user_type: string;
  area?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  location?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone_number: string;
  country_code: string;
  password: string;
  area?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface LoginRequest {
  email?: string;
  phone_number?: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  area?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}
