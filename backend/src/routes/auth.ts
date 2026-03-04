import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth-service';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username/email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await AuthService.login(username, password);

    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(result);
  } catch (error) {
    logger.auth.error('Login error', { username: req.body.username, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, server-side just acknowledges)
 */
router.post('/logout', authenticate, (req: Request, res: Response) => {
  // JWT tokens are stateless, so logout is handled client-side
  // This endpoint can be used for logging, token blacklisting, etc.
  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/register
 * Self-register a new user (assigned viewer role by default)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Validate username format (alphanumeric, dots, underscores, 3-50 chars)
    if (!/^[a-zA-Z0-9._]{3,50}$/.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be 3-50 characters and contain only letters, numbers, dots, and underscores' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    if (AuthService.usernameExists(username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    if (AuthService.emailExists(email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Create user with viewer role (self-registered users are viewers by default)
    const user = await AuthService.createUser({
      username,
      email,
      password,
      role: 'viewer',
      status: 'active',
    });

    // Generate token for immediate login
    const fullUser = AuthService.getUserById(user.id);
    if (!fullUser) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const token = AuthService.generateToken(fullUser);

    res.status(201).json({
      message: 'Registration successful',
      user,
      token,
    });
  } catch (error) {
    logger.auth.error('Registration error', { username: req.body.username, email: req.body.email, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = AuthService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user without password_hash
    const { password_hash, ...userPublic } = user;
    res.json(userPublic);
  } catch (error) {
    logger.auth.error('Get user error', { userId: req.user?.userId, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user's profile (username, email)
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { username, email } = req.body;
    const userId = req.user.userId;

    const existingUser = AuthService.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate username if provided
    if (username) {
      if (!/^[a-zA-Z0-9._]{3,50}$/.test(username)) {
        return res.status(400).json({ 
          error: 'Username must be 3-50 characters and contain only letters, numbers, dots, and underscores' 
        });
      }
      if (username !== existingUser.username && AuthService.usernameExists(username, userId)) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    }

    // Validate email if provided
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (email !== existingUser.email && AuthService.emailExists(email, userId)) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    // Update user profile (only username and email, not role/status)
    const updatedUser = await AuthService.updateUser(userId, { 
      username: username || existingUser.username, 
      email: email || existingUser.email 
    });

    res.json(updatedUser);
  } catch (error) {
    logger.auth.error('Update profile error', { userId: req.user?.userId, username: req.body.username, email: req.body.email, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/password
 * Update current user's password
 */
router.put('/password', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const user = AuthService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await AuthService.verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const success = await AuthService.updatePassword(userId, newPassword);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update password' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.auth.error('Update password error', { userId: req.user?.userId, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
