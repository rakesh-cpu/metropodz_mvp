import { v4 as uuidv4 } from 'uuid';
import cashfreePaymentService from './cashfreePaymentService';
import { paymentRepository } from '../repositories/paymentRepositories';
import { 
  PaymentOrderResponse,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  CreateBookingPaymentRequest,
  CreatePaymentLinkRequest,
  CreateRefundRequest
} from '../models/Payment';



export class PaymentService {
  async createBookingPayment(data: CreateBookingPaymentRequest): Promise<PaymentOrderResponse> {
    try {
      const provider = await paymentRepository.getDefaultProvider();
      if (!provider) {
        throw new Error('No default payment provider configured');
      }

      const orderId = cashfreePaymentService.generateOrderId();
      

      const cashfreeOrder = await cashfreePaymentService.createOrder({
        order_id: orderId,
        order_amount: data.amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: data.user_id,
          customer_name: data.customer_details.name,
          customer_email: data.customer_details.email,
          customer_phone: data.customer_details.phone,
        },
        order_meta: {
          return_url: data.return_url || `${process.env.FRONTEND_URL}/payment/success`,
          notify_url: data.notify_url || `${process.env.API_BASE_URL}/api/v1/payments/webhook`,
        },
        order_note: data.note || `Metropodz booking payment for ${data.booking_id}`,
        order_tags: {
          booking_id: data.booking_id,
          user_id: data.user_id,
          source: 'metropodz_app',
          ...data.tags,
        },
      });

      const savedOrder = await paymentRepository.createOrder({
        order_id: orderId,
        user_id: data.user_id,
        booking_id: data.booking_id,
        provider_id: provider.provider_id,
        order_amount: data.amount,
        order_currency: 'INR',
        order_status: this.mapCashfreeOrderStatus(cashfreeOrder.order_status),
        provider_order_id: cashfreeOrder.cf_order_id,
        payment_session_id: cashfreeOrder.payment_session_id,
        customer_details: data.customer_details,
        order_note: data.note,
        order_tags: {
          booking_id: data.booking_id,
          user_id: data.user_id,
          source: 'metropodz_app',
          ...data.tags,
        },
        order_meta: {
          return_url: data.return_url,
          notify_url: data.notify_url,
        },
        discount_amount: data.discount_amount || 0,
        tax_amount: data.tax_amount || 0,
        convenience_fee: data.convenience_fee || 0,
        order_expiry_time: cashfreeOrder.order_expiry_time ? new Date(cashfreeOrder.order_expiry_time) : undefined,
      });

      return {
        ...savedOrder,
        provider: {
          provider_name: provider.provider_name,
          provider_id: provider.provider_id,
        },
        user: {
          name: data.customer_details.name,
          email: data.customer_details.email,
          phone_number: data.customer_details.phone,
        },
        transactions: [],
        refunds: [],
      };
    } catch (error: any) {
      console.error('Payment creation error:', error);
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  async getPaymentStatus(orderId: string): Promise<any> {
    try {
      const order = await paymentRepository.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const cashfreeOrder = await cashfreePaymentService.getOrder(orderId);
      
      const payments = await cashfreePaymentService.getOrderPayments(orderId);

    
      const newStatus = this.mapCashfreeOrderStatus(cashfreeOrder.order_status);
      if (order.order_status !== newStatus) {
        await paymentRepository.updateOrder(orderId, {
          order_status: newStatus,
        });
      }

      return {
        orderId,
        cfOrderId: cashfreeOrder.cf_order_id,
        orderStatus: newStatus,
        orderAmount: cashfreeOrder.order_amount,
        orderCurrency: cashfreeOrder.order_currency,
        payments: payments || [],
        bookingId: order.booking_id,
        createdAt: order.created_at,
        expiresAt: cashfreeOrder.order_expiry_time,
      };
    } catch (error: any) {
      console.error('Get payment status error:', error);
      throw new Error(`Get payment status failed: ${error.message}`);
    }
  }

  // Process payment webhook using SDK verification
  async processWebhook(webhookData: any, signature: string, timestamp: string, rawBody: string): Promise<void> {
    try {
      // Get default provider
      const provider = await paymentRepository.getDefaultProvider();
      if (!provider) {
        throw new Error('No default payment provider configured');
      }

      // Verify signature using SDK
      const isValid = cashfreePaymentService.verifyWebhookSignature(signature, rawBody, timestamp);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Save webhook
      const webhookId = await paymentRepository.saveWebhook({
        provider_id: provider.provider_id,
        provider_webhook_id: webhookData.event_id || webhookData.eventId,
        event_type: webhookData.type,
        webhook_data: webhookData,
        webhook_signature: signature,
        webhook_timestamp: new Date(timestamp),
        order_id: webhookData.data?.order?.order_id,
      });

      const { data, type } = webhookData;
      const order = data?.order;
      const payment = data?.payment;

      if (order && payment) {
        // Update order status
        await paymentRepository.updateOrder(order.order_id, {
          order_status: this.mapPaymentStatusToOrderStatus(payment.payment_status),
        });

        // Create or update transaction
        await this.upsertTransaction(order, payment, provider.provider_id);

        // Handle specific webhook types
        switch (type) {
          case 'PAYMENT_SUCCESS_WEBHOOK':
            await this.handlePaymentSuccess(order, payment);
            break;
          case 'PAYMENT_FAILED_WEBHOOK':
            await this.handlePaymentFailure(order, payment);
            break;
          case 'PAYMENT_USER_DROPPED_WEBHOOK':
            await this.handlePaymentDropped(order, payment);
            break;
          case 'PAYMENT_PENDING_WEBHOOK':
            await this.handlePaymentPending(order, payment);
            break;
        }
      }

      // Mark webhook as processed
      await paymentRepository.markWebhookProcessed(webhookId);
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  // Create payment link - Fixed to match controller interface
  async createPaymentLink(data: CreatePaymentLinkRequest): Promise<any> {
    try {
      // Get default provider
      const provider = await paymentRepository.getDefaultProvider();
      if (!provider) {
        throw new Error('No default payment provider configured');
      }

      const linkId = cashfreePaymentService.generateLinkId();
      const orderId = cashfreePaymentService.generateOrderId('LINK');

      // Create payment link using SDK
      const linkResponse = await cashfreePaymentService.createPaymentLink({
        link_id: linkId,
        link_amount: data.amount,
        link_currency: 'INR',
        link_purpose: data.purpose,
        customer_details: {
          customer_phone: data.customer_details.phone,
          customer_name: data.customer_details.name,
          customer_email: data.customer_details.email,
        },
        link_meta: {
          return_url: data.return_url || `${process.env.FRONTEND_URL}/payment/success`,
          notify_url: data.notify_url || `${process.env.API_BASE_URL}/api/v1/payments/webhook`,
        },
        link_notes: {
          user_id: data.user_id,
          source: 'metropodz_app',
          ...data.notes,
        },
        link_expiry_time: data.expiry_time,
      });

      // Save payment link in database
      await paymentRepository.createPaymentLink({
            link_id: linkId,
            internal_link_id: uuidv4(),
            created_by_user_id: data.user_id,
            order_id: orderId,
            provider_id: provider.provider_id,
            link_url: linkResponse.link_url,
            link_purpose: data.purpose,
            link_amount: data.amount,
            link_currency: 'INR',
            link_status: linkResponse.link_status || 'active',
            customer_details: data.customer_details,
            link_notes: {
              user_id: data.user_id,
              source: 'metropodz_app',
              ...data.notes,
            },
            link_meta: {
              return_url: data.return_url,
              notify_url: data.notify_url,
            },
            usage_limit: data.usage_limit || 1,
            // Conditionally include link_expiry_time only if expiry_time exists
            ...(data.expiry_time && { link_expiry_time: new Date(data.expiry_time) }),
          });


      return {
        linkId,
        linkUrl: linkResponse.link_url,
        linkStatus: linkResponse.link_status,
        amount: data.amount,
        currency: 'INR',
        purpose: data.purpose,
        expiryTime: data.expiry_time,
      };
    } catch (error: any) {
      console.error('Payment link creation error:', error);
      throw new Error(`Payment link creation failed: ${error.message}`);
    }
  }

  // Create refund - Fixed to match controller interface
  async createRefund(data: CreateRefundRequest): Promise<any> {
    try {
      // Get default provider
      const provider = await paymentRepository.getDefaultProvider();
      if (!provider) {
        throw new Error('No default payment provider configured');
      }

      const refundId = cashfreePaymentService.generateRefundId();

      // Create refund using SDK
      const refundResponse = await cashfreePaymentService.createRefund({
        order_id: data.order_id,
        refund_amount: data.refund_amount,
        refund_id: refundId,
        refund_note: data.refund_note || 'Metropodz booking refund',
        refund_speed: data.refund_speed || 'STANDARD',
      });

      // Get order details
      const order = await paymentRepository.getOrderById(data.order_id);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get payment ID from the order's transactions
      const payments = await cashfreePaymentService.getOrderPayments(data.order_id);
      const successfulPayment = payments?.find((p: any) => p.payment_status === 'SUCCESS');

      // Save refund in database
      await paymentRepository.createRefund({
            refund_id: refundId,
            internal_refund_id: uuidv4(),
            order_id: data.order_id,
            provider_id: provider.provider_id,
            provider_refund_id: refundResponse.cf_refund_id,
            refund_amount: data.refund_amount,
            refund_currency: refundResponse.refund_currency || 'INR',
            refund_type: this.determineRefundType(data.refund_amount, order.order_amount),
            refund_status: this.mapCashfreeRefundStatus(refundResponse.refund_status),
            refund_reason: data.refund_reason,
            provider_response: refundResponse,
            // Conditionally include optional properties only if they have values
            ...(successfulPayment?.transaction_id && { transaction_id: successfulPayment.transaction_id }),
            ...(data.refund_note && { refund_note: data.refund_note }),
            ...(refundResponse.refund_arn && { refund_arn: refundResponse.refund_arn }),
      });


      return {
        refundId,
        cfRefundId: refundResponse.cf_refund_id,
        refundStatus: refundResponse.refund_status,
        refundAmount: data.refund_amount,
        refundArn: refundResponse.refund_arn,
        estimatedSettlement: refundResponse.refund_splits?.[0]?.amount,
      };
    } catch (error: any) {
      console.error('Refund creation error:', error);
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }

  // Get user payment history
  async getUserPaymentHistory(userId: string, page = 1, limit = 20): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      const orders = await paymentRepository.getOrdersByUser(userId, limit, offset);

      return {
        orders,
        pagination: {
          page,
          limit,
          total: orders.length,
          hasMore: orders.length === limit,
        },
      };
    } catch (error: any) {
      console.error('Get payment history error:', error);
      throw new Error(`Get payment history failed: ${error.message}`);
    }
  }

  // Additional method for getting payments by booking
  async getPaymentsByBooking(bookingId: string, userId: string): Promise<any> {
    try {
      // This method can be implemented when needed
      // For now, return empty array as placeholder
      return {
        payments: [],
        booking_id: bookingId,
        total_amount: 0,
        paid_amount: 0,
        refunded_amount: 0,
      };
    } catch (error: any) {
      console.error('Get payments by booking error:', error);
      throw new Error(`Get payments by booking failed: ${error.message}`);
    }
  }

  // Private helper methods
  private async upsertTransaction(order: any, payment: any, providerId: string): Promise<void> {
    try {
      const transactionData = {
        transaction_id: `TXN_${payment.cf_payment_id}`,
        order_id: order.order_id,
        provider_id: providerId,
        provider_payment_id: payment.cf_payment_id,
        provider_transaction_id: payment.transaction_id,
        transaction_amount: payment.payment_amount,
        transaction_currency: payment.payment_currency,
        payment_status: this.mapCashfreePaymentStatus(payment.payment_status),
        payment_method: payment.payment_method?.type || 'unknown',
        payment_method_details: payment.payment_method,
        gateway_name: payment.payment_gateway,
        gateway_transaction_id: payment.gateway_transaction_id,
        bank_reference_number: payment.bank_reference,
        auth_id_code: payment.auth_id,
        rrn: payment.rrn,
        payment_message: payment.payment_message,
        failure_reason: payment.error_details?.error_description,
        gateway_response: payment,
        transaction_time: payment.payment_time ? new Date(payment.payment_time) : new Date(),
      };

      // Check if transaction exists
      const existingTransaction = await paymentRepository.getTransactionByPaymentId(
        payment.cf_payment_id
      );

      if (existingTransaction) {
        await paymentRepository.updateTransaction(payment.cf_payment_id, transactionData);
      } else {
        await paymentRepository.createTransaction(transactionData);
      }
    } catch (error: any) {
      console.error('Error upserting transaction:', error);
      // Don't throw error here to avoid breaking webhook processing
    }
  }

  // Helper method to determine refund type
  private determineRefundType(refundAmount: number, orderAmount: number): string {
    if (refundAmount >= orderAmount) {
      return 'full';
    } else if (refundAmount > 0) {
      return 'partial';
    }
    return 'full'; // default
  }

  // Status mapping methods
  private mapCashfreeOrderStatus(cashfreeStatus: string): OrderStatus {
    switch (cashfreeStatus?.toUpperCase()) {
      case 'ACTIVE':
        return 'active';
      case 'PAID':
        return 'paid';
      case 'EXPIRED':
        return 'expired';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'created';
    }
  }

  private mapCashfreePaymentStatus(cashfreeStatus: string): PaymentStatus {
    switch (cashfreeStatus?.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'failed';
      case 'PENDING':
        return 'pending';
      case 'USER_DROPPED':
        return 'user_dropped';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'initiated';
    }
  }

  private mapCashfreeRefundStatus(cashfreeStatus: string): RefundStatus {
    switch (cashfreeStatus?.toUpperCase()) {
      case 'SUCCESS':
        return 'successful';
      case 'PENDING':
        return 'pending';
      case 'CANCELLED':
        return 'cancelled';
      case 'FAILED':
        return 'failed';
      default:
        return 'initiated';
    }
  }

  private mapPaymentStatusToOrderStatus(paymentStatus: string): OrderStatus {
    switch (paymentStatus?.toUpperCase()) {
      case 'SUCCESS':
        return 'paid';
      case 'FAILED':
      case 'USER_DROPPED':
        return 'cancelled';
      case 'PENDING':
        return 'active';
      default:
        return 'created';
    }
  }

  // Event handlers
  private async handlePaymentSuccess(order: any, payment: any): Promise<void> {
    console.log(`✅ Payment successful for order: ${order.order_id}`);
    
    if (order.order_tags?.booking_id) {
      console.log(`📅 Confirming booking: ${order.order_tags.booking_id}`);
      // TODO: Call booking service to confirm booking
      // await bookingService.confirmBooking(order.order_tags.booking_id);
    }

    // TODO: Send success notification to user
    // TODO: Send receipt email
  }

  private async handlePaymentFailure(order: any, payment: any): Promise<void> {
    console.log(`❌ Payment failed for order: ${order.order_id}, reason: ${payment.payment_message}`);
    
    // TODO: Send notification to user about payment failure
    // TODO: Log failure reason for analysis
  }

  private async handlePaymentDropped(order: any, payment: any): Promise<void> {
    console.log(`🚫 Payment dropped for order: ${order.order_id}`);
    
    // TODO: Send reminder to user to complete payment
    // TODO: Set up retry mechanism
  }

  private async handlePaymentPending(order: any, payment: any): Promise<void> {
    console.log(`⏳ Payment pending for order: ${order.order_id}`);
    
    // TODO: Set up monitoring for pending payments
    // TODO: Send pending status notification if needed
  }
}

export const paymentService = new PaymentService();
