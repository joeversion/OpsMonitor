/**
 * System Settings API routes
 * GET /api/system-settings - Get all settings
 * GET /api/system-settings/:key - Get specific setting
 * PUT /api/system-settings/:key - Update specific setting (admin only)
 */

import express, { Request, Response } from 'express';
import db from '../db/database';
import logger from '../utils/logger';
import { authenticate, requireAdmin } from '../middleware/auth';
import { SSHService } from '../services/ssh-service';

const router = express.Router();

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

/**
 * GET /api/system-settings
 * Get all system settings
 */
router.get('/', authenticate, (req: Request, res: Response) => {
  try {
    const settings = db.prepare(`
      SELECT key, value, description, updated_at
      FROM system_settings
      ORDER BY key
    `).all() as SystemSetting[];

    logger.api.debug('Get all system settings', { count: settings.length });
    res.json(settings);
  } catch (error: any) {
    logger.api.error('Failed to get system settings', error);
    res.status(500).json({ error: 'Failed to get system settings' });
  }
});

/**
 * GET /api/system-settings/:key
 * Get specific system setting by key
 */
router.get('/:key', authenticate, (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const setting = db.prepare(`
      SELECT key, value, description, updated_at
      FROM system_settings
      WHERE key = ?
    `).get(key) as SystemSetting | undefined;

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    logger.api.debug('Get system setting', { key });
    res.json(setting);
  } catch (error: any) {
    logger.api.error('Failed to get system setting', error);
    res.status(500).json({ error: 'Failed to get system setting' });
  }
});

/**
 * PUT /api/system-settings/:key
 * Update specific system setting (admin only)
 */
router.put('/:key', authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    // Check if setting exists
    const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
    if (!existing) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Validate timezone if updating timezone setting
    if (key === 'timezone') {
      // Simple validation - just check it's not empty
      // Intl.supportedValuesOf is not available in older Node versions
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid timezone',
          hint: 'Examples: Asia/Shanghai, UTC, America/New_York, Europe/London'
        });
      }
    }

    // Update setting
    db.prepare(`
      UPDATE system_settings
      SET value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `).run(value, key);

    // If timezone was updated, clear logger cache BEFORE any log output
    if (key === 'timezone') {
      logger.clearTimezoneCache();
    }
    
    // If SSH settings were updated, clear SSH config cache
    if (key.startsWith('ssh_')) {
      SSHService.clearConfigCache();
    }

    const updated = db.prepare('SELECT * FROM system_settings WHERE key = ?').get(key) as SystemSetting;

    logger.api.info('System setting updated', { key, value, user: (req as any).user?.username });
    
    // Log timezone change with new timezone
    if (key === 'timezone') {
      logger.scheduler.info('System timezone changed', { newTimezone: value });
    }

    res.json(updated);
  } catch (error: any) {
    logger.api.error('Failed to update system setting', error);
    res.status(500).json({ error: 'Failed to update system setting' });
  }
});

export default router;
