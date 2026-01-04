import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { testConnection } from './database';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { VideoSignalingService } from './services/videoSignalingService';

// Import routes
import authRoutes from './routes/auth';
import appointmentsRoutes from './routes/appointments';
import healthMetricsRoutes from './routes/healthMetrics';

const app: Application = express();
const server = http.createServer(app);

// Initialize video signaling service
const videoSignaling = new VideoSignalingService(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(`/api/${config.server.apiVersion}`, apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.server.apiVersion,
  });
});

// API routes
app.use(`/api/${config.server.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.server.apiVersion}/appointments`, appointmentsRoutes);
app.use(`/api/${config.server.apiVersion}/health-metrics`, healthMetricsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    // Start listening
    server.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
      logger.info(`API version: ${config.server.apiVersion}`);
      logger.info(`CORS origin: ${config.cors.origin}`);
      logger.info('Video signaling service initialized');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  shutdown();
});

// Start the server
startServer();

export { app, server };
