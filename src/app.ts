import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import podRoutes from './routes/podRoutes';
import bookingRoutes from './routes/bookingRoutes';
import paymentRoutes from './routes/paymentRoutes';
import verificationRoutes from "./routes/verificationRoutes";
import morgon from 'morgan';
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgon('tiny'));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pods', podRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments',paymentRoutes);
app.use("/api/v1/verification",verificationRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MetropodZ Booking Engine running on port ${PORT}`);
});

export default app;
