// User Types
export enum UserRole {
  PATIENT = 'patient',
  PROVIDER = 'provider',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  organizationId: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Organization/Clinic Types
export interface Organization {
  id: string;
  name: string;
  type: 'clinic' | 'hospital' | 'private_practice';
  stripeCustomerId?: string;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Appointment Types
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  NO_SHOW = 'no_show',
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  organizationId: string;
  scheduledAt: Date;
  duration: number; // minutes
  status: AppointmentStatus;
  videoRoomId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Patient Health Metrics Types
export interface HealthMetric {
  id: string;
  patientId: string;
  metricType: 'blood_pressure' | 'heart_rate' | 'temperature' | 'oxygen_saturation' | 'weight' | 'glucose';
  value: string;
  unit: string;
  recordedAt: Date;
  recordedBy: string; // userId
  notes?: string;
  createdAt: Date;
}

// Medical Record Types
export interface MedicalRecord {
  id: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  recordType: 'diagnosis' | 'prescription' | 'lab_result' | 'imaging' | 'note';
  title: string;
  content: string;
  encryptedContent: string; // HIPAA encrypted
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Video Call Types
export interface VideoSession {
  id: string;
  appointmentId: string;
  roomId: string;
  participants: string[]; // userIds
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
  recordingUrl?: string; // if consent given
  createdAt: Date;
}

// Audit Log Types (HIPAA requirement)
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Consent Types (HIPAA requirement)
export interface Consent {
  id: string;
  patientId: string;
  consentType: 'treatment' | 'privacy' | 'recording' | 'data_sharing';
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  documentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription/Billing Types
export interface Subscription {
  id: string;
  organizationId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  userCount: number;
  pricePerUser: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  iat?: number;
  exp?: number;
}
