import { Pod } from "./Pod";
import { User } from "./User";

export interface Booking {
  id: number;
  booking_id: string;
  user_id: number;
  pod_id: number;
  booking_status: 'confirmed' | 'cancelled' | 'pending';
  check_in: Date;
  check_out: Date;
  total_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingRequest {
  pod_id: number;
  check_in: string;
  check_out: string;
}

export interface BookingResponse extends Booking {
  pod: Pod;
  user: Pick<User, 'name' | 'email' | 'phone_number'>;
  access_code?: {
    access_qr_code: string;
    access_pin: string;
    valid_from: Date;
    valid_until: Date;
  };
}
