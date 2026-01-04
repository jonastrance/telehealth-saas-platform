import express, { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, role, firstName, lastName, organizationId, phoneNumber } = req.body;
    
    // Validate required fields
    if (!email || !password || !role || !firstName || !lastName || !organizationId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
        },
      });
      return;
    }
    
    const user = await AuthService.register(
      email,
      password,
      role,
      firstName,
      lastName,
      organizationId,
      phoneNumber
    );
    
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Login user
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required',
        },
      });
      return;
    }
    
    const tokens = await AuthService.login(
      email,
      password,
      req.ip || '',
      req.headers['user-agent'] || ''
    );
    
    res.json({
      success: true,
      data: tokens,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Refresh token is required',
        },
      });
      return;
    }
    
    const tokens = await AuthService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: tokens,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/v1/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PASSWORDS',
          message: 'Old and new passwords are required',
        },
      });
      return;
    }
    
    await AuthService.changePassword(req.user!.userId, oldPassword, newPassword);
    
    res.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: req.user,
  });
});

export default router;
