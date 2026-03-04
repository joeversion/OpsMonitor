import { Router, Request, Response } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import axios from 'axios';

const router = Router();

// Ensure grafana_dashboards table exists
const createTableStmt = db.prepare(`
  CREATE TABLE IF NOT EXISTS grafana_dashboards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    project_ids TEXT,
    service_id TEXT,
    grafana_url TEXT NOT NULL,
    dashboard_uid TEXT NOT NULL,
    panel_id INTEGER,
    embed_options TEXT,
    display_order INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
  )
`);
createTableStmt.run();

// Add project_ids column if not exists (for migration)
try {
  db.exec(`ALTER TABLE grafana_dashboards ADD COLUMN project_ids TEXT`);
} catch (e) {
  // Column already exists
}

// Create indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_project ON grafana_dashboards(project_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_service ON grafana_dashboards(service_id)`);

// Helper function to build embed URL
function buildEmbedUrl(dashboard: any): string {
  const options = dashboard.embed_options ? JSON.parse(dashboard.embed_options) : {};
  let url = dashboard.grafana_url.replace(/\/$/, '');
  
  if (dashboard.panel_id) {
    // Single panel embed
    url += `/d-solo/${dashboard.dashboard_uid}/dashboard`;
  } else {
    // Full dashboard embed
    url += `/d/${dashboard.dashboard_uid}/dashboard`;
  }
  
  const params = new URLSearchParams();
  params.append('orgId', '1');
  
  if (options.theme) params.append('theme', options.theme);
  if (options.from) params.append('from', options.from);
  if (options.to) params.append('to', options.to);
  if (options.refresh) params.append('refresh', options.refresh);
  // Kiosk mode: use 'tv' for TV mode (hides side menu and navbar) or 'true' for full kiosk
  if (options.kiosk) params.append('kiosk', 'tv');
  if (dashboard.panel_id) params.append('panelId', dashboard.panel_id.toString());
  
  // Add template variables
  if (options.vars) {
    for (const [key, value] of Object.entries(options.vars)) {
      params.append(`var-${key}`, value as string);
    }
  }
  
  return `${url}?${params.toString()}`;
}

// Helper function to get project names from project_ids
function getProjectNames(projectIds: string[]): string[] {
  if (!projectIds || projectIds.length === 0) return [];
  const stmt = db.prepare(`SELECT id, name FROM projects WHERE id IN (${projectIds.map(() => '?').join(',')})`);
  const projects = stmt.all(...projectIds) as { id: string; name: string }[];
  return projects.map(p => p.name);
}

// Get all dashboards
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT gd.*, p.name as project_name, s.name as service_name
      FROM grafana_dashboards gd
      LEFT JOIN projects p ON gd.project_id = p.id
      LEFT JOIN services s ON gd.service_id = s.id
      ORDER BY gd.display_order ASC, gd.created_at DESC
    `);
    const dashboards = stmt.all();
    
    const parsedDashboards = dashboards.map((d: any) => {
      const projectIds = d.project_ids ? JSON.parse(d.project_ids) : [];
      return {
        ...d,
        enabled: d.enabled === 1,
        embed_options: d.embed_options ? JSON.parse(d.embed_options) : {},
        embed_url: buildEmbedUrl(d),
        project_ids: projectIds,
        project_names: projectIds.length > 0 ? getProjectNames(projectIds) : (d.project_name ? [d.project_name] : [])
      };
    });
    
    res.json(parsedDashboards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single dashboard
router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT gd.*, p.name as project_name, s.name as service_name
      FROM grafana_dashboards gd
      LEFT JOIN projects p ON gd.project_id = p.id
      LEFT JOIN services s ON gd.service_id = s.id
      WHERE gd.id = ?
    `);
    const dashboard = stmt.get(req.params.id) as any;
    
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    const projectIds = dashboard.project_ids ? JSON.parse(dashboard.project_ids) : [];
    res.json({
      ...dashboard,
      enabled: dashboard.enabled === 1,
      embed_options: dashboard.embed_options ? JSON.parse(dashboard.embed_options) : {},
      embed_url: buildEmbedUrl(dashboard),
      project_ids: projectIds,
      project_names: projectIds.length > 0 ? getProjectNames(projectIds) : (dashboard.project_name ? [dashboard.project_name] : [])
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboards by project (supports both project_id and project_ids)
router.get('/by-project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const stmt = db.prepare(`
      SELECT gd.*, p.name as project_name, s.name as service_name
      FROM grafana_dashboards gd
      LEFT JOIN projects p ON gd.project_id = p.id
      LEFT JOIN services s ON gd.service_id = s.id
      WHERE gd.project_id = ? OR gd.project_ids LIKE ?
      ORDER BY gd.display_order ASC, gd.created_at DESC
    `);
    const dashboards = stmt.all(projectId, `%"${projectId}"%`);
    
    const parsedDashboards = dashboards.map((d: any) => {
      const projectIds = d.project_ids ? JSON.parse(d.project_ids) : [];
      return {
        ...d,
        enabled: d.enabled === 1,
        embed_options: d.embed_options ? JSON.parse(d.embed_options) : {},
        embed_url: buildEmbedUrl(d),
        project_ids: projectIds,
        project_names: projectIds.length > 0 ? getProjectNames(projectIds) : (d.project_name ? [d.project_name] : [])
      };
    });
    
    res.json(parsedDashboards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboards by service
router.get('/by-service/:serviceId', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT gd.*, p.name as project_name, s.name as service_name
      FROM grafana_dashboards gd
      LEFT JOIN projects p ON gd.project_id = p.id
      LEFT JOIN services s ON gd.service_id = s.id
      WHERE gd.service_id = ?
      ORDER BY gd.display_order ASC, gd.created_at DESC
    `);
    const dashboards = stmt.all(req.params.serviceId);
    
    const parsedDashboards = dashboards.map((d: any) => {
      const projectIds = d.project_ids ? JSON.parse(d.project_ids) : [];
      return {
        ...d,
        enabled: d.enabled === 1,
        embed_options: d.embed_options ? JSON.parse(d.embed_options) : {},
        embed_url: buildEmbedUrl(d),
        project_ids: projectIds,
        project_names: projectIds.length > 0 ? getProjectNames(projectIds) : (d.project_name ? [d.project_name] : [])
      };
    });
    
    res.json(parsedDashboards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create dashboard
router.post('/', (req, res) => {
  try {
    const {
      name,
      description,
      project_id,
      project_ids,
      service_id,
      grafana_url,
      dashboard_uid,
      panel_id,
      embed_options,
      display_order,
      enabled
    } = req.body;

    if (!name || !grafana_url || !dashboard_uid) {
      return res.status(400).json({ error: 'name, grafana_url, and dashboard_uid are required' });
    }

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO grafana_dashboards (
        id, name, description, project_id, project_ids, service_id, grafana_url, 
        dashboard_uid, panel_id, embed_options, display_order, enabled
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Determine project_id from project_ids if available
    const effectiveProjectId = project_id || (project_ids && project_ids.length === 1 ? project_ids[0] : null);
    const effectiveProjectIds = project_ids && project_ids.length > 0 ? JSON.stringify(project_ids) : null;
    
    stmt.run(
      id,
      name,
      description || null,
      effectiveProjectId,
      effectiveProjectIds,
      service_id || null,
      grafana_url,
      dashboard_uid,
      panel_id || null,
      embed_options ? JSON.stringify(embed_options) : null,
      display_order || 0,
      enabled !== undefined ? (enabled ? 1 : 0) : 1
    );

    res.status(201).json({ id, message: 'Dashboard created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update dashboard
router.put('/:id', (req, res) => {
  try {
    const {
      name,
      description,
      project_id,
      project_ids,
      service_id,
      grafana_url,
      dashboard_uid,
      panel_id,
      embed_options,
      display_order,
      enabled
    } = req.body;

    logger.api.debug('Update dashboard', { dashboardId: req.params.id, enabled, project_ids });

    // Check if exists
    const checkStmt = db.prepare('SELECT id FROM grafana_dashboards WHERE id = ?');
    const existing = checkStmt.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    // Calculate enabled value
    const enabledValue = enabled !== undefined ? (enabled ? 1 : 0) : undefined;
    
    // Determine project_id from project_ids if available
    const effectiveProjectId = project_id !== undefined ? project_id : (project_ids && project_ids.length === 1 ? project_ids[0] : null);
    const effectiveProjectIds = project_ids !== undefined ? (project_ids && project_ids.length > 0 ? JSON.stringify(project_ids) : null) : undefined;

    const stmt = db.prepare(`
      UPDATE grafana_dashboards SET
        name = COALESCE(?, name),
        description = ?,
        project_id = ?,
        project_ids = CASE WHEN ? IS NOT NULL THEN ? ELSE project_ids END,
        service_id = ?,
        grafana_url = COALESCE(?, grafana_url),
        dashboard_uid = COALESCE(?, dashboard_uid),
        panel_id = ?,
        embed_options = ?,
        display_order = COALESCE(?, display_order),
        enabled = CASE WHEN ? IS NOT NULL THEN ? ELSE enabled END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      name || null,
      description !== undefined ? description : null,
      effectiveProjectId !== undefined ? effectiveProjectId : null,
      effectiveProjectIds !== undefined ? 1 : null,  // Mark if has value
      effectiveProjectIds !== undefined ? effectiveProjectIds : null,  // Actual value
      service_id !== undefined ? service_id : null,
      grafana_url || null,
      dashboard_uid || null,
      panel_id !== undefined ? panel_id : null,
      embed_options !== undefined ? JSON.stringify(embed_options) : null,
      display_order !== undefined ? display_order : null,
      enabledValue !== undefined ? 1 : null,  // Mark if has value
      enabledValue !== undefined ? enabledValue : null,  // Actual value
      req.params.id
    );

    res.json({ message: 'Dashboard updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete dashboard
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM grafana_dashboards WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json({ message: 'Dashboard deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle enabled status
router.patch('/:id/toggle', (req, res) => {
  try {
    const checkStmt = db.prepare('SELECT enabled FROM grafana_dashboards WHERE id = ?');
    const dashboard = checkStmt.get(req.params.id) as any;
    
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    const newEnabled = dashboard.enabled ? 0 : 1;
    const updateStmt = db.prepare(`
      UPDATE grafana_dashboards SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    updateStmt.run(newEnabled, req.params.id);
    
    res.json({ enabled: !!newEnabled, message: 'Dashboard toggled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder dashboards
router.post('/reorder', (req, res) => {
  try {
    const { orders } = req.body; // [{ id: string, display_order: number }]
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders array is required' });
    }
    
    const stmt = db.prepare('UPDATE grafana_dashboards SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const transaction = db.transaction(() => {
      for (const order of orders) {
        stmt.run(order.display_order, order.id);
      }
    });
    transaction();
    
    res.json({ message: 'Dashboards reordered successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test Grafana connection and get available dashboards
router.post('/test-connection', async (req, res) => {
  try {
    const { grafana_url, api_key } = req.body;
    
    if (!grafana_url) {
      return res.status(400).json({ error: 'grafana_url is required' });
    }

    const baseUrl = grafana_url.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (api_key) {
      headers['Authorization'] = `Bearer ${api_key}`;
    }

    // Test connection by fetching health endpoint
    try {
      await axios.get(`${baseUrl}/api/health`, { headers, timeout: 5000 });
    } catch (healthError: any) {
      // If health check fails, try the search endpoint directly
      // Some Grafana instances may not expose /api/health publicly
    }

    // Fetch available dashboards
    const searchResponse = await axios.get(`${baseUrl}/api/search?type=dash-db`, { 
      headers, 
      timeout: 10000 
    });

    const dashboards = searchResponse.data.map((d: any) => ({
      uid: d.uid,
      title: d.title,
      url: d.url,
      type: d.type,
      tags: d.tags || [],
      folderTitle: d.folderTitle || 'General'
    }));

    res.json({ 
      success: true, 
      message: `Connected successfully. Found ${dashboards.length} dashboards.`,
      dashboards 
    });
  } catch (error: any) {
    const message = error.response?.status === 401 
      ? 'Authentication failed. Please check your API key.'
      : error.response?.status === 403
      ? 'Access denied. API key may lack permissions.'
      : error.code === 'ECONNREFUSED'
      ? 'Connection refused. Please check the Grafana URL.'
      : error.code === 'ENOTFOUND'
      ? 'Host not found. Please check the Grafana URL.'
      : `Connection failed: ${error.message}`;
    
    res.status(400).json({ success: false, error: message });
  }
});

// Get dashboard details from Grafana (including panels)
router.post('/fetch-dashboard', async (req, res) => {
  try {
    const { grafana_url, dashboard_uid, api_key } = req.body;
    
    if (!grafana_url || !dashboard_uid) {
      return res.status(400).json({ error: 'grafana_url and dashboard_uid are required' });
    }

    const baseUrl = grafana_url.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (api_key) {
      headers['Authorization'] = `Bearer ${api_key}`;
    }

    const response = await axios.get(`${baseUrl}/api/dashboards/uid/${dashboard_uid}`, { 
      headers, 
      timeout: 10000 
    });

    const dashboard = response.data.dashboard;
    const panels = (dashboard.panels || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      type: p.type
    }));

    res.json({
      success: true,
      dashboard: {
        uid: dashboard.uid,
        title: dashboard.title,
        description: dashboard.description,
        tags: dashboard.tags || []
      },
      panels
    });
  } catch (error: any) {
    const message = error.response?.status === 404
      ? 'Dashboard not found'
      : `Failed to fetch dashboard: ${error.message}`;
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
