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
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://zelustep.vercel.app'
];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
  : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') && cleanOrigin.includes('zelustep');

    if (isAllowed) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email', 'x-user-role'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/work-logs', workLogRoutes);
app.use('/api/emergency-reminders', emergencyRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// Root Welcome / Status endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Zelustep API Backend',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

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

