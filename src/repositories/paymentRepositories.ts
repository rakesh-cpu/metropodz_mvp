import pool from '../config/database';
import { 
  PaymentOrder, 
  PaymentTransaction, 
  PaymentRefund, 
  PaymentLink,
  PaymentProvider,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  CreatePaymentOrderRequest,
  CreatePaymentLinkRequest
} from '../models/Payment';

export class PaymentRepository {
 
  // PROVIDER OPERATIONS
 
  async getDefaultProvider(): Promise<PaymentProvider | null> {
    const sql = 'SELECT * FROM payment_providers WHERE is_default = true AND is_active = true LIMIT 1';
    const result = await pool.query(sql);
    return result.rows[0] || null;
  }

  async getProviderById(providerId: string): Promise<PaymentProvider | null> {
    const sql = 'SELECT * FROM payment_providers WHERE provider_id = $1';
    const result = await pool.query(sql, [providerId]);
    return result.rows[0] || null;
  }

  // ==========================================
  // PAYMENT ORDER OPERATIONS
  // ==========================================

  async createOrder(orderData: {
    order_id: string;
    user_id: string;
    booking_id: string;
    provider_id: string;
    order_amount: number;
    order_currency: string;
    order_status: OrderStatus;
    provider_order_id?: string | undefined;
    payment_session_id?: string | undefined;
    customer_details: any;
    order_note?: string | undefined;
    order_tags?: any;
    order_meta?: any;
    discount_amount?: number | undefined;
    tax_amount?: number |undefined;
    convenience_fee?: number | undefined;
    order_expiry_time?: Date | undefined;
  }): Promise<PaymentOrder> {
    const sql = `
      INSERT INTO payment_orders (
        order_id, internal_order_id, user_id, booking_id, provider_id, 
        order_amount, order_currency, order_status, provider_order_id, 
        payment_session_id, customer_details, order_note, order_tags, 
        order_meta, discount_amount, tax_amount, convenience_fee, order_expiry_time
      )
      VALUES ($1, uuid_generate_v4(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    
    const values = [
      orderData.order_id,
      orderData.user_id,
      orderData.booking_id || null,
      orderData.provider_id,
      orderData.order_amount,
      orderData.order_currency,
      orderData.order_status,
      orderData.provider_order_id || null,
      orderData.payment_session_id || null,
      JSON.stringify(orderData.customer_details),
      orderData.order_note || null,
      orderData.order_tags ? JSON.stringify(orderData.order_tags) : null,
      orderData.order_meta ? JSON.stringify(orderData.order_meta) : null,
      orderData.discount_amount || 0,
      orderData.tax_amount || 0,
      orderData.convenience_fee || 0,
      orderData.order_expiry_time || null
    ];
    
    const result = await pool.query(sql, values);
    return result.rows[0];
  }

  async updateOrder(orderId: string, updates: Partial<PaymentOrder>): Promise<void> {
  const setClause = [];
  const values: any[] = [orderId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === 'customer_details' || key === 'order_tags' || key === 'order_meta') {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else if (key === 'order_expiry_time' && value instanceof Date) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value.toISOString());
      } else if (typeof value === 'string' || typeof value === 'number' || value === null) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
      } else if (typeof value === 'function') {
        // Skip function properties - they shouldn't be in database updates
        continue;
      } else {
        // Handle other types by converting to string
        setClause.push(`${key} = $${paramIndex}`);
        values.push(String(value));
      }
      paramIndex++;
    }
  }

  if (setClause.length === 0) return;

  const sql = `
    UPDATE payment_orders 
    SET ${setClause.join(', ')}, updated_at = NOW() 
    WHERE order_id = $1
  `;
  
  await pool.query(sql, values);
}


  async getOrderById(orderId: string): Promise<PaymentOrder | null> {
    const sql = 'SELECT * FROM payment_orders WHERE order_id = $1';
    const result = await pool.query(sql, [orderId]);
    if (result.rows[0]) {
      // Parse JSON fields
      const order = result.rows[0];
      if (order.customer_details) order.customer_details = JSON.parse(order.customer_details);
      if (order.order_tags) order.order_tags = JSON.parse(order.order_tags);
      if (order.order_meta) order.order_meta = JSON.parse(order.order_meta);
      return order;
    }
    return null;
  }

  async getOrdersByUser(userId: string, limit = 20, offset = 0): Promise<PaymentOrder[]> {
    const sql = `
      SELECT po.*, pt.payment_status, pt.payment_method, pt.transaction_time
      FROM payment_orders po
      LEFT JOIN payment_transactions pt ON po.order_id = pt.order_id 
        AND pt.payment_status = 'success'
      WHERE po.user_id = $1
      ORDER BY po.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(sql, [userId, limit, offset]);
    
    return result.rows.map(order => {
      // Parse JSON fields
      if (order.customer_details) order.customer_details = JSON.parse(order.customer_details);
      if (order.order_tags) order.order_tags = JSON.parse(order.order_tags);
      if (order.order_meta) order.order_meta = JSON.parse(order.order_meta);
      return order;
    });
  }

  // ==========================================
  // TRANSACTION OPERATIONS
  // ==========================================

  async createTransaction(transactionData: {
    transaction_id: string;
    order_id: string;
    provider_id: string;
    provider_payment_id?: string;
    provider_transaction_id?: string;
    transaction_amount: number;
    transaction_currency: string;
    payment_status: PaymentStatus;
    payment_method?: string;
    payment_method_details?: any;
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
    gateway_response?: any;
    transaction_time?: Date;
  }): Promise<PaymentTransaction> {
    const sql = `
      INSERT INTO payment_transactions (
        transaction_id, order_id, provider_id, provider_payment_id, 
        provider_transaction_id, transaction_amount, transaction_currency, 
        payment_status, payment_method, payment_method_details, gateway_name, 
        gateway_transaction_id, bank_reference_number, auth_id_code, rrn, 
        settlement_amount, settlement_currency, gateway_fee, gateway_tax, 
        payment_message, failure_reason, gateway_response, transaction_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;
    
    const values = [
      transactionData.transaction_id,
      transactionData.order_id,
      transactionData.provider_id,
      transactionData.provider_payment_id || null,
      transactionData.provider_transaction_id || null,
      transactionData.transaction_amount,
      transactionData.transaction_currency,
      transactionData.payment_status,
      transactionData.payment_method || null,
      transactionData.payment_method_details ? JSON.stringify(transactionData.payment_method_details) : null,
      transactionData.gateway_name || null,
      transactionData.gateway_transaction_id || null,
      transactionData.bank_reference_number || null,
      transactionData.auth_id_code || null,
      transactionData.rrn || null,
      transactionData.settlement_amount || null,
      transactionData.settlement_currency || null,
      transactionData.gateway_fee || null,
      transactionData.gateway_tax || null,
      transactionData.payment_message || null,
      transactionData.failure_reason || null,
      transactionData.gateway_response ? JSON.stringify(transactionData.gateway_response) : null,
      transactionData.transaction_time || new Date()
    ];
    
    const result = await pool.query(sql, values);
    const transaction = result.rows[0];
    if (transaction.payment_method_details) transaction.payment_method_details = JSON.parse(transaction.payment_method_details);
    if (transaction.gateway_response) transaction.gateway_response = JSON.parse(transaction.gateway_response);
    return transaction;
  }

  async updateTransaction(providerPaymentId: string, updates: Partial<PaymentTransaction>): Promise<void> {
  const setClause = [];
  const values: any[] = [providerPaymentId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === 'payment_method_details' || key === 'gateway_response') {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else if (key === 'transaction_time' && value instanceof Date) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value.toISOString());
      } else if (typeof value === 'string' || typeof value === 'number' || value === null) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
      } else if (typeof value === 'function') {
        // Skip function properties - they shouldn't be in database updates
        continue;
      } else {
        // Handle other types by converting to string
        setClause.push(`${key} = $${paramIndex}`);
        values.push(String(value));
      }
      paramIndex++;
    }
  }

  if (setClause.length === 0) return;

  const sql = `
    UPDATE payment_transactions 
    SET ${setClause.join(', ')}, updated_at = NOW() 
    WHERE provider_payment_id = $1
  `;
  
  await pool.query(sql, values);
  }


  async getTransactionByPaymentId(providerPaymentId: string): Promise<PaymentTransaction | null> {
    const sql = 'SELECT * FROM payment_transactions WHERE provider_payment_id = $1';
    const result = await pool.query(sql, [providerPaymentId]);
    if (result.rows[0]) {
      const transaction = result.rows[0];
      if (transaction.payment_method_details) transaction.payment_method_details = JSON.parse(transaction.payment_method_details);
      if (transaction.gateway_response) transaction.gateway_response = JSON.parse(transaction.gateway_response);
      return transaction;
    }
    return null;
  }

  // ==========================================
  // REFUND OPERATIONS
  // ==========================================

  async createRefund(refundData: {
    refund_id: string;
    internal_refund_id: string;
    order_id: string;
    transaction_id?: string;
    provider_id: string;
    provider_refund_id?: string;
    refund_amount: number;
    refund_currency: string;
    refund_type: string;
    refund_status: RefundStatus;
    refund_reason?: string;
    refund_note?: string;
    requested_by?: string;
    gateway_refund_id?: string;
    bank_reference_number?: string;
    refund_arn?: string;
    gateway_fee?: number;
    settlement_amount?: number;
    settlement_currency?: string;
    refund_speed?: string;
    expected_settlement_date?: Date;
    actual_settlement_date?: Date;
    provider_response?: any;
    refund_initiated_at?: Date;
    refund_processed_at?: Date;
  }): Promise<PaymentRefund> {
    const sql = `
      INSERT INTO payment_refunds (
        refund_id, internal_refund_id, order_id, transaction_id, provider_id,
        provider_refund_id, refund_amount, refund_currency, refund_type, refund_status,
        refund_reason, refund_note, requested_by, gateway_refund_id, bank_reference_number,
        refund_arn, gateway_fee, settlement_amount, settlement_currency, refund_speed,
        expected_settlement_date, actual_settlement_date, provider_response,
        refund_initiated_at, refund_processed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;
    
    const values = [
      refundData.refund_id,
      refundData.internal_refund_id,
      refundData.order_id,
      refundData.transaction_id || null,
      refundData.provider_id,
      refundData.provider_refund_id || null,
      refundData.refund_amount,
      refundData.refund_currency,
      refundData.refund_type,
      refundData.refund_status,
      refundData.refund_reason || null,
      refundData.refund_note || null,
      refundData.requested_by || null,
      refundData.gateway_refund_id || null,
      refundData.bank_reference_number || null,
      refundData.refund_arn || null,
      refundData.gateway_fee || 0,
      refundData.settlement_amount || null,
      refundData.settlement_currency || null,
      refundData.refund_speed || 'STANDARD',
      refundData.expected_settlement_date || null,
      refundData.actual_settlement_date || null,
      refundData.provider_response ? JSON.stringify(refundData.provider_response) : null,
      refundData.refund_initiated_at || new Date(),
      refundData.refund_processed_at || null
    ];
    
    const result = await pool.query(sql, values);
    const refund = result.rows[0];
    if (refund.provider_response) refund.provider_response = JSON.parse(refund.provider_response);
    return refund;
  }

  // ==========================================
  // PAYMENT LINK OPERATIONS
  // ==========================================

  async createPaymentLink(linkData: {
    link_id: string;
    internal_link_id: string;
    created_by_user_id: string;
    order_id?: string;
    provider_id: string;
    link_url: string;
    link_purpose: string;
    link_amount: number;
    link_currency: string;
    link_status: string;
    customer_details?: any;
    link_notes?: any;
    link_meta?: any;
    link_expiry_time?: Date;
    usage_limit?: number;
  }): Promise<PaymentLink> {
    const sql = `
      INSERT INTO payment_links (
        link_id, internal_link_id, created_by_user_id, order_id, provider_id,
        link_url, link_purpose, link_amount, link_currency, link_status,
        customer_details, link_notes, link_meta, link_expiry_time, usage_limit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    
    const values = [
      linkData.link_id,
      linkData.internal_link_id,
      linkData.created_by_user_id,
      linkData.order_id || null,
      linkData.provider_id,
      linkData.link_url,
      linkData.link_purpose,
      linkData.link_amount,
      linkData.link_currency,
      linkData.link_status,
      linkData.customer_details ? JSON.stringify(linkData.customer_details) : null,
      linkData.link_notes ? JSON.stringify(linkData.link_notes) : null,
      linkData.link_meta ? JSON.stringify(linkData.link_meta) : null,
      linkData.link_expiry_time || null,
      linkData.usage_limit || 1
    ];
    
    const result = await pool.query(sql, values);
    const link = result.rows[0];
    if (link.customer_details) link.customer_details = JSON.parse(link.customer_details);
    if (link.link_notes) link.link_notes = JSON.parse(link.link_notes);
    if (link.link_meta) link.link_meta = JSON.parse(link.link_meta);
    return link;
  }

  // ==========================================
  // WEBHOOK OPERATIONS
  // ==========================================

  async saveWebhook(webhookData: {
    provider_id: string;
    provider_webhook_id?: string;
    event_type: string;
    webhook_data: any;
    webhook_signature?: string;
    webhook_timestamp?: Date;
    order_id?: string;
    transaction_id?: string;
    refund_id?: string;
  }): Promise<number> {
    const sql = `
      INSERT INTO payment_webhooks (
        provider_id, provider_webhook_id, event_type, webhook_data,
        webhook_signature, webhook_timestamp, order_id, transaction_id, refund_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    
    const values = [
      webhookData.provider_id,
      webhookData.provider_webhook_id || null,
      webhookData.event_type,
      JSON.stringify(webhookData.webhook_data),
      webhookData.webhook_signature || null,
      webhookData.webhook_timestamp || new Date(),
      webhookData.order_id || null,
      webhookData.transaction_id || null,
      webhookData.refund_id || null
    ];
    
    const result = await pool.query(sql, values);
    return result.rows[0].id;
  }

  async markWebhookProcessed(webhookId: number): Promise<void> {
    const sql = 'UPDATE payment_webhooks SET webhook_status = $1, processed_at = NOW() WHERE id = $2';
    await pool.query(sql, ['processed', webhookId]);
  }
}

export const paymentRepository = new PaymentRepository();
