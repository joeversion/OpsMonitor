import { Router } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { SSHService } from '../services/ssh-service';

const router = Router();

// Get all security configs
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM security_configs ORDER BY expiry_date ASC');
    const configs = stmt.all();
    
    const parsedConfigs = configs.map((c: any) => ({
      ...c,
      affected_services: c.affected_services ? JSON.parse(c.affected_services) : [],
      reminder_days: c.reminder_days ? JSON.parse(c.reminder_days) : [7, 3, 1],
      notes: c.notes || '',
      days_remaining: calculateDaysRemaining(c.expiry_date),
      status: getExpiryStatus(c.expiry_date)
    }));
    
    res.json(parsedConfigs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get security config statistics
router.get('/stats', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM security_configs');
    const configs = stmt.all();
    
    const stats = {
      total: configs.length,
      normal: 0,
      warning: 0,
      critical: 0,
      expired: 0
    };
    
    configs.forEach((c: any) => {
      const status = getExpiryStatus(c.expiry_date);
      if (status === 'normal') stats.normal++;
      else if (status === 'warning') stats.warning++;
      else if (status === 'critical') stats.critical++;
      else if (status === 'expired') stats.expired++;
    });
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single security config
router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM security_configs WHERE id = ?');
    const config = stmt.get(req.params.id) as any;
    
    if (!config) {
      return res.status(404).json({ error: 'Security config not found' });
    }
    
    res.json({
      ...config,
      affected_services: config.affected_services ? JSON.parse(config.affected_services) : [],
      reminder_days: config.reminder_days ? JSON.parse(config.reminder_days) : [7, 3, 1],
      notes: config.notes || '',
      days_remaining: calculateDaysRemaining(config.expiry_date),
      status: getExpiryStatus(config.expiry_date)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create security config
router.post('/', (req, res) => {
  try {
    const {
      name,
      type,
      affected_services,
      validity_days,
      last_reset_at,
      expiry_date,
      reminder_days,
      notes,
      // SSH fields
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_auth_type,
      ssh_credential,
      ssh_passphrase,
      ssh_proxy_host,
      ssh_proxy_port,
      ssh_proxy_username
    } = req.body;

    const id = uuidv4();
    
    // Calculate expiry_date if not provided
    let finalExpiryDate = expiry_date;
    if (!finalExpiryDate && validity_days && last_reset_at) {
      const resetDate = new Date(last_reset_at);
      resetDate.setDate(resetDate.getDate() + validity_days);
      finalExpiryDate = resetDate.toISOString();
    } else if (!finalExpiryDate && validity_days) {
      const now = new Date();
      now.setDate(now.getDate() + validity_days);
      finalExpiryDate = now.toISOString();
    }

    const stmt = db.prepare(`
      INSERT INTO security_configs (
        id, name, type, affected_services, validity_days,
        last_reset_at, expiry_date, reminder_days, notes,
        ssh_host, ssh_port, ssh_username, ssh_auth_type,
        ssh_credential, ssh_passphrase, ssh_proxy_host, ssh_proxy_port, ssh_proxy_username
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name,
      type,
      affected_services ? JSON.stringify(affected_services) : '[]',
      validity_days || null,
      last_reset_at || new Date().toISOString(),
      finalExpiryDate,
      reminder_days ? JSON.stringify(reminder_days) : '[7, 3, 1]',
      notes || null,
      ssh_host || null,
      ssh_port || 22,
      ssh_username || null,
      ssh_auth_type || null,
      ssh_credential || null,
      ssh_passphrase || null,
      ssh_proxy_host || null,
      ssh_proxy_port || null,
      ssh_proxy_username || null
    );

    res.status(201).json({ id, message: 'Security config created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update security config
router.put('/:id', (req, res) => {
  try {
    const {
      name,
      type,
      affected_services,
      validity_days,
      last_reset_at,
      expiry_date,
      reminder_days,
      notes,
      // SSH fields
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_auth_type,
      ssh_credential,
      ssh_passphrase,
      ssh_proxy_host,
      ssh_proxy_port,
      ssh_proxy_username
    } = req.body;

    // Build update query dynamically to handle optional SSH credential updates
    let updateFields = [
      'name = ?',
      'type = ?',
      'affected_services = ?',
      'validity_days = ?',
      'last_reset_at = ?',
      'expiry_date = ?',
      'reminder_days = ?',
      'notes = ?',
      'ssh_host = ?',
      'ssh_port = ?',
      'ssh_username = ?',
      'ssh_auth_type = ?',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    
    let params: any[] = [
      name,
      type,
      affected_services ? JSON.stringify(affected_services) : '[]',
      validity_days || null,
      last_reset_at,
      expiry_date,
      reminder_days ? JSON.stringify(reminder_days) : '[7, 3, 1]',
      notes || null,
      ssh_host || null,
      ssh_port || 22,
      ssh_username || null,
      ssh_auth_type || null
    ];
    
    // Only update credentials if provided (don't overwrite with empty)
    if (ssh_credential) {
      updateFields.push('ssh_credential = ?');
      params.push(ssh_credential);
    }
    if (ssh_passphrase !== undefined) {
      updateFields.push('ssh_passphrase = ?');
      params.push(ssh_passphrase || null);
    }
    
    updateFields.push('ssh_proxy_host = ?');
    params.push(ssh_proxy_host || null);
    updateFields.push('ssh_proxy_port = ?');
    params.push(ssh_proxy_port || null);
    updateFields.push('ssh_proxy_username = ?');
    params.push(ssh_proxy_username || null);
    
    params.push(req.params.id);

    const stmt = db.prepare(`
      UPDATE security_configs SET
        ${updateFields.join(', ')}
      WHERE id = ?
    `);

    const info = stmt.run(...params);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Security config not found' });
    }

    res.json({ message: 'Security config updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extend (renew) security config
router.post('/:id/extend', async (req, res) => {
  try {
    const { extend_days } = req.body;
    const daysToExtend = extend_days || 60; // Default 60 days

    // Get current config
    const getStmt = db.prepare('SELECT * FROM security_configs WHERE id = ?');
    const config = getStmt.get(req.params.id) as any;
    
    if (!config) {
      return res.status(404).json({ error: 'Security config not found' });
    }

    // Store old status before update
    const oldStatus = config.last_status;
    const wasExpired = oldStatus && oldStatus !== 'normal';

    // Calculate new expiry date from today
    const newResetAt = new Date();
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + daysToExtend);

    const updateStmt = db.prepare(`
      UPDATE security_configs SET
        last_reset_at = ?,
        expiry_date = ?,
        last_status = 'normal',
        last_reminded_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      newResetAt.toISOString(),
      newExpiryDate.toISOString(),
      req.params.id
    );

    // If config was in expired/warning/critical state, send recovery notification
    if (wasExpired) {
      const { AlertService } = await import('../services/alert-service.js');
      const updatedConfig = { ...config, last_reset_at: newResetAt.toISOString(), expiry_date: newExpiryDate.toISOString() };
      await AlertService.processSecurityConfigRecovery(updatedConfig, oldStatus);
    }

    res.json({ 
      message: `Extended by ${daysToExtend} days`,
      new_expiry_date: newExpiryDate.toISOString(),
      days_remaining: daysToExtend
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete security config
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM security_configs WHERE id = ?');
    const info = stmt.run(req.params.id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Security config not found' });
    }

    res.json({ message: 'Security config deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check expiring configs (for scheduled tasks)
router.get('/check/expiring', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM security_configs');
    const configs = stmt.all();
    
    const expiringConfigs = configs
      .map((c: any) => ({
        ...c,
        affected_services: c.affected_services ? JSON.parse(c.affected_services) : [],
        reminder_days: c.reminder_days ? JSON.parse(c.reminder_days) : [7, 3, 1],
        notes: c.notes || '',
        days_remaining: calculateDaysRemaining(c.expiry_date),
        status: getExpiryStatus(c.expiry_date)
      }))
      .filter((c: any) => c.status !== 'normal');
    
    res.json(expiringConfigs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test SSH connection
router.post('/test-ssh', async (req, res) => {
  try {
    const {
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_auth_type,
      ssh_credential,
      ssh_passphrase,
      ssh_proxy_host,
      ssh_proxy_port,
      ssh_proxy_username
    } = req.body;

    if (!ssh_host || !ssh_username || !ssh_credential) {
      return res.status(400).json({ 
        success: false, 
        message: 'Host, username, and credential are required' 
      });
    }

    const credentials = {
      host: ssh_host,
      port: ssh_port || 22,
      username: ssh_username,
      auth_type: ssh_auth_type || 'password',
      credential: ssh_credential,
      passphrase: ssh_passphrase,
      proxy_host: ssh_proxy_host,
      proxy_port: ssh_proxy_port,
      proxy_username: ssh_proxy_username
    };

    const result = await SSHService.testConnection(credentials);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Connection test failed' 
    });
  }
});

// Helper functions
function calculateDaysRemaining(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(expiryDate: string): 'normal' | 'warning' | 'critical' | 'expired' {
  const days = calculateDaysRemaining(expiryDate);
  
  if (days <= 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'normal';
}

export default router;
