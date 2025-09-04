import { Request, Response } from 'express';
import { BookingService } from '../services/bookingService';
import { CreateBookingRequest } from '../models/Booking';

const bookingService = new BookingService();

export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId; // From auth middleware
    const bookingData: CreateBookingRequest = req.body;
    const result = await bookingService.createBooking(userId, bookingData);
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in createBooking controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Booking failed'
    });
  }
};

export const getBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
      return;
    }
    const result = await bookingService.getBookingById(bookingId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getBooking controller:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Booking not found'
    });
  }
};

export const getUserBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const result = await bookingService.getUserBookings(userId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getUserBookings controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
};

export const confirmBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
      return;
    }
    await bookingService.confirmBooking(bookingId);
    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully'
    });
  } catch (error) {
    console.error('Error in confirmBooking controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Booking confirmation failed'
    });
  }
};

export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.bookingId;
    const userId = (req as any).user.userId;
    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
      return;
    }
    await bookingService.cancelBooking(bookingId, userId);
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error in cancelBooking controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Booking cancellation failed'
    });
  }
};
