// src/controllers/paymentController.ts
import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;

  };
}

export const createBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId; 
    const {
      bookingId,
      amount,
      customerDetails,
      returnUrl,
      notifyUrl,
      note
    } = req.body;

    if (!bookingId || !amount || !customerDetails) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, amount, customerDetails',
      });
      return;
    }

    if (!customerDetails.name || !customerDetails.email || !customerDetails.phone) {
      res.status(400).json({
        success: false,
        error: 'customerDetails must include name, email, and phone',
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      });
      return;
    }

    const result = await paymentService.createBookingPayment({
      user_id: userId, 
      booking_id: bookingId, 
      amount: parseFloat(amount),
      customer_details: customerDetails, 
      return_url: returnUrl,
      notify_url: notifyUrl,
      note,
    });

    res.status(201).json({
      success: true,
      message: 'Payment order created successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in createBookingPayment controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment creation failed'
    });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({
        success: false,
        error: 'Order ID is required',
      });
      return;
    }

    const result = await paymentService.getPaymentStatus(orderId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in getPaymentStatus controller:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment not found'
    });
  }
};

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body); // Use raw body middleware

    if (!signature || !timestamp) {
      res.status(400).json({
        success: false,
        error: 'Missing webhook signature or timestamp',
      });
      return;
    }

    await paymentService.processWebhook(webhookData, signature, timestamp, rawBody);

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error: any) {
    console.error('Error in handleWebhook controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    });
  }
};

export const createPaymentLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const {
      amount,
      purpose,
      customerDetails,
      expiryTime,
      returnUrl,
      notifyUrl,
      notes
    } = req.body;

    // Validation
    if (!amount || !purpose || !customerDetails) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, purpose, customerDetails',
      });
      return;
    }

    if (!customerDetails.phone) {
      res.status(400).json({
        success: false,
        error: 'customerDetails must include phone number',
      });
      return;
    }

    const result = await paymentService.createPaymentLink({
      user_id: userId, // Fixed: service expects user_id
      amount: parseFloat(amount),
      purpose,
      customer_details: customerDetails, // Fixed: service expects customer_details
      expiry_time: expiryTime, // Fixed: service expects expiry_time
      return_url: returnUrl,
      notify_url: notifyUrl,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Payment link created successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in createPaymentLink controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment link creation failed'
    });
  }
};

export const createRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      orderId,
      refundAmount,
      refundNote,
      refundReason,
      refundSpeed
    } = req.body;

    if (!orderId || !refundAmount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, refundAmount',
      });
      return;
    }

    if (refundAmount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Refund amount must be greater than 0',
      });
      return;
    }

    const result = await paymentService.createRefund({
      order_id: orderId, // Fixed: service expects order_id
      refund_amount: parseFloat(refundAmount), // Fixed: service expects refund_amount
      refund_note: refundNote, // Fixed: service expects refund_note
      refund_reason: refundReason, // Fixed: service expects refund_reason
      refund_speed: refundSpeed, // Fixed: service expects refund_speed
    });

    res.status(201).json({
      success: true,
      message: 'Refund initiated successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in createRefund controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Refund creation failed'
    });
  }
};

export const getUserPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId; // Get from auth like booking
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (page < 1) {
      res.status(400).json({
        success: false,
        error: 'Page must be greater than 0',
      });
      return;
    }

    const result = await paymentService.getUserPaymentHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in getUserPaymentHistory controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

// Additional useful endpoints
export const getPaymentsByBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
      return;
    }

    // You can add this method to paymentService later
    // const result = await paymentService.getPaymentsByBooking(bookingId, userId);

    res.status(200).json({
      success: true,
      data: [], // placeholder
      message: 'Feature coming soon'
    });
  } catch (error: any) {
    console.error('Error in getPaymentsByBooking controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments for booking'
    });
  }
};
