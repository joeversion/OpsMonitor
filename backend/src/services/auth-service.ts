import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'opsmonitor-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'viewer';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'viewer';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenPayload {
  userId: number;
  username: string;
  role: 'admin' | 'viewer';
}

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Verify password (alias for comparePassword)
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.comparePassword(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Login user
   */
  static async login(username: string, password: string): Promise<{ user: UserPublic; token: string } | null> {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username) as User | undefined;

    if (!user) {
      return null;
    }

    if (user.status === 'inactive') {
      return null;
    }

    const isValid = await this.comparePassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login time
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const token = this.generateToken(user);
    const userPublic = this.toPublic(user);

    return { user: userPublic, token };
  }

  /**
   * Get user by ID
   */
  static getUserById(id: number): User | null {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return user || null;
  }

  /**
   * Get user by username
   */
  static getUserByUsername(username: string): User | null {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    return user || null;
  }

  /**
   * Get all users
   */
  static getAllUsers(): UserPublic[] {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
    return users.map(user => this.toPublic(user));
  }

  /**
   * Create a new user
   */
  static async createUser(data: {
    username: string;
    email?: string;
    password: string;
    role: 'admin' | 'viewer';
    status?: 'active' | 'inactive';
  }): Promise<UserPublic> {
    const password_hash = await this.hashPassword(data.password);
    const status = data.status || 'active';
    const email = data.email || null;

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.username, email, password_hash, data.role, status);

    const user = this.getUserById(result.lastInsertRowid as number)!;
    return this.toPublic(user);
  }

  /**
   * Update user
   */
  static async updateUser(id: number, data: {
    username?: string;
    email?: string;
    role?: 'admin' | 'viewer';
    status?: 'active' | 'inactive';
  }): Promise<UserPublic | null> {
    const user = this.getUserById(id);
    if (!user) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.toPublic(this.getUserById(id)!);
  }

  /**
   * Update user password
   */
  static async updatePassword(id: number, newPassword: string): Promise<boolean> {
    const user = this.getUserById(id);
    if (!user) return false;

    const password_hash = await this.hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(password_hash, id);
    return true;
  }

  /**
   * Delete user
   */
  static deleteUser(id: number): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check if username exists
   */
  static usernameExists(username: string, excludeId?: number): boolean {
    if (excludeId) {
      const user = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, excludeId);
      return !!user;
    }
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    return !!user;
  }

  /**
   * Check if email exists
   */
  static emailExists(email: string, excludeId?: number): boolean {
    if (excludeId) {
      const user = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, excludeId);
      return !!user;
    }
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    return !!user;
  }

  /**
   * Initialize default admin user if no users exist
   */
  static async initDefaultAdmin(): Promise<void> {
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (count.count === 0) {
      logger.auth.info('Creating default admin user');
      await this.createUser({
        username: 'admin',
        email: 'admin@localhost',
        password: 'admin123',
        role: 'admin',
        status: 'active',
      });
      logger.auth.info('Default admin user created', { username: 'admin' });
    }
  }

  /**
   * Convert User to UserPublic (remove password_hash)
   */
  private static toPublic(user: User): UserPublic {
    const { password_hash, ...publicUser } = user;
    // Convert last_login_at to local time if it exists
    if (publicUser.last_login_at) {
      publicUser.last_login_at = this.toLocalTime(publicUser.last_login_at);
    }
    return publicUser;
  }

  /**
   * Convert UTC time to local display time (Asia/Shanghai timezone)
   * @param dateStr - UTC datetime string from SQLite (format: YYYY-MM-DD HH:MM:SS)
   * @returns Formatted local time string
   */
  private static toLocalTime(dateStr: string): string {
    try {
      // SQLite CURRENT_TIMESTAMP returns UTC without 'Z' suffix, add it for proper parsing
      // Check if it already has time zone info to avoid double Z
      const timeString = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
      
      const d = new Date(timeString);
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        return dateStr; // Return original string if parsing fails
      }

      return d.toLocaleString('en-US', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      logger.auth.warn('Failed to format date', { dateStr, error: e });
      return dateStr;
    }
  }
}
