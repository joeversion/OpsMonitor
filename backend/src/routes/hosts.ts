import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { validateHostUpdate } from '../middleware/validation';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { SSHService } from '../services/ssh-service';
import { HealthChecker } from '../services/health-checker';
import { Scheduler } from '../services/scheduler';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';

const execAsync = promisify(exec);

const router = Router();

router.use(authenticate);

// GET /api/hosts - 获取所有主机
router.get('/', (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    
    let query = `
      SELECT h.*, 
        COUNT(DISTINCT s.id) as service_count,
        p.name as project_name
      FROM hosts h
      LEFT JOIN services s ON s.host_id = h.id
      LEFT JOIN projects p ON h.project_id = p.id
    `;
    
    const params: any[] = [];
    
    if (project_id) {
      query += ' WHERE h.project_id = ?';
      params.push(project_id);
    }
    
    query += ' GROUP BY h.id ORDER BY h.created_at DESC';
    
    const hosts = db.prepare(query).all(...params);
    
    // 为每个主机获取状态
    const hostsWithDetails = hosts.map((host: any) => {
      // Parse tags if it's a JSON string
      if (host.tags) {
        try {
          host.tags = JSON.parse(host.tags);
        } catch (e) {
          host.tags = [];
        }
      }
      
      // Get aggregated health status from services
      // Note: disabled services (enabled=0) are counted as unknown regardless of check records
      const healthStats = db.prepare(`
        SELECT 
          COUNT(*) as total_services,
          SUM(CASE WHEN enabled = 1 AND last_status = 'down' THEN 1 ELSE 0 END) as down_count,
          SUM(CASE WHEN enabled = 1 AND last_status = 'warning' THEN 1 ELSE 0 END) as warning_count,
          SUM(CASE WHEN enabled = 1 AND last_status = 'up' THEN 1 ELSE 0 END) as up_count,
          SUM(CASE WHEN enabled = 0 OR last_status IS NULL OR last_status NOT IN ('up', 'down', 'warning') THEN 1 ELSE 0 END) as unknown_count
        FROM (
          SELECT 
            s.id,
            s.enabled,
            (SELECT cr.status 
             FROM check_records cr 
             WHERE cr.service_id = s.id 
             ORDER BY cr.checked_at DESC LIMIT 1) as last_status
          FROM services s
          WHERE s.host_id = ?
        )
      `).get(host.id) as any;
      
      // Determine overall host status
      let status = 'healthy';
      
      // 优先使用连接测试状态（如果最近测试过）
      if (host.last_test_at) {
        const testTime = new Date(host.last_test_at).getTime();
        const now = Date.now();
        const hoursSinceTest = (now - testTime) / (1000 * 60 * 60);
        
        // 如果测试时间在24小时内，使用测试结果
        if (hoursSinceTest < 24) {
          if (host.last_test_status === 'success') {
            // 连接成功，但还需要检查服务状态
            if (healthStats.total_services > 0) {
              if (healthStats.down_count > 0) {
                status = 'error';
              } else if (healthStats.warning_count > 0) {
                status = 'warning';
              } else {
                status = 'healthy';
              }
            } else {
              // 连接成功但没有服务
              status = 'healthy';
            }
          } else {
            // 连接失败
            status = 'error';
          }
        } else {
          // 测试时间超过24小时，使用服务状态判断
          if (healthStats.total_services > 0) {
            if (healthStats.down_count > 0) {
              status = 'error';
            } else if (healthStats.warning_count > 0) {
              status = 'warning';
            } else if (healthStats.up_count > 0) {
              status = 'healthy';
            } else {
              status = 'warning';
            }
          } else {
            // 没有服务且测试过期
            status = 'warning';
          }
        }
      } else {
        // 没有测试记录，使用服务状态判断
        if (healthStats.total_services > 0) {
          if (healthStats.down_count > 0) {
            status = 'error';
          } else if (healthStats.warning_count > 0) {
            status = 'warning';
          } else if (healthStats.up_count > 0) {
            status = 'healthy';
          } else {
            status = 'warning';
          }
        } else {
          // 没有服务且未测试
          status = 'warning';
        }
      }
      
      return {
        ...host,
        status,
        health_stats: healthStats
      };
    });
    
    res.json(hostsWithDetails);
  } catch (error: any) {
    logger.api.error('Error fetching hosts', { error });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/hosts/:id/impact - 获取主机修改影响分析
router.get('/:id/impact', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_project_id, new_connection_type } = req.query;
    
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const impact = {
      host_id: id,
      host_name: host.name,
      changes: [] as any[],
      warnings: [] as any[],
      affected_services: [] as any[]
    };
    
    // 检查关联的服务
    const services = db.prepare(`
      SELECT id, name, service_type, project_id
      FROM services 
      WHERE host_id = ?
    `).all(id) as any[];
    
    impact.affected_services = services.map(s => ({
      id: s.id,
      name: s.name,
      type: s.service_type,
      project_id: s.project_id
    }));
    
    // 检查项目变更影响
    if (new_project_id !== undefined && new_project_id !== host.project_id) {
      const projectChangeCount = services.length;
      
      impact.changes.push({
        type: 'PROJECT_CHANGE',
        description: `主机项目将从 "${host.project_id || '未分配'}" 变更为 "${new_project_id || '未分配'}"`,
        affected_count: projectChangeCount,
        auto_sync: true,
        details: `${projectChangeCount} 个服务的项目归属将自动同步更新`
      });
      
      if (projectChangeCount > 0) {
        impact.warnings.push({
          level: 'info',
          message: `此操作将自动更新 ${projectChangeCount} 个服务的项目归属`,
          severity: 'medium'
        });
      }
    }
    
    // 检查连接类型变更影响
    if (new_connection_type && new_connection_type !== host.connection_type) {
      const sshServices = services.filter(s => s.service_type === 'ssh');
      
      if (new_connection_type !== 'ssh' && sshServices.length > 0) {
        impact.warnings.push({
          level: 'warning',
          message: `主机连接类型将变更为 "${new_connection_type}"，但有 ${sshServices.length} 个 SSH 类型的服务依赖此主机`,
          severity: 'high',
          affected_services: sshServices.map(s => ({ id: s.id, name: s.name }))
        });
        
        impact.changes.push({
          type: 'CONNECTION_TYPE_INCOMPATIBILITY',
          description: 'SSH 服务与新连接类型不兼容',
          affected_count: sshServices.length,
          requires_action: true
        });
      }
      
      impact.changes.push({
        type: 'CONNECTION_CONFIG_CHANGE',
        description: `主机连接类型将变更为 "${new_connection_type}"`,
        affected_count: services.length,
        details: `${services.length} 个服务的连接方式可能受影响`
      });
    }
    
    // SSH 配置变更检测（基于请求体）
    const sshServices = services.filter(s => s.service_type === 'ssh');
    if (sshServices.length > 0) {
      impact.warnings.push({
        level: 'info',
        message: `此主机有 ${sshServices.length} 个 SSH 服务，修改 SSH 配置可能影响监控`,
        severity: 'medium',
        affected_services: sshServices.map(s => ({ id: s.id, name: s.name }))
      });
    }
    
    res.json(impact);
  } catch (error: any) {
    logger.api.error('Error fetching host impact', { hostId: req.params.id, error });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/hosts/:id - 获取单个主机详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const host = db.prepare(`
      SELECT h.*, 
        p.name as project_name,
        COUNT(DISTINCT s.id) as service_count
      FROM hosts h
      LEFT JOIN projects p ON h.project_id = p.id
      LEFT JOIN services s ON s.host_id = h.id
      WHERE h.id = ?
      GROUP BY h.id
    `).get(id) as any;
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Parse tags if it's a JSON string
    if (host.tags) {
      try {
        host.tags = JSON.parse(host.tags);
      } catch (e) {
        host.tags = [];
      }
    }
    
    // 获取该主机上的所有服务及其最新状态
    const services = db.prepare(`
      SELECT s.*, 
        (SELECT status FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as last_status,
        (SELECT checked_at FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as last_checked
      FROM services s
      WHERE s.host_id = ?
      ORDER BY s.name
    `).all(id);
    
    host.services = services;
    
    // 计算健康统计（与列表接口保持一致）
    // Note: disabled services (enabled=0) are counted as unknown regardless of check records
    const healthStats = db.prepare(`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN enabled = 1 AND last_status = 'down' THEN 1 ELSE 0 END) as down_count,
        SUM(CASE WHEN enabled = 1 AND last_status = 'warning' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN enabled = 1 AND last_status = 'up' THEN 1 ELSE 0 END) as up_count,
        SUM(CASE WHEN enabled = 0 OR last_status IS NULL OR last_status NOT IN ('up', 'down', 'warning') THEN 1 ELSE 0 END) as unknown_count
      FROM (
        SELECT 
          s.id,
          s.enabled,
          (SELECT cr.status 
           FROM check_records cr 
           WHERE cr.service_id = s.id 
           ORDER BY cr.checked_at DESC LIMIT 1) as last_status
        FROM services s
        WHERE s.host_id = ?
      )
    `).get(id) as any;
    
    host.health_stats = healthStats;
    
    // 计算主机状态（与列表接口保持一致）
    let status = 'healthy';
    
    // 优先使用连接测试状态（如果最近测试过）
    if (host.last_test_at) {
      const testTime = new Date(host.last_test_at).getTime();
      const now = Date.now();
      const hoursSinceTest = (now - testTime) / (1000 * 60 * 60);
      
      // 如果测试时间在24小时内，使用测试结果
      if (hoursSinceTest < 24) {
        if (host.last_test_status === 'success') {
          // 连接成功，但还需要检查服务状态
          if (healthStats.total_services > 0) {
            if (healthStats.down_count > 0) {
              status = 'error';
            } else if (healthStats.warning_count > 0) {
              status = 'warning';
            } else {
              status = 'healthy';
            }
          } else {
            // 连接成功但没有服务
            status = 'healthy';
          }
        } else {
          // 连接失败
          status = 'error';
        }
      } else {
        // 测试时间超过24小时，使用服务状态判断
        if (healthStats.total_services > 0) {
          if (healthStats.down_count > 0) {
            status = 'error';
          } else if (healthStats.warning_count > 0) {
            status = 'warning';
          } else if (healthStats.up_count > 0) {
            status = 'healthy';
          }
        }
      }
    } else {
      // 没有测试记录，使用服务状态判断
      if (healthStats.total_services > 0) {
        if (healthStats.down_count > 0) {
          status = 'error';
        } else if (healthStats.warning_count > 0) {
          status = 'warning';
        } else if (healthStats.up_count > 0) {
          status = 'healthy';
        }
      }
    }
    
    host.status = status;
    
    res.json(host);
  } catch (error: any) {
    logger.api.error('Error fetching host', { hostId: req.params.id, error });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/hosts - 创建新主机
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      name,
      ip,
      project_id,
      connection_type,
      ssh_host,
      ssh_port = 22,
      ssh_username,
      ssh_auth_type,
      ssh_password,
      ssh_private_key,
      ssh_passphrase,
      ssh_proxy_host,
      ssh_proxy_port,
      ssh_max_retries,
      ssh_retry_delay,
      ssh_connection_timeout,
      ssh_command_timeout,
      check_interval,
      description,
      tags
    } = req.body;
    
    if (!name || !ip) {
      return res.status(400).json({ error: 'Name and IP are required' });
    }
    
    // 如果选择SSH连接，使用ip作为ssh_host（如果ssh_host未提供）
    // Bug #015: 当connection_type不为ssh时，清空所有SSH字段
    const effectiveSshHost = connection_type === 'ssh' ? (ssh_host || ip) : null;
    const effectiveSshPort = connection_type === 'ssh' ? (ssh_port || 22) : null;
    const effectiveSshUsername = connection_type === 'ssh' ? ssh_username : null;
    const effectiveSshAuthType = connection_type === 'ssh' ? ssh_auth_type : null;
    const effectiveSshPassword = connection_type === 'ssh' ? ssh_password : null;
    const effectiveSshPrivateKey = connection_type === 'ssh' ? ssh_private_key : null;
    const effectiveSshPassphrase = connection_type === 'ssh' ? ssh_passphrase : null;
    const effectiveSshProxyHost = connection_type === 'ssh' ? ssh_proxy_host : null;
    const effectiveSshProxyPort = connection_type === 'ssh' ? ssh_proxy_port : null;
    const effectiveSshMaxRetries = connection_type === 'ssh' ? (ssh_max_retries || 3) : null;
    const effectiveSshRetryDelay = connection_type === 'ssh' ? (ssh_retry_delay || 2000) : null;
    const effectiveSshConnectionTimeout = connection_type === 'ssh' ? (ssh_connection_timeout || 10000) : null;
    const effectiveSshCommandTimeout = connection_type === 'ssh' ? (ssh_command_timeout || 30000) : null;
    
    const id = uuidv4();
    const now = new Date().toISOString();
    const tagsJson = tags ? JSON.stringify(tags) : null;
    
    const stmt = db.prepare(`
      INSERT INTO hosts (
        id, name, ip, project_id, connection_type,
        ssh_host, ssh_port, ssh_username, ssh_auth_type,
        ssh_password, ssh_private_key, ssh_passphrase,
        ssh_proxy_host, ssh_proxy_port,
        ssh_max_retries, ssh_retry_delay, ssh_connection_timeout, ssh_command_timeout,
        check_interval,
        description, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, name, ip, project_id || null, connection_type || null,
      effectiveSshHost, effectiveSshPort, effectiveSshUsername, effectiveSshAuthType,
      effectiveSshPassword, effectiveSshPrivateKey, effectiveSshPassphrase,
      effectiveSshProxyHost, effectiveSshProxyPort,
      effectiveSshMaxRetries, effectiveSshRetryDelay, effectiveSshConnectionTimeout, effectiveSshCommandTimeout,
      check_interval || 300,
      description || null, tagsJson, now, now
    );
    
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (host.tags) {
      try {
        host.tags = JSON.parse(host.tags);
      } catch (e) {
        host.tags = [];
      }
    }
    res.status(201).json(host);
  } catch (error: any) {
    logger.api.error('Error creating host', { name: req.body.name, error });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/hosts/:id - 更新主机
router.put('/:id', validateHostUpdate, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      ip,
      project_id,
      connection_type,
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_auth_type,
      ssh_password,
      ssh_private_key,
      ssh_passphrase,
      ssh_proxy_host,
      ssh_proxy_port,
      ssh_max_retries,
      ssh_retry_delay,
      ssh_connection_timeout,
      ssh_command_timeout,
      check_interval,
      description,
      tags
    } = req.body;
    
    // 检查主机是否存在
    const existing = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // 检查项目是否变更
    const projectChanged = project_id !== existing.project_id;
    // Bug #016: 检查 IP 是否变更，需要同步更新 services 的 host 字段
    const ipChanged = ip !== existing.ip;
    let syncInfo = null;
    
    // 查询受影响的服务数量
    const serviceCount = db.prepare(
      'SELECT COUNT(*) as count FROM services WHERE host_id = ?'
    ).get(id) as any;
    
    if (projectChanged || ipChanged) {
      if (serviceCount.count > 0) {
        const changes = [];
        if (projectChanged) {
          changes.push(`项目从 ${existing.project_id} 变更为 ${project_id}`);
        }
        if (ipChanged) {
          changes.push(`IP 从 ${existing.ip} 变更为 ${ip}`);
        }
        syncInfo = {
          action: 'service_sync',
          old_project_id: projectChanged ? existing.project_id : undefined,
          new_project_id: projectChanged ? project_id : undefined,
          old_ip: ipChanged ? existing.ip : undefined,
          new_ip: ipChanged ? ip : undefined,
          affected_service_count: serviceCount.count,
          message: `主机信息变更将自动同步更新 ${serviceCount.count} 个服务：${changes.join('，')}`
        };
      }
    }
    
    // 如果选择SSH连接，使用ip作为ssh_host（如果ssh_host未提供）
    // Bug #015: 当connection_type不为ssh时，清空所有SSH字段
    const effectiveSshHost = connection_type === 'ssh' ? (ssh_host || ip) : null;
    const effectiveSshPort = connection_type === 'ssh' ? (ssh_port || 22) : null;
    const effectiveSshUsername = connection_type === 'ssh' ? ssh_username : null;
    const effectiveSshAuthType = connection_type === 'ssh' ? ssh_auth_type : null;
    const effectiveSshPassword = connection_type === 'ssh' ? ssh_password : null;
    const effectiveSshPrivateKey = connection_type === 'ssh' ? ssh_private_key : null;
    const effectiveSshPassphrase = connection_type === 'ssh' ? ssh_passphrase : null;
    const effectiveSshProxyHost = connection_type === 'ssh' ? ssh_proxy_host : null;
    const effectiveSshProxyPort = connection_type === 'ssh' ? ssh_proxy_port : null;
    const effectiveSshMaxRetries = connection_type === 'ssh' ? (ssh_max_retries || 3) : null;
    const effectiveSshRetryDelay = connection_type === 'ssh' ? (ssh_retry_delay || 2000) : null;
    const effectiveSshConnectionTimeout = connection_type === 'ssh' ? (ssh_connection_timeout || 10000) : null;
    const effectiveSshCommandTimeout = connection_type === 'ssh' ? (ssh_command_timeout || 30000) : null;
    
    const now = new Date().toISOString();
    const tagsJson = tags ? JSON.stringify(tags) : null;
    
    // 执行更新（触发器会自动同步服务的 project_id）
    const stmt = db.prepare(`
      UPDATE hosts 
      SET name = ?, ip = ?, project_id = ?, connection_type = ?,
          ssh_host = ?, ssh_port = ?, ssh_username = ?, ssh_auth_type = ?,
          ssh_password = ?, ssh_private_key = ?, ssh_passphrase = ?,
          ssh_proxy_host = ?, ssh_proxy_port = ?,
          ssh_max_retries = ?, ssh_retry_delay = ?, ssh_connection_timeout = ?, ssh_command_timeout = ?,
          check_interval = ?,
          description = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `);
    
    stmt.run(
      name, ip, project_id || null, connection_type || null,
      effectiveSshHost, effectiveSshPort, effectiveSshUsername, effectiveSshAuthType,
      effectiveSshPassword, effectiveSshPrivateKey, effectiveSshPassphrase,
      effectiveSshProxyHost, effectiveSshProxyPort,
      effectiveSshMaxRetries, effectiveSshRetryDelay, effectiveSshConnectionTimeout, effectiveSshCommandTimeout,
      check_interval || 300,
      description || null, tagsJson, now, id
    );
    
    // Bug #016: 同步更新 services 的 host 字段（当 IP 变更时）
    if (ipChanged && serviceCount.count > 0) {
      const updateServicesStmt = db.prepare(`
        UPDATE services 
        SET host = ?, updated_at = ?
        WHERE host_id = ? AND host = ?
      `);
      const result = updateServicesStmt.run(ip, now, id, existing.ip);
      logger.api.info('Synced services host field', { 
        hostId: id, 
        oldIp: existing.ip, 
        newIp: ip, 
        affectedServices: result.changes 
      });
    }
    
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (host.tags) {
      try {
        host.tags = JSON.parse(host.tags);
      } catch (e) {
        host.tags = [];
      }
    }
    
    // Bug #014: 自动测试连接（在后台异步执行，不阻塞响应）
    testConnectionAfterUpdate(host).catch(err => {
      logger.ssh.warn('Auto connection test failed', { hostName: host.name, error: err });
    });
    
    // Restart host check interval if check_interval changed
    Scheduler.restartSingleHostCheck(id);
    
    // 返回结果，包含同步信息和验证警告
    res.json({
      ...host,
      sync_info: syncInfo,
      warnings: (req as any).validationWarnings
    });
  } catch (error: any) {
    logger.api.error('Error updating host', { hostId: req.params.id, error });
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/hosts/:id/toggle-enabled - 切换主机监控状态 (Spec 027)
router.patch('/:id/toggle-enabled', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    // 验证enabled值
    if (enabled !== 0 && enabled !== 1) {
      return res.status(400).json({ error: 'enabled must be 0 or 1' });
    }
    
    // 检查主机是否存在
    const existing = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // 更新enabled状态
    db.prepare('UPDATE hosts SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled, new Date().toISOString(), id);
    
    // 重启或停止调度
    if (enabled === 1) {
      Scheduler.restartSingleHostCheck(id);
      logger.api.info(`Host monitoring enabled`, { hostId: id, hostName: existing.name });
    } else {
      Scheduler.stopSingleHostCheck(id);
      logger.api.info(`Host monitoring disabled`, { hostId: id, hostName: existing.name });
    }
    
    // 返回更新后的主机信息
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (host.tags) {
      try {
        host.tags = JSON.parse(host.tags);
      } catch (e) {
        host.tags = [];
      }
    }
    
    res.json(host);
  } catch (error: any) {
    logger.api.error('Error toggling host monitoring', { hostId: req.params.id, error });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/hosts/:id - 删除主机（增强版）
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force, reassign_to, orphan } = req.query;
    
    // 检查是否有服务依赖此主机
    const services = db.prepare(
      'SELECT id, name, service_type FROM services WHERE host_id = ?'
    ).all(id) as any[];
    
    if (services.length > 0) {
      // 选项1: 强制删除并重新分配服务到其他主机
      if (reassign_to) {
        const targetHost = db.prepare('SELECT id FROM hosts WHERE id = ?').get(reassign_to as string);
        if (!targetHost) {
          return res.status(400).json({ 
            error: 'Target host for reassignment not found' 
          });
        }
        
        // 重新分配所有服务
        db.prepare('UPDATE services SET host_id = ?, updated_at = CURRENT_TIMESTAMP WHERE host_id = ?')
          .run(reassign_to, id);
        
        // 删除主机
        db.prepare('DELETE FROM hosts WHERE id = ?').run(id);
        
        return res.json({ 
          message: 'Host deleted successfully',
          reassigned_services: services.length,
          target_host: reassign_to
        });
      }
      
      // 选项2: 将服务变为孤儿服务（不关联主机）
      if (orphan === 'true') {
        db.prepare('UPDATE services SET host_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE host_id = ?')
          .run(id);
        
        // 删除主机
        db.prepare('DELETE FROM hosts WHERE id = ?').run(id);
        
        return res.json({ 
          message: 'Host deleted successfully',
          orphaned_services: services.length
        });
      }
      
      // 选项3: 强制删除（删除主机及其所有服务）
      if (force === 'true') {
        // 先删除服务
        db.prepare('DELETE FROM services WHERE host_id = ?').run(id);
        // 再删除主机
        db.prepare('DELETE FROM hosts WHERE id = ?').run(id);
        
        return res.json({ 
          message: 'Host and all services deleted successfully',
          deleted_services: services.length
        });
      }
      
      // 默认：阻止删除，返回详细信息
      return res.status(400).json({ 
        error: `Cannot delete host with ${services.length} active service(s)`,
        services: services.map(s => ({ id: s.id, name: s.name, type: s.service_type })),
        options: {
          reassign: 'Add ?reassign_to=<host_id> to reassign services to another host',
          orphan: 'Add ?orphan=true to remove host association from services',
          force: 'Add ?force=true to delete host and all its services (DANGEROUS)'
        }
      });
    }
    
    // 没有服务依赖，直接删除
    const result = db.prepare('DELETE FROM hosts WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    res.json({ message: 'Host deleted successfully' });
  } catch (error: any) {
    logger.api.error('Error deleting host', { hostId: req.params.id, error });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/hosts/:id/reassign-services - 批量重新分配服务
router.post('/:id/reassign-services', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { target_host_id, service_ids } = req.body;
    
    if (!target_host_id) {
      return res.status(400).json({ error: 'target_host_id is required' });
    }
    
    // 验证目标主机存在
    const targetHost = db.prepare('SELECT * FROM hosts WHERE id = ?').get(target_host_id) as any;
    if (!targetHost) {
      return res.status(404).json({ error: 'Target host not found' });
    }
    
    // 验证源主机存在
    const sourceHost = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (!sourceHost) {
      return res.status(404).json({ error: 'Source host not found' });
    }
    
    let affectedServices;
    
    if (service_ids && Array.isArray(service_ids) && service_ids.length > 0) {
      // 重新分配指定的服务
      const placeholders = service_ids.map(() => '?').join(',');
      const stmt = db.prepare(`
        UPDATE services 
        SET host_id = ?, 
            project_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders}) AND host_id = ?
      `);
      
      const result = stmt.run(target_host_id, targetHost.project_id, ...service_ids, id);
      affectedServices = result.changes;
    } else {
      // 重新分配所有服务
      const stmt = db.prepare(`
        UPDATE services 
        SET host_id = ?, 
            project_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE host_id = ?
      `);
      
      const result = stmt.run(target_host_id, targetHost.project_id, id);
      affectedServices = result.changes;
    }
    
    res.json({
      message: 'Services reassigned successfully',
      source_host: { id: sourceHost.id, name: sourceHost.name },
      target_host: { id: targetHost.id, name: targetHost.name },
      affected_services: affectedServices
    });
  } catch (error: any) {
    logger.api.error('Error reassigning services', { error });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/hosts/test-all - 测试所有主机连接
router.post('/test-all', async (req: Request, res: Response) => {
  try {
    const hosts = db.prepare('SELECT * FROM hosts').all() as any[];
    const results = [];
    
    for (const host of hosts) {
      try {
        if (host.connection_type === 'ssh') {
          // SSH 测试逻辑
          const { SSHService } = await import('../services/ssh-service');
          
          const credentials: any = {
            host: host.ssh_host || host.ip,
            port: host.ssh_port || 22,
            username: host.ssh_username,
            auth_type: host.ssh_auth_type
          };
          
          if (host.ssh_auth_type === 'password') {
            credentials.credential = host.ssh_password;
          } else if (host.ssh_auth_type === 'private_key') {
            credentials.credential = host.ssh_private_key;
            if (host.ssh_passphrase) {
              credentials.passphrase = host.ssh_passphrase;
            }
          }
          
          if (host.ssh_proxy_host) {
            credentials.proxy_host = host.ssh_proxy_host;
            credentials.proxy_port = host.ssh_proxy_port || 22;
            
            // 查找代理主机的SSH认证信息
            const proxyHost = db.prepare(
              'SELECT * FROM hosts WHERE connection_type = \'ssh\' AND (ssh_host = ? OR ip = ?)'
            ).get(host.ssh_proxy_host, host.ssh_proxy_host) as any;
            
            if (proxyHost) {
              credentials.proxy_username = proxyHost.ssh_username;
              credentials.proxy_auth_type = proxyHost.ssh_auth_type;
              
              if (proxyHost.ssh_auth_type === 'password') {
                credentials.proxy_credential = proxyHost.ssh_password;
              } else if (proxyHost.ssh_auth_type === 'private_key') {
                credentials.proxy_credential = proxyHost.ssh_private_key;
              }
            } else {
              // Fallback: 使用目标服务器的认证信息
              credentials.proxy_username = host.ssh_username;
              credentials.proxy_auth_type = host.ssh_auth_type;
              credentials.proxy_credential = credentials.credential;
            }
          }
          
          // Add host-level SSH settings
          if (host.ssh_max_retries) credentials.max_retries = host.ssh_max_retries;
          if (host.ssh_retry_delay) credentials.retry_delay = host.ssh_retry_delay;
          if (host.ssh_connection_timeout) credentials.connection_timeout = host.ssh_connection_timeout;
          if (host.ssh_command_timeout) credentials.command_timeout = host.ssh_command_timeout;
          
          const result = await SSHService.testConnection(credentials);
          
          db.prepare(`
            UPDATE hosts 
            SET last_test_status = ?,
                last_test_at = ?,
                last_test_message = ?,
                last_test_latency = ?
            WHERE id = ?
          `).run(
            result.success ? 'success' : 'failed',
            new Date().toISOString(),
            result.message,
            result.latency || null,
            host.id
          );
          
          results.push({
            host_id: host.id,
            host_name: host.name,
            success: result.success,
            message: result.message
          });
        } else if (host.connection_type === 'local') {
          // Ping 测试逻辑
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const startTime = Date.now();
          const isWindows = process.platform === 'win32';
          const pingCommand = isWindows 
            ? `ping -n 1 -w 2000 ${host.ip}` 
            : `ping -c 1 -W 2 ${host.ip}`;
          
          try {
            await execAsync(pingCommand);
            const latency = Date.now() - startTime;
            
            db.prepare(`
              UPDATE hosts 
              SET last_test_status = ?,
                  last_test_at = ?,
                  last_test_message = ?,
                  last_test_latency = ?
              WHERE id = ?
            `).run(
              'success',
              new Date().toISOString(),
              `Host ${host.ip} is reachable`,
              latency,
              host.id
            );
            
            results.push({
              host_id: host.id,
              host_name: host.name,
              success: true,
              message: `Host ${host.ip} is reachable`
            });
          } catch (error: any) {
            const latency = Date.now() - startTime;
            
            db.prepare(`
              UPDATE hosts 
              SET last_test_status = ?,
                  last_test_at = ?,
                  last_test_message = ?,
                  last_test_latency = ?
              WHERE id = ?
            `).run(
              'failed',
              new Date().toISOString(),
              `Host ${host.ip} is unreachable`,
              latency,
              host.id
            );
            
            results.push({
              host_id: host.id,
              host_name: host.name,
              success: false,
              message: `Host ${host.ip} is unreachable`
            });
          }
        }
      } catch (error: any) {
        logger.ssh.error('Error testing host', { hostName: host.name, error });
        results.push({
          host_id: host.id,
          host_name: host.name,
          success: false,
          message: error.message
        });
      }
    }
    
    res.json({
      success: true,
      total: hosts.length,
      results
    });
  } catch (error: any) {
    logger.api.error('Error testing all hosts', { error });
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// POST /api/hosts/:id/test - 测试主机连接
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const configOverride = req.body || {};
    
    const dbHost = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    
    if (!dbHost) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // 合并配置：优先使用请求body中的值（用于测试未保存的配置），回退到数据库值
    const host = {
      ...dbHost,
      ...configOverride,
      id: dbHost.id, // 保持ID不变
      project_id: dbHost.project_id // 保持项目ID不变
    };
    
    // Handle SSH connection test
    if (host.connection_type === 'ssh') {
      if (!host.ssh_host || !host.ssh_username) {
        return res.status(400).json({ error: 'SSH configuration not complete (missing host or username)' });
      }
      
      // Import SSH service
      const { SSHService } = await import('../services/ssh-service');
      
      // Prepare SSH credentials using SSHService interface
      const credentials: any = {
        host: host.ssh_host,
        port: host.ssh_port || 22,
        username: host.ssh_username,
        auth_type: host.ssh_auth_type
      };
      
      // Add authentication credential
      if (host.ssh_auth_type === 'password') {
        if (!host.ssh_password) {
          return res.status(400).json({ error: 'SSH password not configured' });
        }
        credentials.credential = host.ssh_password;
      } else if (host.ssh_auth_type === 'private_key') {
        if (!host.ssh_private_key) {
          return res.status(400).json({ error: 'SSH private key not configured' });
        }
        credentials.credential = host.ssh_private_key;
        if (host.ssh_passphrase) {
          credentials.passphrase = host.ssh_passphrase;
        }
      } else {
        return res.status(400).json({ error: 'SSH authentication type not configured' });
      }
      
      // Add proxy if configured
      if (host.ssh_proxy_host) {
        credentials.proxy_host = host.ssh_proxy_host;
        credentials.proxy_port = host.ssh_proxy_port || 22;
        
        // 查找代理主机的SSH认证信息
        const proxyHost = db.prepare(
          'SELECT * FROM hosts WHERE connection_type = \'ssh\' AND (ssh_host = ? OR ip = ?)'
        ).get(host.ssh_proxy_host, host.ssh_proxy_host) as any;
        
        if (proxyHost) {
          logger.ssh.debug('Using SSH proxy host', { proxyName: proxyHost.name, proxyAddress: proxyHost.ssh_host || proxyHost.ip });
          credentials.proxy_username = proxyHost.ssh_username;
          credentials.proxy_auth_type = proxyHost.ssh_auth_type;
          
          if (proxyHost.ssh_auth_type === 'password') {
            credentials.proxy_credential = proxyHost.ssh_password;
          } else if (proxyHost.ssh_auth_type === 'private_key') {
            credentials.proxy_credential = proxyHost.ssh_private_key;
            // 注意：passphrase 会被复用，如果代理和目标使用不同的passphrase需要扩展schema
          }
        } else {
          console.warn(`[SSH Proxy] Proxy host ${host.ssh_proxy_host} not found in database, using target credentials (may fail)`);
          // Fallback: 使用目标服务器的认证信息（旧行为，可能失败）
          credentials.proxy_username = host.ssh_username;
          credentials.proxy_auth_type = host.ssh_auth_type;
          credentials.proxy_credential = credentials.credential;
        }
      }
      
      // Add host-level SSH settings
      if (host.ssh_max_retries) credentials.max_retries = host.ssh_max_retries;
      if (host.ssh_retry_delay) credentials.retry_delay = host.ssh_retry_delay;
      if (host.ssh_connection_timeout) credentials.connection_timeout = host.ssh_connection_timeout;
      if (host.ssh_command_timeout) credentials.command_timeout = host.ssh_command_timeout;
      
      // Test SSH connection
      const result = await SSHService.testConnection(credentials);
      
      // 保存测试结果
      db.prepare(`
        UPDATE hosts 
        SET last_test_status = ?,
            last_test_at = ?,
            last_test_message = ?,
            last_test_latency = ?
        WHERE id = ?
      `).run(
        result.success ? 'success' : 'failed',
        new Date().toISOString(),
        result.message,
        result.latency || null,
        id
      );
      
      res.json(result);
    } 
    // Handle Local (Ping) connection test
    else if (host.connection_type === 'local') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Bug #031: Validate IP/hostname to prevent shell command injection
      if (!host.ip || !/^[a-zA-Z0-9.\-]+$/.test(host.ip)) {
        return res.status(400).json({ success: false, message: 'Invalid host IP address format' });
      }

      const startTime = Date.now();
      const isWindows = process.platform === 'win32';
      // Windows: ping -n 1, Unix: ping -c 1
      const pingCommand = isWindows 
        ? `ping -n 1 -w 2000 ${host.ip}` 
        : `ping -c 1 -W 2 ${host.ip}`;
      
      let testResult: { success: boolean; message: string; latency: number; method?: string } | null = null;
      
      try {
        await execAsync(pingCommand);
        const latency = Date.now() - startTime;
        testResult = {
          success: true,
          message: `Host ${host.ip} is reachable`,
          latency,
          method: 'ping'
        };
      } catch (pingError: any) {
        const latency = Date.now() - startTime;
        testResult = {
          success: false,
          message: `Host ${host.ip} is unreachable`,
          latency,
          method: 'ping'
        };
      }
      
      // Save test result
      if (testResult) {
        logger.database.debug('Saving test result', { hostId: id, ip: host.ip, result: testResult });
        try {
          const updateResult = db.prepare(`
            UPDATE hosts 
            SET last_test_status = ?,
                last_test_at = ?,
                last_test_message = ?,
                last_test_latency = ?
            WHERE id = ?
          `).run(
            testResult.success ? 'success' : 'failed',
            new Date().toISOString(),
            testResult.message,
            testResult.latency,
            id
          );
          logger.database.debug('Update result changes', { changes: updateResult.changes });
        } catch (dbError: any) {
          logger.database.error('Failed to save test result', { error: dbError.message });
        }
        
        res.json(testResult);
      }
    } 
    else {
      return res.status(400).json({ error: 'Connection type not supported for testing' });
    }
  } catch (error: any) {
    logger.api.error('Error testing host connection', { hostId: req.params.id, error });
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
});

/**
 * Bug #014: 自动测试连接函数（在Host更新后异步调用）
 * 支持SSH和Ping两种连接类型
 */
async function testConnectionAfterUpdate(host: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    if (host.connection_type === 'ssh') {
      // SSH连接测试
      const sshHost = host.ssh_host || host.ip;
      const credential = host.ssh_auth_type === 'password' 
        ? host.ssh_password 
        : host.ssh_private_key;
      
      if (!credential) {
        console.warn(`[Host Update] No SSH credential for ${host.name}, skipping auto test`);
        return;
      }
      
      const result = await SSHService.testConnection({
        host: sshHost,
        port: host.ssh_port || 22,
        username: host.ssh_username,
        auth_type: host.ssh_auth_type,
        credential: credential,
        passphrase: host.ssh_passphrase,
        proxy_host: host.ssh_proxy_host,
        proxy_port: host.ssh_proxy_port,
        // Host-level SSH settings
        max_retries: host.ssh_max_retries,
        retry_delay: host.ssh_retry_delay,
        connection_timeout: host.ssh_connection_timeout,
        command_timeout: host.ssh_command_timeout,
        // 查找代理主机的SSH认证信息
        ...(host.ssh_proxy_host ? (() => {
          const proxyHost = db.prepare(
            'SELECT * FROM hosts WHERE connection_type = \'ssh\' AND (ssh_host = ? OR ip = ?)'
          ).get(host.ssh_proxy_host, host.ssh_proxy_host) as any;
          
          if (proxyHost) {
            return {
              proxy_username: proxyHost.ssh_username,
              proxy_auth_type: proxyHost.ssh_auth_type,
              proxy_credential: proxyHost.ssh_auth_type === 'password' 
                ? proxyHost.ssh_password 
                : proxyHost.ssh_private_key
            };
          }
          return {};
        })() : {})
      });
      
      // 更新测试结果
      const status = result.success ? 'success' : 'failed';
      db.prepare(`
        UPDATE hosts 
        SET last_test_status = ?,
            last_test_at = ?,
            last_test_message = ?,
            last_test_latency = ?
        WHERE id = ?
      `).run(
        status,
        new Date().toISOString(),
        result.message,
        result.latency || 0,
        host.id
      );
      
      console.log(`[Host Update] Auto SSH test for ${host.name}: ${status}`);
      
    } else if (host.connection_type === 'local') {
      // Local类型：仅使用Ping测试（与Test ping API逻辑保持一致）
      let testResult: { success: boolean; message: string; latency: number; method?: string } | null = null;
      
      try {
        const isWindows = process.platform === 'win32';
        const pingCmd = isWindows 
          ? `ping -n 1 -w 2000 ${host.ip}` 
          : `ping -c 1 -W 2 ${host.ip}`;
        
        await execAsync(pingCmd);
        const latency = Date.now() - startTime;
        
        testResult = {
          success: true,
          message: `Host ${host.ip} is reachable`,
          latency,
          method: 'ping'
        };
      } catch (pingError: any) {
        const latency = Date.now() - startTime;
        testResult = {
          success: false,
          message: `Host ${host.ip} is unreachable`,
          latency,
          method: 'ping'
        };
      }
      
      // 保存测试结果
      if (testResult) {
        db.prepare(`
          UPDATE hosts 
          SET last_test_status = ?,
              last_test_at = ?,
              last_test_message = ?,
              last_test_latency = ?
          WHERE id = ?
        `).run(
          testResult.success ? 'success' : 'failed',
          new Date().toISOString(),
          testResult.message,
          testResult.latency,
          host.id
        );
        
        console.log(`[Host Update] Auto test for ${host.name}: ${testResult.success ? 'success' : 'failed'} (${testResult.method})`);
      }
    } else {
      console.log(`[Host Update] Connection type ${host.connection_type} not supported for auto test`);
    }
  } catch (error: any) {
    console.error(`[Host Update] Auto connection test error for ${host.name}:`, error.message);
  }
  
  // 如果连接测试成功，立即触发该主机所有服务的健康检查
  try {
    const finalHost = db.prepare('SELECT last_test_status FROM hosts WHERE id = ?').get(host.id) as any;
    
    if (finalHost?.last_test_status === 'success') {
      console.log(`[Host Update] Connection test successful, triggering service checks for ${host.name}`);
      
      // 获取该主机的所有服务（包含完整配置）
      const services = db.prepare(`
        SELECT s.*, 
               h.connection_type as host_connection_type,
               h.ssh_host as host_ssh_host,
               h.ssh_port as host_ssh_port,
               h.ssh_username as host_ssh_username,
               h.ssh_auth_type as host_ssh_auth_type,
               h.ssh_password as host_ssh_password,
               h.ssh_private_key as host_ssh_private_key,
               h.ssh_passphrase as host_ssh_passphrase,
               h.ssh_proxy_host as host_ssh_proxy_host,
               h.ssh_proxy_port as host_ssh_proxy_port
        FROM services s
        LEFT JOIN hosts h ON s.host_id = h.id
        WHERE s.host_id = ?
      `).all(host.id) as any[];
      
      if (services.length > 0) {
        console.log(`[Host Update] Found ${services.length} services to check`);
        
        // 异步触发所有服务的健康检查
        (async () => {
          for (const service of services) {
            try {
              const result = await HealthChecker.check(service);
              
              // 直接记录检查结果到check_records表（不需要更新services表）
              const status = result.status === 'up' ? 'UP' : 
                           result.status === 'warning' ? 'WARNING' : 'DOWN';
              
              db.prepare(`
                INSERT INTO check_records (id, service_id, status, response_time, error_message, checked_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(
                uuidv4(),
                service.id,
                status,
                result.responseTime,
                result.errorMessage || null,
                new Date().toISOString()
              );
              
              console.log(`[Host Update] Service ${service.name}: ${status} (${result.responseTime}ms)`);
            } catch (err: any) {
              console.error(`[Host Update] Service check failed for ${service.name}:`, err.message);
            }
          }
          console.log(`[Host Update] All service checks completed for ${host.name}`);
        })();
      } else {
        console.log(`[Host Update] No services found for ${host.name}`);
      }
    }
  } catch (error: any) {
    console.error(`[Host Update] Error triggering service checks:`, error.message);
  }
}

export default router;
