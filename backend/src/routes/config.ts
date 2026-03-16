import express from 'express';
import db from '../db/database';
import { NotificationService } from '../services/notification-service';
import { Scheduler } from '../services/scheduler';
import logger from '../utils/logger';

const router = express.Router();

// Get General Settings
router.get('/general', (req, res) => {
  try {
    const keys = ['default_check_interval', 'default_warning_threshold', 'default_error_threshold', 'default_failure_threshold', 'data_retention_days'];
    const configs = db.prepare(`
      SELECT key, value FROM system_configs WHERE key IN (?, ?, ?, ?, ?)
    `).all(...keys) as { key: string; value: string }[];
    
    const settings: Record<string, number> = {
      defaultInterval: 60,
      warningThreshold: 3,
      errorThreshold: 5,
      failureThreshold: 3,
      dataRetentionDays: 30
    };
    
    configs.forEach((c) => {
      const value = parseInt(c.value, 10);
      switch (c.key) {
        case 'default_check_interval':
          settings.defaultInterval = value;
          break;
        case 'default_warning_threshold':
          settings.warningThreshold = value;
          break;
        case 'default_error_threshold':
          settings.errorThreshold = value;
          break;
        case 'default_failure_threshold':
          settings.failureThreshold = value;
          break;
        case 'data_retention_days':
          settings.dataRetentionDays = value;
          break;
      }
    });
    
    res.json(settings);
  } catch (error: any) {
    logger.api.error('Get general settings error', { error });
    res.status(500).json({ error: error.message });
  }
});

// Update General Settings
router.put('/general', (req, res) => {
  try {
    const { defaultInterval, warningThreshold, errorThreshold, failureThreshold, dataRetentionDays } = req.body;
    
    // Validation
    if (defaultInterval !== undefined && (defaultInterval < 10 || defaultInterval > 3600)) {
      return res.status(400).json({ error: 'Default interval must be between 10 and 3600 seconds' });
    }
    if (warningThreshold !== undefined && (warningThreshold < 1 || warningThreshold > 30)) {
      return res.status(400).json({ error: 'Warning threshold must be between 1 and 30' });
    }
    if (errorThreshold !== undefined && (errorThreshold < 1 || errorThreshold > 50)) {
      return res.status(400).json({ error: 'Error threshold must be between 1 and 50' });
    }
    if (failureThreshold !== undefined && (failureThreshold < 1 || failureThreshold > 10)) {
      return res.status(400).json({ error: 'Failure threshold must be between 1 and 10' });
    }
    if (dataRetentionDays !== undefined && (dataRetentionDays < 1 || dataRetentionDays > 365)) {
      return res.status(400).json({ error: 'Data retention must be between 1 and 365 days' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO system_configs (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    
    const updateTransaction = db.transaction(() => {
      if (defaultInterval !== undefined) {
        stmt.run('default_check_interval', String(defaultInterval));
      }
      if (warningThreshold !== undefined) {
        stmt.run('default_warning_threshold', String(warningThreshold));
      }
      if (errorThreshold !== undefined) {
        stmt.run('default_error_threshold', String(errorThreshold));
      }
      if (failureThreshold !== undefined) {
        stmt.run('default_failure_threshold', String(failureThreshold));
      }
      if (dataRetentionDays !== undefined) {
        stmt.run('data_retention_days', String(dataRetentionDays));
      }
    });
    
    updateTransaction();
    res.json({ success: true, message: 'General settings updated successfully' });
  } catch (error: any) {
    logger.api.error('Update general settings error', { error });
    res.status(500).json({ error: error.message });
  }
});

// Get all configs
router.get('/notifications', (req, res) => {
  const configs = db.prepare('SELECT key, value, description FROM system_configs').all();
  const configObj: Record<string, string> = {};
  configs.forEach((c: any) => {
    configObj[c.key] = c.value;
  });
  res.json(configObj);
});

// Update configs
router.put('/notifications', (req, res) => {
  const updates = req.body; // { smtp_host: '...', ... }
  
  const stmt = db.prepare(`
    INSERT INTO system_configs (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const updateTransaction = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
         stmt.run(key, String(value));
      }
    }
  });

  try {
    updateTransaction(updates);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test notification
router.post('/notifications/test', async (req, res) => {
  const { type, target, lang } = req.body; // type: 'email' | 'teams', target: email address or webhook url, lang: 'zh-CN' | 'en-US'
  const isZh = lang === 'zh-CN';

  try {
    if (type === 'email') {
      const subject = isZh ? '测试通知' : 'Test Notification';
      const html = isZh
        ? '<h1>这是一封测试邮件</h1><p>如果您看到此邮件，说明邮件配置正常。</p>'
        : '<h1>This is a test email</h1><p>If you see this, email configuration is working.</p>';
      await NotificationService.sendEmail(target, subject, html);
    } else if (type === 'teams') {
      const title = isZh ? '🔔 测试通知 - OpsMonitor' : '🔔 Test Notification - OpsMonitor';
      const message = isZh
        ? '✅ 这是来自 OpsMonitor 的测试通知。如果您看到此消息，说明 Teams Webhook 配置正常！'
        : '✅ This is a test notification from OpsMonitor. If you see this message, your Teams webhook is configured correctly!';
      await NotificationService.sendTeamsNotification(target, message, title, '0076D7');
    }
    res.json({ success: true, message: `${type} notification sent successfully` });
  } catch (error: any) {
    logger.notification.error('Notification test failed', { type, target, error });
    res.status(500).json({ success: false, error: error.message || 'Failed to send notification' });
  }
});

// Set notification language preference
router.put('/notification-lang', (req, res) => {
  try {
    const { lang } = req.body;
    if (!lang || !['en-US', 'zh-CN'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid lang. Must be en-US or zh-CN' });
    }
    db.prepare(`
      INSERT INTO system_configs (key, value, updated_at)
      VALUES ('notification_lang', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(lang);
    res.json({ success: true });
  } catch (error: any) {
    logger.api.error('Set notification lang error', { error });
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger security config expiry check
router.post('/security-check/trigger', async (req, res) => {
  try {
    await Scheduler.triggerSecurityConfigCheck();
    res.json({ success: true, message: 'Security config expiry check triggered successfully' });
  } catch (error: any) {
    logger.api.error('Manual security check failed', { error });
    res.status(500).json({ success: false, error: error.message || 'Failed to trigger security check' });
  }
});

export default router;
