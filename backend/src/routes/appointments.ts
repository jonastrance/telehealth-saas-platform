import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { query } from '../database';
import { UserRole } from '../types';
import { encrypt } from '../utils/encryption';
import { logAuditEvent } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/appointments
 * Get appointments for current user
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.user!;
    const { status, from, to } = req.query;
    
    let queryText = `
      SELECT a.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             pr.first_name as provider_first_name, pr.last_name as provider_last_name
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users pr ON a.provider_id = pr.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Filter by user role
    if (role === UserRole.PATIENT) {
      queryText += ` AND a.patient_id = $${params.length + 1}`;
      params.push(userId);
    } else if (role === UserRole.PROVIDER) {
      queryText += ` AND a.provider_id = $${params.length + 1}`;
      params.push(userId);
    }
    
    // Filter by status
    if (status) {
      queryText += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }
    
    // Filter by date range
    if (from) {
      queryText += ` AND a.scheduled_at >= $${params.length + 1}`;
      params.push(from);
    }
    if (to) {
      queryText += ` AND a.scheduled_at <= $${params.length + 1}`;
      params.push(to);
    }
    
    queryText += ' ORDER BY a.scheduled_at DESC';
    
    const result = await query(queryText, params);
    
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
 * POST /api/v1/appointments
 * Create new appointment
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, providerId, scheduledAt, duration, notes } = req.body;
    const { organizationId } = req.user!;
    
    if (!patientId || !providerId || !scheduledAt) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
        },
      });
      return;
    }
    
    // Generate unique room ID
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const result = await query(
      `INSERT INTO appointments (patient_id, provider_id, organization_id, scheduled_at, duration, video_room_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [patientId, providerId, organizationId, scheduledAt, duration || 30, roomId, notes]
    );
    
    logAuditEvent(
      req.user!.userId,
      'CREATE_APPOINTMENT',
      'appointments',
      result.rows[0].id,
      req.ip || '',
      req.headers['user-agent'] || ''
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
 * GET /api/v1/appointments/:id
 * Get appointment by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;
    
    const result = await query(
      `SELECT a.*, 
              p.first_name as patient_first_name, p.last_name as patient_last_name, p.email as patient_email,
              pr.first_name as provider_first_name, pr.last_name as provider_last_name, pr.email as provider_email
       FROM appointments a
       JOIN users p ON a.patient_id = p.id
       JOIN users pr ON a.provider_id = pr.id
       WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        },
      });
      return;
    }
    
    const appointment = result.rows[0];
    
    // Check authorization
    if (
      role === UserRole.PATIENT && appointment.patient_id !== userId ||
      role === UserRole.PROVIDER && appointment.provider_id !== userId
    ) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
      return;
    }
    
    logAuditEvent(
      userId,
      'VIEW_APPOINTMENT',
      'appointments',
      id,
      req.ip || '',
      req.headers['user-agent'] || ''
    );
    
    res.json({
      success: true,
      data: appointment,
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
 * PATCH /api/v1/appointments/:id
 * Update appointment
 */
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, scheduledAt } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (status) {
      updates.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${params.length + 1}`);
      params.push(notes);
    }
    if (scheduledAt) {
      updates.push(`scheduled_at = $${params.length + 1}`);
      params.push(scheduledAt);
    }
    
    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
      });
      return;
    }
    
    params.push(id);
    const result = await query(
      `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Appointment not found',
        },
      });
      return;
    }
    
    logAuditEvent(
      req.user!.userId,
      'UPDATE_APPOINTMENT',
      'appointments',
      id,
      req.ip || '',
      req.headers['user-agent'] || ''
    );
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
