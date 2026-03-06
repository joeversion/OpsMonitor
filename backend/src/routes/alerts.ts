import express from 'express';
import db from '../db/database';

const router = express.Router();

// Get recent alerts (supports both service alerts and security config alerts)
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = db.prepare(`
    SELECT a.*, 
      s.name as service_name, 
      p.name as project_name,
      sc.name as security_config_name
    FROM alerts a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN projects p ON s.project_id = p.id
    LEFT JOIN security_configs sc ON a.security_config_id = sc.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(alerts);
});

// Get unacknowledged alert count (for bell badge)
router.get('/unacknowledged/count', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0').get() as { count: number };
  res.json({ count: row.count });
});

// Acknowledge all alerts (mark as read)
router.post('/acknowledge', (req, res) => {
  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0').run();
  res.json({ success: true });
});

export default router;
