export interface User {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'admin';
  firstName: string;
  lastName: string;
  organizationId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Appointment {
  id: string;
  patient_id: string;
  provider_id: string;
  scheduled_at: string;
  duration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'no_show';
  video_room_id: string;
  notes?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  provider_first_name?: string;
  provider_last_name?: string;
}

export interface HealthMetric {
  id: string;
  patient_id: string;
  metric_type: 'blood_pressure' | 'heart_rate' | 'temperature' | 'oxygen_saturation' | 'weight' | 'glucose';
  value: string;
  unit: string;
  recorded_at: string;
  notes?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
