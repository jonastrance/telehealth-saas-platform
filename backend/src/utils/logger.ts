import winston from 'winston';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telehealth-api' },
  transports: [
    new winston.transports.File({ filename: config.logging.file }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Audit logger for HIPAA compliance
const auditLogsDir = config.audit.enabled ? path.dirname(config.audit.file) : logsDir;
if (!fs.existsSync(auditLogsDir)) {
  fs.mkdirSync(auditLogsDir, { recursive: true });
}

export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'telehealth-audit' },
  transports: [
    new winston.transports.File({ 
      filename: config.audit.file,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

export const logAuditEvent = (
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  ipAddress: string,
  userAgent: string,
  details?: Record<string, any>
) => {
  if (config.audit.enabled) {
    auditLogger.info({
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date().toISOString(),
    });
  }
};
