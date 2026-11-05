 import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
 import { resolve } from 'node:path';
 import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { clearLegacyPasswordResetTokens } from './services/passwordResetService.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import conflictRoutes from './routes/conflictRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userPortalRoutes from './routes/userPortalRoutes.js';

dotenv.config();
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the API');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
  const app = express();

  const allowedOrigins = [
  'http://localhost:5173',
  'https://ai-based-event-scheduling-conflict-trbe.onrender.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true }));

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'festival-scheduler-api' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/conflicts', conflictRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/user-portal', userPortalRoutes);

  app.use((err, req, res, next) => {
    const status = err.status ||
      (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 0) ||
      (err.code === 11000 ? 409 : 500);
    console.error(`[API ${status}] ${req.method} ${req.path}: ${err.message || 'Unknown error'}`);
    if (process.env.NODE_ENV === 'development' && err.stack) {
      console.error(err.stack);
    }
    res.status(status).json({
      message: status >= 500 ? 'Internal server error' : err.message || 'Server error',
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
};

export const startServer = async () => {
  await connectDB();
  await clearLegacyPasswordResetTokens();
  const app = createApp();
  const PORT = process.env.PORT || 5000;
  return app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(`API startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
