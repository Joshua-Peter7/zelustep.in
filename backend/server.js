import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';
import workLogRoutes from './routes/workLogs.js';
import emergencyRoutes from './routes/emergencyReminders.js';
import financeRoutes from './routes/finance.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import { initScheduler } from './cron/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5200;

// Security Headers (Helmet)
// Disables default CSP on API layer to prevent blocking Vite client or Google Fonts
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Locked Down CORS Allowlist
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server) or matched origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email', 'x-user-role']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/work-logs', workLogRoutes);
app.use('/api/emergency-reminders', emergencyRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Zelustep API',
    timestamp: new Date().toISOString()
  });
});

// Start scheduler
initScheduler();

// Start Express Server with EADDRINUSE resilience and graceful shutdown
const startServer = (port, retries = 5) => {
  const server = app.listen(port, () => {
    console.log(`====================================================`);
    console.log(`🚀 Zelustep API Server running on port ${port}`);
    console.log(`🔗 Local URL: http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retries > 0) {
      console.warn(`⚠️ Port ${port} is currently in use. Retrying in 1s... (${retries} retries remaining)`);
      setTimeout(() => {
        try { server.close(); } catch (_) {}
        startServer(port, retries - 1);
      }, 1000);
    } else {
      console.error('Fatal server startup error:', err);
      process.exit(1);
    }
  });

  const handleShutdown = () => {
    try {
      server.close(() => {
        process.exit(0);
      });
    } catch (_) {
      process.exit(0);
    }
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
};

startServer(PORT);

