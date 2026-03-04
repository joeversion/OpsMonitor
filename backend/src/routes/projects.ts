import { Router, Request, Response } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

interface Project {
  id: string;
  name: string;
  description?: string;
  icon_color: string;
  created_at: string;
  updated_at: string;
}

interface ProjectWithStats extends Project {
  service_count: number;
  healthy_count: number;
  warning_count: number;
  down_count: number;
}

// 获取所有项目（带统计信息）
router.get('/', (req: Request, res: Response) => {
  try {
    // Optimized: Single query with JOIN instead of N+1 queries
    const result = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.icon_color,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT s.id) as service_count,
        COALESCE(SUM(CASE WHEN latest.status = 'up' THEN 1 ELSE 0 END), 0) as healthy_count,
        COALESCE(SUM(CASE WHEN latest.status = 'warning' THEN 1 ELSE 0 END), 0) as warning_count,
        COALESCE(SUM(CASE WHEN latest.status = 'down' THEN 1 ELSE 0 END), 0) as down_count
      FROM projects p
      LEFT JOIN services s ON s.project_id = p.id
      LEFT JOIN (
        SELECT cr1.service_id, cr1.status
        FROM check_records cr1
        INNER JOIN (
          SELECT service_id, MAX(checked_at) as max_checked_at
          FROM check_records
          GROUP BY service_id
        ) cr2 ON cr1.service_id = cr2.service_id AND cr1.checked_at = cr2.max_checked_at
      ) latest ON s.id = latest.service_id
      GROUP BY p.id, p.name, p.description, p.icon_color, p.created_at, p.updated_at
      ORDER BY p.name
    `).all() as ProjectWithStats[];

    res.json(result);
  } catch (error) {
    logger.api.error('Error fetching projects', { error });
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// 获取项目影响分析
router.get('/:id/impact', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 获取关联的主机
    const hosts = db.prepare(`
      SELECT id, name, ip, connection_type
      FROM hosts 
      WHERE project_id = ?
    `).all(id) as any[];
    
    // 获取关联的服务
    const services = db.prepare(`
      SELECT id, name, service_type, host_id, risk_level
      FROM services 
      WHERE project_id = ?
    `).all(id) as any[];
    
    // 获取跨项目依赖
    const crossProjectDeps = db.prepare(`
      SELECT 
        sd.id,
        sd.dependency_type,
        s1.name as source_service,
        s2.name as target_service,
        s2.project_id as target_project_id
      FROM service_dependencies sd
      JOIN services s1 ON sd.source_service_id = s1.id
      LEFT JOIN services s2 ON sd.target_service_id = s2.id
      WHERE s1.project_id = ? AND (s2.project_id IS NULL OR s2.project_id != ?)
    `).all(id, id) as any[];
    
    const impact = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description
      },
      statistics: {
        host_count: hosts.length,
        service_count: services.length,
        ssh_service_count: services.filter(s => s.service_type === 'ssh').length,
        high_risk_service_count: services.filter(s => s.risk_level === 'high' || s.risk_level === 'critical').length
      },
      affected_resources: {
        hosts: hosts.map(h => ({
          id: h.id,
          name: h.name,
          ip: h.ip,
          connection_type: h.connection_type
        })),
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          type: s.service_type,
          risk_level: s.risk_level
        }))
      },
      cross_project_dependencies: crossProjectDeps,
      deletion_impact: {
        can_delete: true,
        warnings: [] as string[]
      }
    };
    
    // 删除影响分析
    if (hosts.length > 0) {
      impact.deletion_impact.warnings.push(
        `删除此项目将影响 ${hosts.length} 个主机（它们的 project_id 将被设为 NULL）`
      );
    }
    
    if (services.length > 0) {
      impact.deletion_impact.warnings.push(
        `删除此项目将影响 ${services.length} 个服务（它们的 project_id 将被设为 NULL）`
      );
    }
    
    if (crossProjectDeps.length > 0) {
      impact.deletion_impact.warnings.push(
        `此项目有 ${crossProjectDeps.length} 个跨项目依赖关系`
      );
    }
    
    res.json(impact);
  } catch (error) {
    logger.api.error('Error fetching project impact', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to fetch project impact' });
  }
});

// 获取单个项目
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    logger.api.error('Error fetching project', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// 获取项目下的所有服务
router.get('/:id/services', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const services = db.prepare(`
      SELECT s.*, 
        (SELECT status FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as current_status,
        (SELECT response_time FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as last_response_time
      FROM services s 
      WHERE s.project_id = ?
      ORDER BY s.name
    `).all(id);
    
    res.json(services);
  } catch (error) {
    logger.api.error('Error fetching project services', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to fetch project services' });
  }
});

// 创建项目
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, icon_color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO projects (id, name, description, icon_color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description || null, icon_color || 'blue', now, now);
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  } catch (error) {
    logger.api.error('Error creating project', { name: req.body.name, error });
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// 更新项目
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon_color } = req.body;
    
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE projects 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          icon_color = COALESCE(?, icon_color),
          updated_at = ?
      WHERE id = ?
    `).run(name, description, icon_color, now, id);
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json(project);
  } catch (error) {
    logger.api.error('Error updating project', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// 删除项目
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 将该项目下的服务的 project_id 设置为 null
    db.prepare('UPDATE services SET project_id = NULL WHERE project_id = ?').run(id);
    
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    logger.api.error('Error deleting project', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// 获取项目的依赖图数据（包含状态）
router.get('/:id/graph', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 获取项目下的所有服务（带状态）
    const services = db.prepare(`
      SELECT s.*, 
        (SELECT status FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as current_status,
        (SELECT response_time FROM check_records WHERE service_id = s.id ORDER BY checked_at DESC LIMIT 1) as last_response_time
      FROM services s 
      WHERE s.project_id = ?
    `).all(id) as any[];
    
    // 构建节点
    const nodes = services.map(s => ({
      id: s.id,
      name: s.name,
      status: s.current_status || 'unknown',
      responseTime: s.last_response_time,
      host: s.host,
      port: s.port,
      riskLevel: s.risk_level
    }));
    
    // 构建边
    const edges: any[] = [];
    services.forEach(s => {
      if (s.dependencies) {
        const deps = JSON.parse(s.dependencies);
        deps.forEach((depId: string) => {
          const targetService = services.find(t => t.id === depId);
          edges.push({
            source: s.id,
            target: depId,
            status: targetService?.current_status || 'unknown'
          });
        });
      }
    });
    
    res.json({ nodes, edges });
  } catch (error) {
    logger.api.error('Error fetching project graph', { projectId: req.params.id, error });
    res.status(500).json({ error: 'Failed to fetch project graph' });
  }
});

export default router;
