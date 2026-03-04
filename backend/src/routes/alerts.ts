import express from 'express';
import db from '../db/database';

const router = express.Router();

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = db.prepare(`
    SELECT a.*, s.name as service_name, p.name as project_name
    FROM alerts a
    JOIN services s ON a.service_id = s.id
    LEFT JOIN projects p ON s.project_id = p.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(alerts);
});

export default router;
