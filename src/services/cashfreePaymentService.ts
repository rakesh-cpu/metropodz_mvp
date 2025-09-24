import { Cashfree, CFEnvironment } from 'cashfree-pg';
import { v4 as uuidv4 } from 'uuid';

interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  environment: 'SANDBOX' | 'PRODUCTION';
}

export class CashfreePaymentService {
  private cashfree: Cashfree;

  constructor(config: CashfreeConfig) {
    this.cashfree = new Cashfree(
      config.environment === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
      config.clientId,
      config.clientSecret
    );
  }

  
    async createOrder(orderData: {
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
    }): Promise<any> {
      try {
        const response = await this.cashfree.PGCreateOrder(orderData);
        return response.data;
      } catch (error: any) {
        throw new Error(`Create order failed: ${error.response?.data?.message || error.message}`);
      }
    }


  async getOrder(orderId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGFetchOrder(orderId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get order failed: ${error.response?.data?.message || error.message}`);
    }
  }

  
  async getOrderPayments(orderId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGOrderFetchPayments(orderId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get payments failed: ${error.response?.data?.message || error.message}`);
    }
  }

  
  async getPayment(orderId: string, cfPaymentId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGOrderFetchPayment(orderId, cfPaymentId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get payment failed: ${error.response?.data?.message || error.message}`);
    }
  }

async createPaymentLink(linkData: {
  link_id: string;
  link_amount: number;
  link_currency: string;
  link_purpose: string;
  customer_details: {
    customer_phone: string;
    customer_name?: string | undefined;
    customer_email?: string | undefined;
  };
  link_meta?: {
    return_url?: string | undefined;
    notify_url?: string | undefined;
  };
  link_notes?: Record<string, any>;
  link_expiry_time?: string | undefined;
}): Promise<any> {
  try {

    const customerDetails: any = {
      customer_phone: linkData.customer_details.customer_phone,
    };
    
    if (linkData.customer_details.customer_name) {
      customerDetails.customer_name = linkData.customer_details.customer_name;
    }
    
    if (linkData.customer_details.customer_email) {
      customerDetails.customer_email = linkData.customer_details.customer_email;
    }

    let linkMeta: any = undefined;
    if (linkData.link_meta) {
      linkMeta = {};
      if (linkData.link_meta.return_url) {
        linkMeta.return_url = linkData.link_meta.return_url;
      }
      if (linkData.link_meta.notify_url) {
        linkMeta.notify_url = linkData.link_meta.notify_url;
      }
      if (Object.keys(linkMeta).length === 0) {
        linkMeta = undefined;
      }
    }

    const payload: any = {
      link_id: linkData.link_id,
      link_amount: linkData.link_amount,
      link_currency: linkData.link_currency,
      link_purpose: linkData.link_purpose,
      customer_details: customerDetails,
    };


    if (linkMeta) {
      payload.link_meta = linkMeta;
    }
    
    if (linkData.link_notes) {
      payload.link_notes = linkData.link_notes;
    }
    
    if (linkData.link_expiry_time) {
      payload.link_expiry_time = linkData.link_expiry_time;
    }

    const response = await this.cashfree.PGCreateLink(payload);
    return response.data;
  } catch (error: any) {
    throw new Error(`Create payment link failed: ${error.response?.data?.message || error.message}`);
  }
}

async getPaymentLink(linkId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGFetchLink(linkId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get payment link failed: ${error.response?.data?.message || error.message}`);
    }
  }

async createRefund(refundData: {
  order_id: string;
  refund_amount: number;
  refund_id: string;
  refund_note?: string;
  refund_speed?: 'INSTANT' | 'STANDARD';
}): Promise<any> {
  try {
    const requestData: any = {
      refund_amount: refundData.refund_amount,
      refund_id: refundData.refund_id,
    };


    if (refundData.refund_note) {
      requestData.refund_note = refundData.refund_note;
    }

    if (refundData.refund_speed) {
      requestData.refund_speed = refundData.refund_speed;
    }


    const response = await this.cashfree.PGOrderCreateRefund(
      refundData.order_id,
      requestData
    );
    return response.data;
  } catch (error: any) {
    throw new Error(`Create refund failed: ${error.response?.data?.message || error.message}`);
  }
}




  async getOrderRefunds(orderId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGOrderFetchRefunds(orderId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get refunds failed: ${error.response?.data?.message || error.message}`);
    }
  }


  async getRefund(orderId: string, refundId: string): Promise<any> {
    try {
      const response = await this.cashfree.PGOrderFetchRefund(orderId, refundId);
      return response.data;
    } catch (error: any) {
      throw new Error(`Get refund failed: ${error.response?.data?.message || error.message}`);
    }
  }

  verifyWebhookSignature(signature: string, rawBody: string, timestamp: string): boolean {
    try {
      this.cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
      return true;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  generateOrderId(prefix = 'METRO'): string {
    return `${prefix}_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;
  }


  generateLinkId(prefix = 'LINK'): string {
    return `${prefix}_${uuidv4().replace(/-/g, '').toUpperCase()}`;
  }

  generateRefundId(prefix = 'REF'): string {
    return `${prefix}_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;
  }
}

const cashfreePaymentService = new CashfreePaymentService({
  clientId: process.env.CASHFREE_CLIENT_ID!,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET!,
  environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
});

export default cashfreePaymentService;
