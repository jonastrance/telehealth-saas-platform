import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger, logAuditEvent } from '../utils/logger';
import { JWTPayload } from '../types';
import { query } from '../database';

interface VideoClient {
  ws: WebSocket;
  userId: string;
  roomId: string;
  role: string;
}

export class VideoSignalingService {
  private wss: WebSocketServer;
  private clients: Map<string, VideoClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  
  constructor(server: any) {
    this.wss = new WebSocketServer({ server, path: '/video-signal' });
    this.setupWebSocketServer();
  }
  
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = uuidv4();
      
      logger.info('New WebSocket connection', { clientId });
      
      // Authenticate connection
      const token = this.extractToken(req);
      
      if (!token) {
        ws.close(4001, 'Authentication required');
        return;
      }
      
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
        
        ws.on('message', (message: string) => {
          this.handleMessage(clientId, ws, decoded, message);
        });
        
        ws.on('close', () => {
          this.handleDisconnect(clientId);
        });
        
        ws.on('error', (error) => {
          logger.error('WebSocket error', { clientId, error });
        });
        
        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          clientId,
          iceServers: [
            { urls: config.webrtc.stunServerUrl },
            ...(config.webrtc.turnServerUrl ? [{
              urls: config.webrtc.turnServerUrl,
              username: config.webrtc.turnServerUsername,
              credential: config.webrtc.turnServerCredential,
            }] : []),
          ],
        }));
      } catch (error) {
        ws.close(4002, 'Invalid token');
      }
    });
  }
  
  private extractToken(req: any): string | null {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }
  
  private handleMessage(clientId: string, ws: WebSocket, user: JWTPayload, message: string): void {
    try {
      const data = JSON.parse(message);
      
      logger.debug('WebSocket message received', { clientId, type: data.type });
      
      switch (data.type) {
        case 'join-room':
          this.handleJoinRoom(clientId, ws, user, data.roomId);
          break;
        
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          this.handleSignaling(clientId, user, data);
          break;
        
        case 'leave-room':
          this.handleLeaveRoom(clientId, user);
          break;
        
        default:
          logger.warn('Unknown message type', { type: data.type });
      }
    } catch (error) {
      logger.error('Error handling message', { error });
    }
  }
  
  private async handleJoinRoom(clientId: string, ws: WebSocket, user: JWTPayload, roomId: string): Promise<void> {
    // Verify user has access to this room (appointment)
    const appointment = await query(
      `SELECT * FROM appointments 
       WHERE video_room_id = $1 
       AND (patient_id = $2 OR provider_id = $2)
       AND status IN ('scheduled', 'in_progress')`,
      [roomId, user.userId]
    );
    
    if (appointment.rows.length === 0) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Access denied to this room',
      }));
      return;
    }
    
    // Add client to room
    const client: VideoClient = {
      ws,
      userId: user.userId,
      roomId,
      role: user.role,
    };
    
    this.clients.set(clientId, client);
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    const room = this.rooms.get(roomId)!;
    room.add(clientId);
    
    // Update appointment status
    if (appointment.rows[0].status === 'scheduled') {
      await query(
        'UPDATE appointments SET status = $1 WHERE id = $2',
        ['in_progress', appointment.rows[0].id]
      );
    }
    
    // Create or update video session
    await this.upsertVideoSession(roomId, appointment.rows[0].id, user.userId);
    
    // Notify other participants
    this.broadcastToRoom(roomId, {
      type: 'user-joined',
      userId: user.userId,
      role: user.role,
    }, clientId);
    
    // Send current participants to new user
    const participants = Array.from(room)
      .filter(id => id !== clientId)
      .map(id => {
        const client = this.clients.get(id);
        return {
          userId: client?.userId,
          role: client?.role,
        };
      });
    
    ws.send(JSON.stringify({
      type: 'room-joined',
      roomId,
      participants,
    }));
    
    // Log audit event
    logAuditEvent(
      user.userId,
      'JOIN_VIDEO_CALL',
      'video_session',
      roomId,
      '',
      ''
    );
  }
  
  private handleSignaling(clientId: string, user: JWTPayload, data: any): void {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }
    
    // Forward signaling message to target user
    if (data.targetUserId) {
      this.sendToUser(client.roomId, data.targetUserId, {
        ...data,
        fromUserId: user.userId,
      });
    } else {
      // Broadcast to all users in room except sender
      this.broadcastToRoom(client.roomId, {
        ...data,
        fromUserId: user.userId,
      }, clientId);
    }
  }
  
  private async handleLeaveRoom(clientId: string, user: JWTPayload): Promise<void> {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }
    
    const { roomId } = client;
    
    // Remove from room
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(clientId);
      
      // Notify other participants
      this.broadcastToRoom(roomId, {
        type: 'user-left',
        userId: user.userId,
      }, clientId);
      
      // If room is empty, clean up
      if (room.size === 0) {
        this.rooms.delete(roomId);
        await this.endVideoSession(roomId);
      }
    }
    
    this.clients.delete(clientId);
    
    // Log audit event
    logAuditEvent(
      user.userId,
      'LEAVE_VIDEO_CALL',
      'video_session',
      roomId,
      '',
      ''
    );
  }
  
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    
    if (client) {
      const room = this.rooms.get(client.roomId);
      if (room) {
        room.delete(clientId);
        
        this.broadcastToRoom(client.roomId, {
          type: 'user-left',
          userId: client.userId,
        }, clientId);
      }
      
      this.clients.delete(clientId);
    }
    
    logger.info('Client disconnected', { clientId });
  }
  
  private broadcastToRoom(roomId: string, message: any, excludeClientId?: string): void {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    const messageStr = JSON.stringify(message);
    
    room.forEach(clientId => {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      }
    });
  }
  
  private sendToUser(roomId: string, userId: string, message: any): void {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return;
    }
    
    const messageStr = JSON.stringify(message);
    
    room.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }
  
  private async upsertVideoSession(roomId: string, appointmentId: string, userId: string): Promise<void> {
    // Check if session exists
    const existing = await query(
      'SELECT * FROM video_sessions WHERE room_id = $1',
      [roomId]
    );
    
    if (existing.rows.length === 0) {
      // Create new session
      await query(
        `INSERT INTO video_sessions (appointment_id, room_id, participants, started_at)
         VALUES ($1, $2, $3, NOW())`,
        [appointmentId, roomId, [userId]]
      );
    } else {
      // Update participants
      await query(
        `UPDATE video_sessions 
         SET participants = array_append(participants, $1)
         WHERE room_id = $2 AND NOT ($1 = ANY(participants))`,
        [userId, roomId]
      );
    }
  }
  
  private async endVideoSession(roomId: string): Promise<void> {
    const result = await query(
      'SELECT * FROM video_sessions WHERE room_id = $1 AND ended_at IS NULL',
      [roomId]
    );
    
    if (result.rows.length > 0) {
      const session = result.rows[0];
      const duration = Math.floor(
        (new Date().getTime() - new Date(session.started_at).getTime()) / 1000
      );
      
      await query(
        'UPDATE video_sessions SET ended_at = NOW(), duration = $1 WHERE id = $2',
        [duration, session.id]
      );
      
      // Update appointment status
      await query(
        'UPDATE appointments SET status = $1 WHERE id = $2',
        ['completed', session.appointment_id]
      );
    }
  }
}
