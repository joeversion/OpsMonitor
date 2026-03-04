import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth-service';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const payload = AuthService.verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check if user still exists and is active
  const user = AuthService.getUserById(payload.userId);
  if (!user || user.status === 'inactive') {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = payload;
  next();
}

/**
 * Authorization middleware - requires admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    if (payload) {
      const user = AuthService.getUserById(payload.userId);
      if (user && user.status === 'active') {
        req.user = payload;
      }
    }
  }

  next();
}
