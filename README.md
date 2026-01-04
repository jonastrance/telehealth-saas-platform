# Telehealth SaaS Platform

A comprehensive, HIPAA-compliant telehealth SaaS platform with video calls, patient monitoring, and secure data management.

## 🏥 Overview

This platform provides a complete telehealth solution for healthcare providers and patients, featuring:

- **🎥 HD Video Calls**: Real-time, secure video consultations using WebRTC
- **📊 Patient Monitoring**: Track vital signs and health metrics
- **🔒 HIPAA Compliance**: End-to-end encryption, audit logging, and secure data storage
- **👥 Multi-tenant SaaS**: Support for multiple clinics and organizations
- **💳 Subscription Management**: Stripe integration for $15-30/user/month billing
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 Market Opportunity

- **Market Size**: $46 billion global telehealth market
- **Growth Rate**: 30% CAGR (Compound Annual Growth Rate)
- **Pricing**: $15-30 per user per month
- **Target Users**: Clinics, hospitals, private practices, and healthcare providers

## 🏗️ Architecture

### Backend (Node.js + TypeScript)
- **Express.js** REST API
- **PostgreSQL** database with encryption
- **WebSocket** signaling server for video calls
- **JWT** authentication with refresh tokens
- **HIPAA-compliant** audit logging

### Frontend (React + TypeScript)
- **React** with hooks and modern patterns
- **WebRTC** for peer-to-peer video
- **Zustand** for state management
- **Vite** for fast development and builds

## 📋 Features

### Security & Compliance
- ✅ End-to-end encryption for all data
- ✅ AES-256-GCM encryption for medical records
- ✅ Audit logging for all data access (HIPAA requirement)
- ✅ Session timeout (15 minutes default)
- ✅ Rate limiting to prevent abuse
- ✅ Secure password hashing with bcrypt
- ✅ JWT token-based authentication
- ✅ Data retention policies (7 years for HIPAA)

### Video Calls
- ✅ HD video (up to 1280x720)
- ✅ Audio with echo cancellation and noise suppression
- ✅ Mute/unmute audio
- ✅ Turn video on/off
- ✅ Multiple participants support
- ✅ Waiting room functionality
- ✅ Session recording (with consent)

### Patient Monitoring
- ✅ Blood pressure tracking
- ✅ Heart rate monitoring
- ✅ Temperature recording
- ✅ Oxygen saturation
- ✅ Weight tracking
- ✅ Glucose levels
- ✅ Historical data and trends

### Appointment Management
- ✅ Schedule appointments
- ✅ View upcoming appointments
- ✅ Cancel/reschedule
- ✅ Automatic video room creation
- ✅ Email/SMS notifications (configurable)

### User Management
- ✅ Patient accounts
- ✅ Provider accounts
- ✅ Admin accounts
- ✅ Role-based access control (RBAC)
- ✅ Organization/clinic management

## 🛠️ Installation

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 13+
- Git

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jonastrance/telehealth-saas-platform.git
   cd telehealth-saas-platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   npm install --workspace=backend
   npm install --workspace=frontend
   ```

3. **Configure environment variables**:
   
   Backend:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Key environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection
   - `JWT_SECRET`: Secret key for JWT tokens (use strong random string)
   - `DB_ENCRYPTION_KEY`: 32-character key for data encryption
   - `STRIPE_SECRET_KEY`: Stripe API key for billing
   - `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, `TURN_SERVER_CREDENTIAL`: For video calls

4. **Set up the database**:
   ```bash
   # Create PostgreSQL database
   createdb telehealth_db
   
   # Run schema
   psql telehealth_db < backend/src/database/schema.sql
   ```

5. **Start the development servers**:
   
   Terminal 1 (Backend):
   ```bash
   npm run dev:backend
   ```
   
   Terminal 2 (Frontend):
   ```bash
   npm run dev:frontend
   ```

6. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health check: http://localhost:5000/health

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user.

**Request**:
```json
{
  "email": "doctor@example.com",
  "password": "SecurePassword123!",
  "role": "provider",
  "firstName": "John",
  "lastName": "Doe",
  "organizationId": "uuid",
  "phoneNumber": "+1234567890"
}
```

#### POST /api/v1/auth/login
Login user.

**Request**:
```json
{
  "email": "doctor@example.com",
  "password": "SecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 86400
  }
}
```

### Appointment Endpoints

#### GET /api/v1/appointments
Get appointments for current user.

**Query Parameters**:
- `status`: Filter by status (scheduled, in_progress, completed, canceled)
- `from`: Start date (ISO 8601)
- `to`: End date (ISO 8601)

#### POST /api/v1/appointments
Create new appointment.

**Request**:
```json
{
  "patientId": "uuid",
  "providerId": "uuid",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "duration": 30,
  "notes": "Follow-up appointment"
}
```

### Health Metrics Endpoints

#### GET /api/v1/health-metrics
Get health metrics for a patient.

**Query Parameters**:
- `patientId`: Patient UUID (required for providers)
- `metricType`: Type of metric (blood_pressure, heart_rate, etc.)
- `from`: Start date
- `to`: End date

#### POST /api/v1/health-metrics
Record new health metric.

**Request**:
```json
{
  "patientId": "uuid",
  "metricType": "blood_pressure",
  "value": "120/80",
  "unit": "mmHg",
  "notes": "Measured at home"
}
```

## 🔐 HIPAA Compliance

### Data Encryption
- **At Rest**: AES-256-GCM encryption for sensitive data
- **In Transit**: TLS 1.3 for all network communication
- **Keys**: Secure key management with environment variables

### Audit Logging
All access to protected health information (PHI) is logged:
- User ID and role
- Action performed (VIEW, CREATE, UPDATE, DELETE)
- Resource accessed
- Timestamp
- IP address and user agent

Audit logs are:
- Immutable (insert-only table)
- Retained for 7 years (HIPAA requirement)
- Regularly reviewed for suspicious activity

### Access Control
- Role-based access control (RBAC)
- Patients can only access their own data
- Providers can only access data for their patients
- Admins have organization-level access
- Session timeout after 15 minutes of inactivity

### Data Retention
- Medical records: 7 years (configurable)
- Audit logs: 7 years minimum
- Video recordings: Only with patient consent
- Automatic data purging after retention period

### Security Best Practices
- Strong password requirements
- Account lockout after 5 failed attempts
- Rate limiting on all endpoints
- Security headers (Helmet.js)
- CORS configuration
- Input validation and sanitization

## 💳 Subscription & Billing

The platform integrates with Stripe for subscription management:

### Pricing Tiers
- **Basic**: $15/user/month
  - Video calls
  - Basic patient monitoring
  - Up to 50 appointments/month

- **Pro**: $30/user/month
  - Everything in Basic
  - Unlimited appointments
  - Advanced analytics
  - Priority support
  - Custom branding

## 🎥 Video Call Architecture

### WebRTC Implementation
- **Signaling Server**: WebSocket-based on backend
- **STUN Server**: Google's public STUN server (configurable)
- **TURN Server**: Optional for NAT traversal
- **Peer-to-peer**: Direct connection between clients when possible

### Video Quality
- Default resolution: 1280x720 (HD)
- Adaptive bitrate based on connection
- Echo cancellation and noise suppression
- Automatic gain control

### Security
- Encrypted video streams (DTLS-SRTP)
- Room access verified against appointments
- Audit logging for all video sessions
- Optional recording with consent

## 📄 License

MIT License

## 🔄 Changelog

### Version 1.0.0 (Initial Release)
- ✅ Complete authentication system
- ✅ Video calling with WebRTC
- ✅ Patient health monitoring
- ✅ Appointment scheduling
- ✅ HIPAA-compliant audit logging
- ✅ Multi-tenant organization support
- ✅ Stripe subscription integration
- ✅ Responsive web interface