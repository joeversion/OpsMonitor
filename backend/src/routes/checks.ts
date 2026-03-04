import express from 'express';
import db from '../db/database';
import { HealthChecker } from '../services/health-checker';
import { checkEventBus } from '../services/check-event-bus';

const router = express.Router();

// SSE endpoint - real-time check result updates
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { /* ignore */ }
  }, 25000);

  checkEventBus.addClient(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    checkEventBus.removeClient(res);
  });
});

// Get latest status for ALL services (used by dependency graph)
router.get('/latest', (req, res) => {
  try {
    const services = db.prepare('SELECT id FROM services').all() as { id: string }[];
    const result: Record<string, { 
      status: string; 
      response_time: number | null;
      error_message: string | null;
      checked_at: string | null;
    }> = {};
    
    const stmt = db.prepare(`
      SELECT status, response_time, error_message, checked_at FROM check_records 
      WHERE service_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `);
    
    services.forEach(service => {
      const record = stmt.get(service.id) as { 
        status: string; 
        response_time: number;
        error_message: string | null;
        checked_at: string;
      } | undefined;
      if (record) {
        result[service.id] = {
          status: record.status,
          response_time: record.response_time,
          error_message: record.error_message,
          checked_at: record.checked_at
        };
      } else {
        result[service.id] = {
          status: 'unknown',
          response_time: null,
          error_message: null,
          checked_at: null
        };
      }
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger a manual check
router.post('/:id/run', async (req, res) => {
  const { id } = req.params;
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;

  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  try {
    const result = await HealthChecker.check(service);
    await HealthChecker.saveResult(id, result);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest check result
router.get('/:id/latest', (req, res) => {
  const { id } = req.params;
  const result = db.prepare(`
    SELECT * FROM check_records 
    WHERE service_id = ? 
    ORDER BY checked_at DESC 
    LIMIT 1
  `).get(id) as any;
  
  if (!result) {
    return res.status(404).json({ error: 'No check records found' });
  }
  
  if (result.details) {
    try {
      result.details = JSON.parse(result.details);
    } catch (_) {
      // keep as string
    }
  }
  res.json(result);
});

// Get check history
router.get('/:id/history', (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  
  const results = db.prepare(`
    SELECT * FROM check_records 
    WHERE service_id = ? 
    ORDER BY checked_at DESC 
    LIMIT ?
  `).all(id, limit) as any[];
  
  const parsed = results.map(r => {
    if (r.details) {
      try { r.details = JSON.parse(r.details); } catch (_) { /* ignore */ }
    }
    return r;
  });
  res.json(parsed);
});

// Get system stats
router.get('/stats/summary', (req, res) => {
  try {
    const { project_id } = req.query;
    let services;
    
    if (project_id) {
      services = db.prepare('SELECT id, enabled FROM services WHERE project_id = ?').all(project_id) as { id: string; enabled: number }[];
    } else {
      services = db.prepare('SELECT id, enabled FROM services').all() as { id: string; enabled: number }[];
    }
    
    const stats = {
      up: 0,
      down: 0,
      warning: 0,
      unknown: 0,
      total: services.length
    };

    const stmt = db.prepare(`
      SELECT status FROM check_records 
      WHERE service_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `);

    services.forEach(service => {
      // Disabled services are counted as unknown regardless of check records
      if (!service.enabled) {
        stats.unknown++;
        return;
      }
      
      const record = stmt.get(service.id) as { status: string } | undefined;
      if (record && record.status) {
        // @ts-ignore
        if (stats[record.status] !== undefined) {
          // @ts-ignore
          stats[record.status]++;
        }
      } else {
        stats.unknown++;
      }
    });

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
