// src/models/Payment.ts

import { User } from "./User";
import { Booking } from "./Booking";



export type OrderStatus = 
  | 'created' 
  | 'active' 
  | 'paid' 
  | 'expired' 
  | 'cancelled' 
  | 'partially_refunded' 
  | 'fully_refunded';

export type PaymentStatus = 
  | 'initiated' 
  | 'pending' 
  | 'success' 
  | 'failed' 
  | 'cancelled' 
  | 'timeout' 
  | 'user_dropped';

export type PaymentMethod = 
  | 'upi' 
  | 'card' 
  | 'netbanking' 
  | 'wallet' 
  | 'emi' 
  | 'cardless_emi' 
  | 'paylater' 
  | 'bank_transfer' 
  | 'cash' 
  | 'other';

export type RefundStatus = 
  | 'initiated' 
  | 'pending' 
  | 'processed' 
  | 'successful' 
  | 'failed' 
  | 'cancelled';

export type RefundType = 
  | 'full' 
  | 'partial' 
  | 'cancellation' 
  | 'dispute' 
  | 'goodwill';

export type LinkStatus = 
  | 'active' 
  | 'paid' 
  | 'expired' 
  | 'cancelled' 
  | 'inactive';


export interface PaymentProvider {
  id: number;
  provider_id: string;
  provider_name: string;
  provider_config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  supported_countries: string[];
  supported_currencies: string[];
  created_at: Date;
  updated_at: Date;
}
export interface CreateBookingPaymentRequest {
  user_id: string;
  booking_id: string;
  amount: number;
  customer_details: {
    name: string;
    email: string;
    phone: string;
  };
  return_url?: string;
  notify_url?: string;
  note?: string;
  tags?: Record<string, any>;
  discount_amount?: number;
  tax_amount?: number;
  convenience_fee?: number;
}

export interface CreatePaymentLinkRequest {
  user_id: string;
  amount: number;
  purpose: string;
  customer_details: {
    name: string;
    email: string;
    phone: string;
  };
  expiry_time?: string;
  return_url?: string;
  notify_url?: string;
  notes?: Record<string, any>;
  usage_limit?: number;
}

export interface CreateRefundRequest {
  order_id: string;
  refund_amount: number;
  refund_note?: string;
  refund_reason?: string;
  refund_speed?: 'INSTANT' | 'STANDARD';
}

export interface PaymentOrder {
  status(status: any): unknown;
  id: number;
  order_id: string;
  internal_order_id: string;
  user_id: string;
  booking_id?: string;
  provider_id: string;
  order_amount: number;
  order_currency: string;
  order_status: OrderStatus;
  provider_order_id?: string;
  payment_session_id?: string;
  customer_details: CustomerDetails;
  order_note?: string;
  order_tags?: Record<string, any>;
  order_meta?: Record<string, any>;
  discount_amount: number;
  tax_amount: number;
  convenience_fee: number;
  net_amount: number;
  order_expiry_time?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentTransaction {
  id: number;
  transaction_id: string;
  order_id: string;
  provider_id: string;
  provider_payment_id?: string;
  provider_transaction_id?: string;
  transaction_amount: number;
  transaction_currency: string;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_method_details?: PaymentMethodDetails;
  gateway_name?: string;
  gateway_transaction_id?: string;
  bank_reference_number?: string;
  auth_id_code?: string;
  rrn?: string;
  settlement_amount?: number;
  settlement_currency?: string;
  gateway_fee?: number;
  gateway_tax?: number;
  payment_message?: string;
  failure_reason?: string;
  gateway_response?: Record<string, any>;
  risk_score?: number;
  fraud_details?: Record<string, any>;
  transaction_time: Date;
  gateway_settled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRefund {
  id: number;
  refund_id: string;
  internal_refund_id: string;
  order_id: string;
  transaction_id?: string;
  provider_id: string;
  provider_refund_id?: string;
  refund_amount: number;
  refund_currency: string;
  refund_type: RefundType;
  refund_status: RefundStatus;
  refund_reason?: string;
  refund_note?: string;
  requested_by?: string;
  gateway_refund_id?: string;
  bank_reference_number?: string;
  refund_arn?: string;
  gateway_fee: number;
  settlement_amount?: number;
  settlement_currency?: string;
  refund_speed: string;
  expected_settlement_date?: Date;
  actual_settlement_date?: Date;
  provider_response?: Record<string, any>;
  failure_reason?: string;
  refund_initiated_at: Date;
  refund_processed_at?: Date;
  refund_settled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentLink {
  id: number;
  link_id: string;
  internal_link_id: string;
  created_by_user_id: string;
  order_id?: string;
  provider_id: string;
  link_url: string;
  link_purpose: string;
  link_amount: number;
  link_currency: string;
  link_status: LinkStatus;
  customer_details?: CustomerDetails;
  link_notes?: Record<string, any>;
  link_meta?: Record<string, any>;
  link_expiry_time?: Date;
  usage_limit: number;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
  first_paid_at?: Date;
  last_paid_at?: Date;
}


export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  } | undefined;
}

export interface PaymentMethodDetails {
  card?: {
    last4?: string;
    brand?: string;
    network?: string;
    type?: 'credit' | 'debit';
    bank?: string;
    country?: string;
  };

  upi?: {
    handle?: string;
    payer_name?: string;
    payer_account?: string;
  };
  
  netbanking?: {
    bank_name?: string;
    bank_code?: string;
  };
  
  wallet?: {
    provider?: string;
    phone?: string;
  };
  
  emi?: {
    tenure?: number;
    interest_rate?: number;
    provider?: string;
  };
}

// Request Interface

export interface CreatePaymentOrderRequest {
  user_id: string;
  booking_id?: string;
  amount: number;
  customer_details: CustomerDetails;
  return_url?: string;
  notify_url?: string;
  note?: string;
  tags?: Record<string, any>;
  discount_amount?: number;
  tax_amount?: number;
  convenience_fee?: number;
}

export interface CreatePaymentLinkRequest {
  user_id: string;
  amount: number;
  purpose: string;
  expiry_time?: string;
  return_url?: string;
  notify_url?: string;
  notes?: Record<string, any>;
  usage_limit?: number;
}

export interface CreateRefundRequest {
  order_id: string;
  refund_amount: number;
  refund_note?: string;
  refund_reason?: string;
  refund_speed?: 'INSTANT' | 'STANDARD';
}

//Response interface

export interface PaymentOrderResponse extends PaymentOrder {
  provider: Pick<PaymentProvider, 'provider_name' | 'provider_id'>;
  user: Pick<User, 'name' | 'email' | 'phone_number'>;
  booking?: Pick<Booking, 'booking_id' | 'check_in' | 'check_out' | 'total_price'>;
  transactions?: PaymentTransactionSummary[];
  refunds?: PaymentRefundSummary[];
}

export interface PaymentTransactionResponse extends PaymentTransaction {
  order: Pick<PaymentOrder, 'order_id' | 'order_amount' | 'order_status'>;
  provider: Pick<PaymentProvider, 'provider_name' | 'provider_id'>;
}

export interface PaymentRefundResponse extends PaymentRefund {
  order: Pick<PaymentOrder, 'order_id' | 'order_amount' | 'user_id'>;
  transaction?: Pick<PaymentTransaction, 'transaction_id' | 'provider_payment_id'>;
  provider: Pick<PaymentProvider, 'provider_name' | 'provider_id'>;
}

export interface PaymentLinkResponse extends PaymentLink {
  provider: Pick<PaymentProvider, 'provider_name' | 'provider_id'>;
  creator: Pick<User, 'name' | 'email'>;
  order?: Pick<PaymentOrder, 'order_id' | 'order_status'>;
}

//interface for list and history
export interface PaymentTransactionSummary {
  transaction_id: string;
  provider_payment_id?: string;
  transaction_amount: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_message?: string;
  transaction_time: Date;
}

export interface PaymentRefundSummary {
  refund_id: string;
  refund_amount: number;
  refund_status: RefundStatus;
  refund_type: RefundType;
  refund_reason?: string;
  refund_initiated_at: Date;
  refund_settled_at?: Date;
}

export interface PaymentHistoryItem {
  order_id: string;
  booking_id?: string;
  order_amount: number;
  order_status: OrderStatus;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_time?: Date;
  booking_details?: {
    check_in: Date;
    check_out: Date;
    pod_number?: string;
  };
  created_at: Date;
}

//webhook interface

export interface PaymentWebhookData {
  event_id: string;
  type: string;
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
      order_tags?: Record<string, any>;
    };
    payment: {
      cf_payment_id: string;
      payment_status: string;
      payment_amount: number;
      payment_currency: string;
      payment_time: string;
      payment_method?: PaymentMethodDetails;
      payment_message?: string;
      bank_reference?: string;
      auth_id?: string;
      payment_gateway_details?: Record<string, any>;
      error_details?: Record<string, any>;
    };
  };
  event_time: string;
}

// pagination and filters

export interface PaymentFilters {
  user_id?: string;
  booking_id?: string;
  order_status?: OrderStatus[];
  payment_status?: PaymentStatus[];
  payment_method?: PaymentMethod[];
  amount_min?: number;
  amount_max?: number;
  date_from?: string;
  date_to?: string;
  provider_id?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

//api response wrapper

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: string[];
}

export interface PaymentApiResponse<T = any> extends ApiResponse<T> {
  order_id?: string;
  transaction_id?: string;
  refund_id?: string;
}

//cashfree interface

export interface CashfreeOrderData {
  order_id: string;
  order_amount: number;
  order_currency: string;
  customer_details: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta: {
    return_url: string;
    notify_url?: string;
  };
  order_note?: string;
  order_tags?: Record<string, any>;
  order_expiry_time?: string;
}

export interface CashfreePaymentLinkData {
  link_id: string;
  link_amount: number;
  link_currency: string;
  link_purpose: string;
  customer_details: {
    customer_phone: string;
    customer_name?: string;
    customer_email?: string;
  };
  link_meta?: {
    return_url?: string;
    notify_url?: string;
  };
  link_notes?: Record<string, any>;
  link_expiry_time?: string;
}

export interface CashfreeRefundData {
  order_id: string;
  refund_amount: number;
  refund_id: string;
  refund_note?: string;
  refund_speed?: 'INSTANT' | 'STANDARD';
}

//business logic interface

export interface PaymentCalculation {
  base_amount: number;
  discount_amount: number;
  tax_amount: number;
  convenience_fee: number;
  net_amount: number;
  currency: string;
}

export interface RefundCalculation {
  order_amount: number;
  paid_amount: number;
  previous_refunds: number;
  max_refundable: number;
  requested_amount: number;
  eligible_amount: number;
  refund_fees?: number;
}

export interface PaymentStats {
  total_orders: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: number;
  total_refunds: number;
  success_rate: number;
  average_order_value: number;
}

