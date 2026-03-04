import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth-service';
import { authenticate, requireAdmin } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/users
 * Get all users
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const users = AuthService.getAllUsers();
    res.json(users);
  } catch (error) {
    logger.auth.error('Get users error', { error });
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const user = AuthService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password_hash, ...userPublic } = user;
    res.json(userPublic);
  } catch (error) {
    logger.auth.error('Get user error', { userId: req.params.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, status } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'Username, email, password, and role are required' });
    }

    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or viewer' });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    // Check for duplicates
    if (AuthService.usernameExists(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (AuthService.emailExists(email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = await AuthService.createUser({
      username,
      email,
      password,
      role,
      status,
    });

    res.status(201).json(user);
  } catch (error) {
    logger.auth.error('Create user error', { username: req.body.username, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const { username, email, role, status } = req.body;

    // Check if user exists
    const existingUser = AuthService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validation
    if (role && !['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or viewer' });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    // Check for username duplicates
    if (username && username !== existingUser.username && AuthService.usernameExists(username, id)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check for email duplicates
    if (email && AuthService.emailExists(email, id)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Prevent demoting the last admin
    if (role === 'viewer' && existingUser.role === 'admin') {
      const allUsers = AuthService.getAllUsers();
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin user' });
      }
    }

    const user = await AuthService.updateUser(id, { username, email, role, status });
    res.json(user);
  } catch (error) {
    logger.auth.error('Update user error', { userId: parseInt(req.params.id), error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/users/:id/password
 * Reset user password
 */
router.put('/:id/password', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const success = await AuthService.updatePassword(id, password);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.auth.error('Update password error', { userId: parseInt(req.params.id), error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Prevent self-deletion
    if (req.user?.userId === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = AuthService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin
    if (existingUser.role === 'admin') {
      const allUsers = AuthService.getAllUsers();
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    const success = AuthService.deleteUser(id);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.auth.error('Delete user error', { userId: parseInt(req.params.id), error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
