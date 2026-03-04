import { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import logger from '../utils/logger';

/**
 * 数据验证中间件
 * 
 * 在修改数据前验证一致性和兼容性
 */

/**
 * 验证服务更新的数据一致性
 */
export function validateServiceUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { host_id, project_id, service_type } = req.body;
    
    // 如果没有更新 host_id 和 project_id，跳过验证
    if (!host_id && project_id === undefined) {
      return next();
    }
    
    // 获取当前服务信息
    let currentService: any = null;
    if (id) {
      currentService = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    }
    
    const targetHostId = host_id || (currentService?.host_id);
    const targetProjectId = project_id !== undefined ? project_id : (currentService?.project_id);
    const targetServiceType = service_type || (currentService?.service_type);
    
    const warnings: any[] = [];
    
    // 验证1: 检查 host_id 和 project_id 的一致性
    if (targetHostId) {
      const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(targetHostId) as any;
      
      if (!host) {
        return res.status(400).json({
          error: 'INVALID_HOST',
          message: '指定的主机不存在'
        });
      }
      
      // 检查主机项目和服务项目是否一致
      if (host.project_id !== targetProjectId) {
        if (host.project_id && targetProjectId) {
          warnings.push({
            type: 'PROJECT_MISMATCH',
            severity: 'warning',
            message: `服务项目 (${targetProjectId}) 与主机项目 (${host.project_id}) 不一致`,
            suggestion: `建议将服务项目设置为 ${host.project_id}`,
            auto_fix: {
              field: 'project_id',
              value: host.project_id
            }
          });
        }
      }
      
      // 验证2: 检查服务类型与主机连接类型的兼容性
      if (targetServiceType === 'ssh' && host.connection_type !== 'ssh') {
        return res.status(400).json({
          error: 'INCOMPATIBLE_CONNECTION_TYPE',
          message: `SSH 服务需要 SSH 类型的主机连接`,
          service_type: targetServiceType,
          host_connection_type: host.connection_type,
          host_name: host.name
        });
      }
    }
    
    // 如果有警告，附加到请求对象供后续使用
    if (warnings.length > 0) {
      (req as any).validationWarnings = warnings;
    }
    
    next();
  } catch (error: any) {
    logger.api.error('Validation error', { error });
    res.status(500).json({ error: error.message });
  }
}

/**
 * 验证主机更新的数据一致性
 */
export function validateHostUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { connection_type, project_id } = req.body;
    
    // 如果没有更新这些字段，跳过验证
    if (!connection_type && project_id === undefined) {
      return next();
    }
    
    const warnings: any[] = [];
    
    // 获取当前主机信息
    let currentHost: any = null;
    if (id) {
      currentHost = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id);
      if (!currentHost) {
        return res.status(404).json({ error: 'Host not found' });
      }
    }
    
    const targetConnectionType = connection_type || currentHost?.connection_type;
    
    // 验证1: 检查连接类型变更对服务的影响
    if (id && connection_type && connection_type !== currentHost.connection_type) {
      const sshServices = db.prepare(`
        SELECT id, name FROM services 
        WHERE host_id = ? AND service_type = 'ssh'
      `).all(id) as any[];
      
      if (targetConnectionType !== 'ssh' && sshServices.length > 0) {
        warnings.push({
          type: 'CONNECTION_TYPE_INCOMPATIBILITY',
          severity: 'error',
          message: `主机连接类型变更为 "${targetConnectionType}"，但有 ${sshServices.length} 个 SSH 服务依赖此主机`,
          affected_services: sshServices,
          recommendation: '请先修改或删除这些 SSH 服务'
        });
      }
    }
    
    // 验证2: 检查项目变更的影响
    if (id && project_id !== undefined && project_id !== currentHost.project_id) {
      const serviceCount = db.prepare(
        'SELECT COUNT(*) as count FROM services WHERE host_id = ?'
      ).get(id) as any;
      
      if (serviceCount.count > 0) {
        warnings.push({
          type: 'PROJECT_CHANGE_CASCADE',
          severity: 'info',
          message: `主机项目变更将自动同步 ${serviceCount.count} 个服务的项目归属`,
          old_project: currentHost.project_id,
          new_project: project_id,
          affected_count: serviceCount.count
        });
      }
    }
    
    // 如果有错误级别的警告，阻止操作
    const errors = warnings.filter(w => w.severity === 'error');
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        errors: errors,
        warnings: warnings.filter(w => w.severity !== 'error')
      });
    }
    
    // 将警告附加到请求对象
    if (warnings.length > 0) {
      (req as any).validationWarnings = warnings;
    }
    
    next();
  } catch (error: any) {
    logger.api.error('Validation error', { error });
    res.status(500).json({ error: error.message });
  }
}

/**
 * 验证项目删除的影响
 */
export function validateProjectDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { force } = req.query;
    
    // 检查项目是否存在
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 统计影响
    const hostCount = db.prepare('SELECT COUNT(*) as count FROM hosts WHERE project_id = ?').get(id) as any;
    const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services WHERE project_id = ?').get(id) as any;
    
    if ((hostCount.count > 0 || serviceCount.count > 0) && force !== 'true') {
      return res.status(400).json({
        error: 'PROJECT_HAS_DEPENDENCIES',
        message: '项目包含主机或服务，无法直接删除',
        impact: {
          hosts: hostCount.count,
          services: serviceCount.count
        },
        options: {
          force: '添加 ?force=true 强制删除（主机和服务将变为未分配状态）'
        }
      });
    }
    
    (req as any).deletionImpact = {
      hosts: hostCount.count,
      services: serviceCount.count
    };
    
    next();
  } catch (error: any) {
    logger.api.error('Validation error', { error });
    res.status(500).json({ error: error.message });
  }
}

/**
 * 验证主机删除的影响
 */
export function validateHostDelete(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { force, reassign_to, orphan } = req.query;
    
    // 检查主机是否存在
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id);
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // 检查服务依赖
    const services = db.prepare(
      'SELECT id, name, service_type FROM services WHERE host_id = ?'
    ).all(id) as any[];
    
    if (services.length > 0 && !force && !reassign_to && orphan !== 'true') {
      return res.status(400).json({
        error: 'HOST_HAS_SERVICES',
        message: `主机包含 ${services.length} 个服务，无法直接删除`,
        services: services.map(s => ({ id: s.id, name: s.name, type: s.service_type })),
        options: {
          reassign: '添加 ?reassign_to=<host_id> 将服务重新分配到其他主机',
          orphan: '添加 ?orphan=true 将服务变为未分配状态',
          force: '添加 ?force=true 强制删除主机及所有服务（危险操作）'
        }
      });
    }
    
    // 如果指定了 reassign_to，验证目标主机
    if (reassign_to) {
      const targetHost = db.prepare('SELECT * FROM hosts WHERE id = ?').get(reassign_to as string);
      if (!targetHost) {
        return res.status(400).json({
          error: 'INVALID_TARGET_HOST',
          message: '指定的目标主机不存在'
        });
      }
    }
    
    (req as any).deletionImpact = {
      services: services.length
    };
    
    next();
  } catch (error: any) {
    logger.api.error('Validation error', { error });
    res.status(500).json({ error: error.message });
  }
}
