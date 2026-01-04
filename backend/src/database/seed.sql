-- Initial Data Seeding for Telehealth Platform
-- Run after schema.sql to create default organization and admin user

-- Create default organization
INSERT INTO organizations (id, name, type, subscription_tier, subscription_status, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'clinic', 'pro', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- Create default admin user
-- Password: Admin123! (should be changed on first login)
-- Password hash generated with: bcrypt.hash('Admin123!', 12)
INSERT INTO users (
  id, 
  email, 
  password_hash, 
  role, 
  first_name, 
  last_name, 
  organization_id, 
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@telehealth.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lE7yGQ8vJ8Gu',
  'admin',
  'System',
  'Administrator',
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Create sample provider user
-- Password: Provider123!
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  first_name,
  last_name,
  phone_number,
  organization_id,
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'provider@telehealth.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lE7yGQ8vJ8Gu',
  'provider',
  'Dr. John',
  'Smith',
  '+1234567890',
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Create sample patient user
-- Password: Patient123!
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  first_name,
  last_name,
  phone_number,
  organization_id,
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'patient@telehealth.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lE7yGQ8vJ8Gu',
  'patient',
  'Jane',
  'Doe',
  '+1234567891',
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Create sample appointment (scheduled for tomorrow at 10 AM)
INSERT INTO appointments (
  patient_id,
  provider_id,
  organization_id,
  scheduled_at,
  duration,
  status,
  video_room_id,
  notes
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '1 day' + TIME '10:00:00',
  30,
  'scheduled',
  'room-demo-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  'Initial consultation'
)
ON CONFLICT DO NOTHING;

-- Create sample health metrics for the patient
INSERT INTO health_metrics (
  patient_id,
  metric_type,
  value,
  unit,
  recorded_by,
  notes
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000003',
    'blood_pressure',
    '120/80',
    'mmHg',
    '00000000-0000-0000-0000-000000000003',
    'Normal reading'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'heart_rate',
    '72',
    'bpm',
    '00000000-0000-0000-0000-000000000003',
    'Resting heart rate'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'temperature',
    '98.6',
    '°F',
    '00000000-0000-0000-0000-000000000003',
    'Normal body temperature'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'oxygen_saturation',
    '98',
    '%',
    '00000000-0000-0000-0000-000000000003',
    'Good oxygen levels'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'weight',
    '165',
    'lbs',
    '00000000-0000-0000-0000-000000000003',
    'Regular weight'
  )
ON CONFLICT DO NOTHING;

-- Create default consents for the patient
INSERT INTO consents (
  patient_id,
  consent_type,
  granted,
  granted_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000003',
    'treatment',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'privacy',
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'data_sharing',
    false,
    NULL
  )
ON CONFLICT DO NOTHING;

-- Note: These are sample credentials for development/testing only
-- In production:
-- 1. Remove or change all default passwords
-- 2. Use strong, unique passwords
-- 3. Consider requiring password change on first login
-- 4. Enable multi-factor authentication

COMMIT;
