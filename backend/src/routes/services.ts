import { Router } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { Scheduler } from '../services/scheduler';
import logger from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

// Export services
router.get('/export', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM services');
    const services = stmt.all();
    // Parse JSON fields for export
    const parsedServices = services.map((s: any) => ({
      ...s,
      http_config: s.http_config ? JSON.parse(s.http_config) : null,
      dependencies: s.dependencies ? JSON.parse(s.dependencies) : [],
      enabled: Boolean(s.enabled),
      alert_enabled: Boolean(s.alert_enabled)
    }));
    
    res.setHeader('Content-Disposition', 'attachment; filename="services.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(parsedServices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Import services
router.post('/import', (req, res) => {
  try {
    const services = req.body;
    if (!Array.isArray(services)) {
      return res.status(400).json({ error: 'Invalid format. Expected an array of services.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO services (
        id, name, description, host, port, check_type,
        http_config, risk_level, layer, check_interval, warning_threshold,
        error_threshold, enabled, alert_enabled, dependencies
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        host = excluded.host,
        port = excluded.port,
        check_type = excluded.check_type,
        http_config = excluded.http_config,
        risk_level = excluded.risk_level,
        check_interval = excluded.check_interval,
        warning_threshold = excluded.warning_threshold,
        error_threshold = excluded.error_threshold,
        enabled = excluded.enabled,
        alert_enabled = excluded.alert_enabled,
        dependencies = excluded.dependencies,
        updated_at = CURRENT_TIMESTAMP
    `);

    const importTransaction = db.transaction((servicesList) => {
      for (const s of servicesList) {
        insertStmt.run(
          s.id || uuidv4(),
          s.name,
          s.description,
          s.host,
          s.port,
          s.check_type,
          s.http_config ? JSON.stringify(s.http_config) : null,
          s.risk_level,
          s.check_interval,
          s.warning_threshold,
          s.error_threshold,
          s.enabled ? 1 : 0,
          s.alert_enabled ? 1 : 0,
          s.dependencies ? JSON.stringify(s.dependencies) : '[]'
        );
      }
    });

    importTransaction(services);
    
    // Reload scheduler
    Scheduler.loadJobs();

    res.json({ message: `Imported ${services.length} services successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update services layout
router.post('/layout', (req, res) => {
  try {
    const updates = req.body; // Array of { id, x, y, isCrossProjectService?, viewingProjectId? }
    logger.api.debug('Received layout update request', { updateCount: updates.length });
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid format. Expected an array of updates.' });
    }

    if (updates.length === 0) {
      return res.json({ message: 'No updates to apply' });
    }

    // Separate updates for own services vs cross-project services
    const ownServiceUpdates = updates.filter(u => !u.isCrossProjectService);
    const crossProjectUpdates = updates.filter(u => u.isCrossProjectService && u.viewingProjectId);

    const updateOwnStmt = db.prepare(`
      UPDATE services 
      SET layout_x = ?, layout_y = ?
      WHERE id = ?
    `);

    const upsertCrossProjectStmt = db.prepare(`
      INSERT INTO cross_project_layouts (id, viewing_project_id, service_id, layout_x, layout_y, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(viewing_project_id, service_id) DO UPDATE SET
        layout_x = excluded.layout_x,
        layout_y = excluded.layout_y,
        updated_at = CURRENT_TIMESTAMP
    `);

    const { v4: uuidv4 } = require('uuid');

    const updateTransaction = db.transaction((ownItems: any[], crossItems: any[]) => {
      // Update own project services
      for (const item of ownItems) {
        const x = item.layout_x ?? item.x;
        const y = item.layout_y ?? item.y;
        logger.api.debug('Updating service layout', { serviceId: item.id, x, y });
        updateOwnStmt.run(x, y, item.id);
      }
      
      // Upsert cross-project layouts
      for (const item of crossItems) {
        const x = item.layout_x ?? item.x;
        const y = item.layout_y ?? item.y;
        const id = uuidv4();
        logger.api.debug('Updating cross-project layout', { 
          serviceId: item.id, 
          viewingProjectId: item.viewingProjectId, 
          x, y 
        });
        upsertCrossProjectStmt.run(id, item.viewingProjectId, item.id, x, y);
      }
    });

    updateTransaction(ownServiceUpdates, crossProjectUpdates);
    logger.api.info('Layout update completed', { 
      ownCount: ownServiceUpdates.length,
      crossProjectCount: crossProjectUpdates.length 
    });
    res.json({ 
      message: 'Layout updated successfully', 
      count: updates.length,
      ownCount: ownServiceUpdates.length,
      crossProjectCount: crossProjectUpdates.length
    });
  } catch (error: any) {
    logger.api.error('Layout update error', { error });
    res.status(500).json({ error: error.message });
  }
});

// Get cross-project layouts for a specific viewing project
router.get('/cross-project-layouts/:viewingProjectId', (req, res) => {
  try {
    const { viewingProjectId } = req.params;
    const stmt = db.prepare(`
      SELECT service_id, layout_x, layout_y 
      FROM cross_project_layouts 
      WHERE viewing_project_id = ?
    `);
    const layouts = stmt.all(viewingProjectId);
    res.json(layouts);
  } catch (error: any) {
    logger.api.error('Get cross-project layouts error', { error });
    res.status(500).json({ error: error.message });
  }
});

// Update single service layout
router.patch('/:id/layout', (req, res) => {
  try {
    const { id } = req.params;
    const { layout_x, layout_y } = req.body;

    const stmt = db.prepare(`
      UPDATE services 
      SET layout_x = ?, layout_y = ?
      WHERE id = ?
    `);
    
    stmt.run(layout_x, layout_y, id);
    res.json({ message: 'Layout updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all services
router.get('/', (req, res) => {
  try {
    const { project_id, host_id } = req.query;
    let services;
    
    if (project_id && host_id) {
      // Filter by both project and host
      const stmt = db.prepare(`
        SELECT s.*, p.name as project_name 
        FROM services s 
        LEFT JOIN projects p ON s.project_id = p.id 
        WHERE s.project_id = ? AND s.host_id = ?
        ORDER BY s.created_at DESC
      `);
      services = stmt.all(project_id, host_id);
    } else if (project_id) {
      // Filter by project only
      const stmt = db.prepare(`
        SELECT s.*, p.name as project_name 
        FROM services s 
        LEFT JOIN projects p ON s.project_id = p.id 
        WHERE s.project_id = ? 
        ORDER BY s.created_at DESC
      `);
      services = stmt.all(project_id);
    } else if (host_id) {
      // Filter by host only - with latest check status
      const stmt = db.prepare(`
        SELECT s.*, 
          p.name as project_name,
          (SELECT cr.status 
           FROM check_records cr 
           WHERE cr.service_id = s.id 
           ORDER BY cr.checked_at DESC LIMIT 1) as last_status,
          (SELECT cr.checked_at 
           FROM check_records cr 
           WHERE cr.service_id = s.id 
           ORDER BY cr.checked_at DESC LIMIT 1) as last_check_time,
          (SELECT cr.response_time 
           FROM check_records cr 
           WHERE cr.service_id = s.id 
           ORDER BY cr.checked_at DESC LIMIT 1) as last_response_time
        FROM services s 
        LEFT JOIN projects p ON s.project_id = p.id 
        WHERE s.host_id = ?
        ORDER BY s.name ASC
      `);
      services = stmt.all(host_id);
    } else {
      // No filter
      const stmt = db.prepare(`
        SELECT s.*, p.name as project_name 
        FROM services s 
        LEFT JOIN projects p ON s.project_id = p.id 
        ORDER BY s.created_at DESC
      `);
      services = stmt.all();
    }
    
    // Parse JSON fields and add status
    const parsedServices = services.map((s: any) => ({
      ...s,
      http_config: s.http_config ? JSON.parse(s.http_config) : null,
      ssh_check_config: s.ssh_check_config ? JSON.parse(s.ssh_check_config) : null,
      script_config: s.script_config ? JSON.parse(s.script_config) : null,
      process_config: s.process_config ? JSON.parse(s.process_config) : null,
      database_config: s.database_config ? JSON.parse(s.database_config) : null,
      file_config: s.file_config ? JSON.parse(s.file_config) : null,
      dependencies: s.dependencies ? JSON.parse(s.dependencies) : [],
      // Keep enabled/alert_enabled as numbers (0/1) to match ElSwitch active-value/inactive-value
      enabled: s.enabled,
      alert_enabled: s.alert_enabled,
      status: s.last_status || 'unknown'  // Add current status
    }));
    res.json(parsedServices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/details', authenticate, (req, res) => {
  try {
    const service = db.prepare(`
      SELECT s.*, p.name AS project_name, h.name AS host_name,
        h.connection_type AS host_connection_type, h.enabled AS host_enabled
      FROM services s LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN hosts h ON s.host_id = h.id WHERE s.id = ?
    `).get(req.params.id) as any;
    if (!service) return res.status(404).json({ error: 'Service not found' });
    const parseConfig = (value: any): any => {
      try { return typeof value === 'string' ? JSON.parse(value) : value || {}; }
      catch (_) { return {}; }
    };
    const secrets: string[] = [];
    const sensitiveKey = /password|passwd|passphrase|private.?key|secret|token|credential|authorization|api.?key/i;
    const collectSecrets = (value: any) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, entry] of Object.entries(value)) {
        if (sensitiveKey.test(key) && typeof entry === 'string' && entry) secrets.push(entry);
        else if (entry && typeof entry === 'object') collectSecrets(entry);
      }
    };
    for (const key of Object.keys(service).filter(key => key.endsWith('_config'))) collectSecrets(parseConfig(service[key]));
    if (service.host_id) collectSecrets(db.prepare('SELECT * FROM hosts WHERE id = ?').get(service.host_id));
    const sanitize = (value: any): any => {
      if (typeof value === 'string') {
        let text = value;
        for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
        return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED]')
          .replace(/(\w+:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@')
          .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
          .replace(/((?:password|passwd|passphrase|secret|token|api[_-]?key|authorization)\s*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi, '$1[REDACTED]');
      }
      if (Array.isArray(value)) return value.map(sanitize);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : sanitize(entry)]));
      return value;
    };
    const pick = (value: any, keys: string[]) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, sanitize(value[key])]));
    const configuration = {
      http: pick(parseConfig(service.http_config), ['protocol', 'path', 'expected_status', 'timeout']),
      check: pick(parseConfig(service.check_config), ['path', 'pattern', 'max_age_seconds', 'container_name', 'timeout', 'expected_status', 'protocol']),
      ssh: pick(parseConfig(service.ssh_check_config), ['path', 'pattern', 'max_age_seconds', 'container_name']),
      script: pick(parseConfig(service.script_config), ['script_type', 'expected_exit_code', 'timeout', 'working_dir']),
      file: pick(parseConfig(service.file_config), ['mode', 'file_path', 'directory_path', 'filename_pattern', 'use_latest', 'freshness_days', 'max_age_minutes', 'check_type', 'expected_size_delta', 'timeout_seconds']),
      schedule: pick(parseConfig(service.schedule_config), ['type', 'defaultInterval', 'timeRanges'])
    };
    const history = (db.prepare('SELECT * FROM check_records WHERE service_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 50').all(service.id) as any[]).map(record => {
      const result = pick(record, ['id', 'service_id', 'status', 'response_time', 'error_message', 'checked_at']);
      if (req.user?.role === 'admin') {
        Object.assign(result, pick(record, ['output', 'stdout', 'stderr']));
        result.details = sanitize(parseConfig(record.details));
      }
      return result;
    });
    const dependencies = db.prepare(`
      SELECT d.id, d.dependency_type, d.risk_level, d.description,
        d.source_service_id, d.target_service_id, d.target_resource_id,
        ss.name AS source_service_name, sp.name AS source_project_name,
        ts.name AS target_service_name, tp.name AS target_project_name,
        sc.name AS target_resource_name, sc.type AS target_resource_type,
        sc.expiry_date AS resource_expiry_date, sc.ssl_check_error AS resource_check_error
      FROM service_dependencies d
      LEFT JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN projects sp ON ss.project_id = sp.id
      LEFT JOIN services ts ON d.target_service_id = ts.id
      LEFT JOIN projects tp ON ts.project_id = tp.id
      LEFT JOIN security_configs sc ON d.target_resource_id = sc.id
      WHERE d.source_service_id = ? OR d.target_service_id = ?
    `).all(service.id, service.id) as any[];
    res.json({
      service: pick(service, ['id', 'name', 'description', 'project_id', 'project_name', 'host_id', 'host_name', 'host', 'port', 'host_connection_type', 'host_enabled', 'check_type', 'service_type', 'ssh_check_type', 'risk_level', 'layer', 'enabled', 'alert_enabled', 'check_interval', 'warning_threshold', 'error_threshold', 'failure_threshold', 'current_failure_count', 'impact_description', 'created_at', 'updated_at', 'schedule_type']),
      configuration, latest: history[0] || null, history,
      dependencies: {
        dependsOn: sanitize(dependencies.filter(item => item.source_service_id === service.id)),
        dependedBy: sanitize(dependencies.filter(item => item.target_service_id === service.id))
      },
      output_available: req.user?.role === 'admin', fetched_at: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('ServiceDetails', 'Failed to retrieve service details', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve service details' });
  }
});

// Get single service
router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM services WHERE id = ?');
    const service = stmt.get(req.params.id) as any;
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({
      ...service,
      http_config: service.http_config ? JSON.parse(service.http_config) : null,
      ssh_check_config: service.ssh_check_config ? JSON.parse(service.ssh_check_config) : null,
      script_config: service.script_config ? JSON.parse(service.script_config) : null,
      process_config: service.process_config ? JSON.parse(service.process_config) : null,
      database_config: service.database_config ? JSON.parse(service.database_config) : null,
      file_config: service.file_config ? JSON.parse(service.file_config) : null,
      dependencies: service.dependencies ? JSON.parse(service.dependencies) : [],
      // Keep enabled/alert_enabled as numbers (0/1) to match ElSwitch active-value/inactive-value
      enabled: service.enabled,
      alert_enabled: service.alert_enabled
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create service
router.post('/', (req, res) => {
  try {
    const {
      name, description, host, port, check_type,
      http_config, check_config, risk_level, layer, check_interval, warning_threshold,
      error_threshold, enabled, alert_enabled, dependencies, project_id,
      host_id,
      impact_description, custom_alert_template,
      service_type, ssh_config_id, ssh_check_type, ssh_check_config,
      script_config, process_config, database_config, file_config,
      failure_threshold,
      icon
    } = req.body;

    // Check for duplicate service name in the same project
    const checkStmt = db.prepare(`
      SELECT id FROM services 
      WHERE name = ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))
    `);
    const existing = checkStmt.get(name, project_id || null, project_id || null);
    if (existing) {
      return res.status(400).json({ 
        error: 'Service name already exists in this project',
        code: 'DUPLICATE_NAME'
      });
    }

    // Get default values from General Settings if not provided
    const getConfig = (key: string, defaultValue: string): number => {
      const row = db.prepare('SELECT value FROM system_configs WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? parseInt(row.value, 10) : parseInt(defaultValue, 10);
    };
    
    const finalCheckInterval = check_interval ?? getConfig('default_check_interval', '60');
    const finalWarningThreshold = warning_threshold ?? getConfig('default_warning_threshold', '3');
    const finalErrorThreshold = error_threshold ?? getConfig('default_error_threshold', '5');

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO services (
        id, name, description, host, port, check_type,
        http_config, check_config, risk_level, layer, check_interval, warning_threshold,
        error_threshold, enabled, alert_enabled, dependencies, project_id,
        host_id,
        impact_description, custom_alert_template,
        service_type, ssh_config_id, ssh_check_type, ssh_check_config,
        script_config, process_config, database_config, file_config,
        failure_threshold,
        icon
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?
      )
    `);

    stmt.run(
      id, 
      name || '', 
      description || null, 
      host || '', 
      port || 0, 
      check_type || 'tcp',
      http_config || null,
      check_config || null,
      risk_level || 'medium', 
      layer || null, 
      finalCheckInterval, 
      finalWarningThreshold,
      finalErrorThreshold, 
      enabled ? 1 : 0, 
      alert_enabled ? 1 : 0,
      dependencies ? JSON.stringify(dependencies) : '[]',
      project_id || null,
      host_id || null,
      impact_description || null,
      custom_alert_template || null,
      service_type || 'http',
      ssh_config_id || null,
      ssh_check_type || null,
      ssh_check_config || null,
      script_config || null,
      process_config || null,
      database_config || null,
      file_config || null,
      failure_threshold || 3,
      icon || null
    );

    // Schedule the new service
    const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    Scheduler.scheduleService(newService);

    res.status(201).json({ id, message: 'Service created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update service
router.put('/:id', (req, res) => {
  try {
    const {
      name, description, host, port, check_type,
      http_config, check_config, risk_level, layer, check_interval, warning_threshold,
      error_threshold, enabled, alert_enabled, dependencies, project_id,
      host_id,
      impact_description, custom_alert_template,
      service_type, ssh_config_id, ssh_check_type, ssh_check_config,
      script_config, process_config, database_config, file_config,
      failure_threshold,
      icon
    } = req.body;

    // Check for duplicate service name in the same project (excluding current service)
    const checkStmt = db.prepare(`
      SELECT id FROM services 
      WHERE name = ? AND id != ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))
    `);
    const existing = checkStmt.get(name, req.params.id, project_id || null, project_id || null);
    if (existing) {
      return res.status(400).json({ 
        error: 'Service name already exists in this project',
        code: 'DUPLICATE_NAME'
      });
    }

    const stmt = db.prepare(`
      UPDATE services SET
        name = ?, description = ?, host = ?, port = ?, check_type = ?,
        http_config = ?, check_config = ?, risk_level = ?, layer = ?, check_interval = ?, warning_threshold = ?,
        error_threshold = ?, enabled = ?, alert_enabled = ?, dependencies = ?, project_id = ?,
        host_id = ?,
        impact_description = ?, custom_alert_template = ?,
        service_type = ?, ssh_config_id = ?, ssh_check_type = ?, ssh_check_config = ?,
        script_config = ?, process_config = ?, database_config = ?, file_config = ?,
        failure_threshold = ?,
        icon = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const info = stmt.run(
      name, description, host, port, check_type,
      http_config || null,
      check_config || null,
      risk_level, layer || null, check_interval, warning_threshold,
      error_threshold, enabled ? 1 : 0, alert_enabled ? 1 : 0,
      dependencies ? JSON.stringify(dependencies) : '[]',
      project_id || null,
      host_id || null,
      impact_description || null,
      custom_alert_template || null,
      service_type || 'http',
      ssh_config_id || null,
      ssh_check_type || null,
      ssh_check_config || null,
      script_config || null,
      process_config || null,
      database_config || null,
      file_config || null,
      failure_threshold || 3,
      icon || null,
      req.params.id
    );

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Reschedule the service
    const updatedService = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id) as any;
    Scheduler.restartService(updatedService);

    res.json({ message: 'Service updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete service
router.delete('/:id', (req, res) => {
  try {
    // Stop the service schedule
    Scheduler.stopService(req.params.id);

    // Bug Fix: Delete dependencies first to avoid RESTRICT constraint violation
    // Delete all dependencies where this service is source or target
    const deleteDepsStmt = db.prepare(`
      DELETE FROM service_dependencies 
      WHERE source_service_id = ? OR target_service_id = ?
    `);
    const depsInfo = deleteDepsStmt.run(req.params.id, req.params.id);
    
    if (depsInfo.changes > 0) {
      logger.info('Service', `Deleted ${depsInfo.changes} dependencies for service ${req.params.id}`);
    }

    // Now delete the service
    const stmt = db.prepare('DELETE FROM services WHERE id = ?');
    const info = stmt.run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ message: 'Service deleted', dependenciesDeleted: depsInfo.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch update services
router.patch('/batch', (req, res) => {
  try {
    const { serviceIds, updates } = req.body;
    
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ error: 'serviceIds must be a non-empty array' });
    }
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates must be an object' });
    }
    
    // Build dynamic UPDATE statement based on provided fields
    const allowedFields = ['check_interval', 'warning_threshold', 'error_threshold', 'failure_threshold', 'enabled', 'alert_enabled', 'risk_level'];
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }
    
    // If check_interval is being updated, update each service's schedule_config individually
    // to preserve their schedule_type (fixed or timeRange)
    if (updates.check_interval !== undefined) {
      const placeholders = serviceIds.map(() => '?').join(',');
      const services = db.prepare(`SELECT id, schedule_type, schedule_config FROM services WHERE id IN (${placeholders})`).all(...serviceIds) as any[];
      
      // Update each service individually to preserve schedule mode
      for (const service of services) {
        let scheduleConfig: any;
        
        if (service.schedule_type === 'timeRange' && service.schedule_config) {
          // Preserve timeRange mode and existing time rules
          try {
            const existingConfig = JSON.parse(service.schedule_config);
            scheduleConfig = {
              type: 'timeRange',
              defaultInterval: updates.check_interval,
              timeRanges: existingConfig.timeRanges || []
            };
          } catch (e) {
            // If parsing fails, create new timeRange config
            scheduleConfig = {
              type: 'timeRange',
              defaultInterval: updates.check_interval,
              timeRanges: []
            };
          }
        } else {
          // Fixed mode (or undefined, default to fixed)
          scheduleConfig = {
            type: 'fixed',
            defaultInterval: updates.check_interval,
            timeRanges: []
          };
        }
        
        // Update schedule_config for this service
        db.prepare('UPDATE services SET schedule_config = ? WHERE id = ?')
          .run(JSON.stringify(scheduleConfig), service.id);
      }
    }
    
    // Add updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Build WHERE clause
    const placeholders = serviceIds.map(() => '?').join(',');
    const sql = `UPDATE services SET ${updateFields.join(', ')} WHERE id IN (${placeholders})`;
    
    const stmt = db.prepare(sql);
    const result = stmt.run(...updateValues, ...serviceIds);
    
    // Restart scheduler for updated services
    const updatedServices = db.prepare(`SELECT * FROM services WHERE id IN (${placeholders})`).all(...serviceIds) as any[];
    updatedServices.forEach(service => {
      Scheduler.restartService(service);
    });
    
    res.json({
      success: true,
      updated: result.changes,
      message: `Successfully updated ${result.changes} service(s)`
    });
  } catch (error: any) {
    logger.api.error('Batch update error', { error });
    res.status(500).json({ error: error.message });
  }
});

export default router;
