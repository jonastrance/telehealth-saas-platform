import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'telehealth_db',
    user: process.env.DB_USER || 'telehealth_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    encryptionKey: process.env.DB_ENCRYPTION_KEY || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  
  session: {
    timeout: process.env.SESSION_TIMEOUT || '15m',
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: process.env.LOCKOUT_DURATION || '30m',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  webrtc: {
    turnServerUrl: process.env.TURN_SERVER_URL || '',
    turnServerUsername: process.env.TURN_SERVER_USERNAME || '',
    turnServerCredential: process.env.TURN_SERVER_CREDENTIAL || '',
    stunServerUrl: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceIds: {
      basic: process.env.STRIPE_PRICE_ID_BASIC || '',
      pro: process.env.STRIPE_PRICE_ID_PRO || '',
    },
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/telehealth.log',
  },
  
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED === 'true',
    file: process.env.AUDIT_LOG_FILE || 'logs/audit.log',
  },
  
  dataRetention: {
    days: parseInt(process.env.DATA_RETENTION_DAYS || '2555', 10), // 7 years for HIPAA
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '2555', 10),
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png,doc,docx').split(','),
  },
  
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'noreply@telehealth.com',
  },
};
