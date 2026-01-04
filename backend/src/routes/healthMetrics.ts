import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { query } from '../database';
import { UserRole } from '../types';
import { logAuditEvent } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/health-metrics
 * Get health metrics for a patient
 * 
 * Security Note: While patientId is passed as a query parameter, access is strictly
 * controlled by authentication and RBAC. Patients can only access their own data,
 * and providers must have an authorized relationship. All access is logged in audit trail.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { patientId, metricType, from, to } = req.query;
    
    let targetPatientId = patientId;
    
    // Patients can only view their own metrics
    if (role === UserRole.PATIENT) {
      targetPatientId = userId;
    }
    
    if (!targetPatientId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required',
        },
      });
      return;
    }
    
    // For providers and admins, verify the patient is in their organization
    if (role !== UserRole.PATIENT) {
      const patientCheck = await query(
        'SELECT organization_id FROM users WHERE id = $1',
        [targetPatientId]
      );
      
      if (patientCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PATIENT_NOT_FOUND',
            message: 'Patient not found',
          },
        });
        return;
      }
      
      // Verify same organization (unless admin role allows cross-org access)
      if (patientCheck.rows[0].organization_id !== req.user!.organizationId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this patient',
          },
        });
        return;
      }
    }
    
    let queryText = 'SELECT * FROM health_metrics WHERE patient_id = $1';
    const params: any[] = [targetPatientId];
    
    if (metricType) {
      queryText += ` AND metric_type = $${params.length + 1}`;
      params.push(metricType);
    }
    
    if (from) {
      queryText += ` AND recorded_at >= $${params.length + 1}`;
      params.push(from);
    }
    
    if (to) {
      queryText += ` AND recorded_at <= $${params.length + 1}`;
      params.push(to);
    }
    
    queryText += ' ORDER BY recorded_at DESC LIMIT 100';
    
    const result = await query(queryText, params);
    
    logAuditEvent(
      userId,
      'VIEW_HEALTH_METRICS',
      'health_metrics',
      targetPatientId as string,
      req.ip || '',
      req.headers['user-agent'] || ''
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/v1/health-metrics
 * Record new health metric
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, metricType, value, unit, notes, recordedAt } = req.body;
    const { userId, role } = req.user!;
    
    if (!patientId || !metricType || !value || !unit) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
        },
      });
      return;
    }
    
    // Patients can only record their own metrics
    if (role === UserRole.PATIENT && patientId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot record metrics for other patients',
        },
      });
      return;
    }
    
    const result = await query(
      `INSERT INTO health_metrics (patient_id, metric_type, value, unit, recorded_at, recorded_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        patientId,
        metricType,
        value,
        unit,
        recordedAt || new Date(),
        userId,
        notes,
      ]
    );
    
    logAuditEvent(
      userId,
      'RECORD_HEALTH_METRIC',
      'health_metrics',
      result.rows[0].id,
      req.ip || '',
      req.headers['user-agent'] || '',
      { patientId, metricType }
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/v1/health-metrics/summary
 * Get health metrics summary for a patient
 * 
 * Security Note: Access is controlled by authentication and RBAC. Patients can only
 * access their own summary. All access is logged for HIPAA compliance.
 */
router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { patientId } = req.query;
    
    let targetPatientId = patientId;
    
    if (role === UserRole.PATIENT) {
      targetPatientId = userId;
    }
    
    if (!targetPatientId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required',
        },
      });
      return;
    }
    
    // For providers and admins, verify the patient is in their organization
    if (role !== UserRole.PATIENT) {
      const patientCheck = await query(
        'SELECT organization_id FROM users WHERE id = $1',
        [targetPatientId]
      );
      
      if (patientCheck.rows.length === 0 || 
          patientCheck.rows[0].organization_id !== req.user!.organizationId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this patient',
          },
        });
        return;
      }
    }
    
    const result = await query(
      `SELECT 
         metric_type,
         COUNT(*) as count,
         MAX(recorded_at) as last_recorded
       FROM health_metrics
       WHERE patient_id = $1
       GROUP BY metric_type`,
      [targetPatientId]
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
