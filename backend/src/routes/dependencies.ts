import { Router, Request, Response } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

interface ServiceDependency {
  id: string;
  source_service_id: string;
  target_service_id?: string;
  target_resource_id?: string;
  dependency_type: 'depends' | 'uses' | 'sync' | 'backup';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  created_at: string;
}

interface DependencyWithDetails extends ServiceDependency {
  source_service_name?: string;
  source_project_id?: string;
  source_project_name?: string;
  target_service_name?: string;
  target_project_id?: string;
  target_project_name?: string;
  target_resource_name?: string;
  target_resource_type?: string;
}

// 获取所有依赖关系（带详细信息）
router.get('/', (req: Request, res: Response) => {
  try {
    const dependencies = db.prepare(`
      SELECT 
        d.*,
        ss.name as source_service_name,
        ss.project_id as source_project_id,
        sp.name as source_project_name,
        ts.name as target_service_name,
        ts.project_id as target_project_id,
        tp.name as target_project_name,
        sc.name as target_resource_name,
        sc.type as target_resource_type
      FROM service_dependencies d
      LEFT JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN projects sp ON ss.project_id = sp.id
      LEFT JOIN services ts ON d.target_service_id = ts.id
      LEFT JOIN projects tp ON ts.project_id = tp.id
      LEFT JOIN security_configs sc ON d.target_resource_id = sc.id
      ORDER BY d.created_at DESC
    `).all() as DependencyWithDetails[];
    
    res.json(dependencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取跨项目依赖（不同项目之间的依赖）
router.get('/cross-project', (req: Request, res: Response) => {
  try {
    const dependencies = db.prepare(`
      SELECT 
        d.*,
        ss.name as source_service_name,
        ss.project_id as source_project_id,
        sp.name as source_project_name,
        ts.name as target_service_name,
        ts.project_id as target_project_id,
        tp.name as target_project_name,
        sc.name as target_resource_name,
        sc.type as target_resource_type
      FROM service_dependencies d
      LEFT JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN projects sp ON ss.project_id = sp.id
      LEFT JOIN services ts ON d.target_service_id = ts.id
      LEFT JOIN projects tp ON ts.project_id = tp.id
      LEFT JOIN security_configs sc ON d.target_resource_id = sc.id
      WHERE 
        (ss.project_id != ts.project_id AND ts.id IS NOT NULL)
        OR d.target_resource_id IS NOT NULL
      ORDER BY d.created_at DESC
    `).all() as DependencyWithDetails[];
    
    res.json(dependencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取某个服务的所有依赖
router.get('/service/:serviceId', (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    
    // 该服务依赖的（下游）
    const dependsOn = db.prepare(`
      SELECT 
        d.*,
        ts.name as target_service_name,
        ts.project_id as target_project_id,
        tp.name as target_project_name,
        sc.name as target_resource_name,
        sc.type as target_resource_type
      FROM service_dependencies d
      LEFT JOIN services ts ON d.target_service_id = ts.id
      LEFT JOIN projects tp ON ts.project_id = tp.id
      LEFT JOIN security_configs sc ON d.target_resource_id = sc.id
      WHERE d.source_service_id = ?
    `).all(serviceId);
    
    // 依赖该服务的（上游）
    const dependedBy = db.prepare(`
      SELECT 
        d.*,
        ss.name as source_service_name,
        ss.project_id as source_project_id,
        sp.name as source_project_name
      FROM service_dependencies d
      LEFT JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN projects sp ON ss.project_id = sp.id
      WHERE d.target_service_id = ?
    `).all(serviceId);
    
    res.json({ dependsOn, dependedBy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取某个项目的所有外部依赖
router.get('/project/:projectId/external', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    // 该项目依赖外部项目的服务
    const externalDependencies = db.prepare(`
      SELECT 
        d.*,
        ss.name as source_service_name,
        ts.name as target_service_name,
        ts.project_id as target_project_id,
        tp.name as target_project_name,
        sc.name as target_resource_name,
        sc.type as target_resource_type
      FROM service_dependencies d
      JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN services ts ON d.target_service_id = ts.id
      LEFT JOIN projects tp ON ts.project_id = tp.id
      LEFT JOIN security_configs sc ON d.target_resource_id = sc.id
      WHERE ss.project_id = ?
        AND (
          (ts.project_id IS NOT NULL AND ts.project_id != ?)
          OR d.target_resource_id IS NOT NULL
        )
    `).all(projectId, projectId);
    
    // 外部项目依赖该项目的服务
    const externalDependents = db.prepare(`
      SELECT 
        d.*,
        ss.name as source_service_name,
        ss.project_id as source_project_id,
        sp.name as source_project_name,
        ts.name as target_service_name
      FROM service_dependencies d
      JOIN services ss ON d.source_service_id = ss.id
      JOIN projects sp ON ss.project_id = sp.id
      JOIN services ts ON d.target_service_id = ts.id
      WHERE ts.project_id = ?
        AND ss.project_id != ?
    `).all(projectId, projectId);
    
    res.json({ externalDependencies, externalDependents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建依赖关系
router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      source_service_id, 
      target_service_id, 
      target_resource_id,
      dependency_type, 
      risk_level = 'medium',
      link_direction = 'auto',
      description,
      impact_description,
      custom_alert_template
    } = req.body;
    
    if (!source_service_id) {
      return res.status(400).json({ error: 'source_service_id is required' });
    }
    
    if (!target_service_id && !target_resource_id) {
      return res.status(400).json({ error: 'Either target_service_id or target_resource_id is required' });
    }
    
    if (!dependency_type) {
      return res.status(400).json({ error: 'dependency_type is required' });
    }
    
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO service_dependencies 
      (id, source_service_id, target_service_id, target_resource_id, dependency_type, risk_level, link_direction, description, impact_description, custom_alert_template)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, source_service_id, target_service_id || null, target_resource_id || null, dependency_type, risk_level, link_direction, description || null, impact_description || null, custom_alert_template || null);
    
    const dependency = db.prepare('SELECT * FROM service_dependencies WHERE id = ?').get(id);
    res.status(201).json(dependency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新依赖关系
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dependency_type, risk_level, link_direction, description, impact_description, custom_alert_template } = req.body;
    
    const existing = db.prepare('SELECT * FROM service_dependencies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Dependency not found' });
    }
    
    db.prepare(`
      UPDATE service_dependencies 
      SET dependency_type = COALESCE(?, dependency_type),
          risk_level = COALESCE(?, risk_level),
          link_direction = COALESCE(?, link_direction),
          description = COALESCE(?, description),
          impact_description = ?,
          custom_alert_template = ?
      WHERE id = ?
    `).run(dependency_type, risk_level, link_direction, description, impact_description !== undefined ? impact_description : (existing as any).impact_description, custom_alert_template !== undefined ? custom_alert_template : (existing as any).custom_alert_template, id);
    
    const updated = db.prepare('SELECT * FROM service_dependencies WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除依赖关系
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM service_dependencies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Dependency not found' });
    }
    
    db.prepare('DELETE FROM service_dependencies WHERE id = ?').run(id);
    res.json({ message: 'Dependency deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 迁移旧依赖关系到新系统
router.post('/migrate', (req: Request, res: Response) => {
  try {
    logger.database.info('Starting dependency migration');
    
    // 获取所有服务及其依赖
    const services = db.prepare('SELECT id, dependencies FROM services WHERE dependencies IS NOT NULL').all() as Array<{
      id: string;
      dependencies: string;
    }>;
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    const insertStmt = db.prepare(`
      INSERT INTO service_dependencies (
        id, source_service_id, target_service_id, dependency_type, risk_level
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    const migrationTransaction = db.transaction(() => {
      services.forEach(service => {
        try {
          const deps = JSON.parse(service.dependencies);
          if (Array.isArray(deps) && deps.length > 0) {
            deps.forEach(targetServiceId => {
              // 检查目标服务是否存在
              const targetExists = db.prepare('SELECT id FROM services WHERE id = ?').get(targetServiceId);
              if (targetExists) {
                // 检查是否已经存在此依赖关系
                const existingDep = db.prepare(`
                  SELECT id FROM service_dependencies 
                  WHERE source_service_id = ? AND target_service_id = ?
                `).get(service.id, targetServiceId);
                
                if (!existingDep) {
                  const newId = uuidv4();
                  insertStmt.run(newId, service.id, targetServiceId, 'depends', 'medium');
                  migratedCount++;
                } else {
                  skippedCount++;
                }
              } else {
                logger.database.debug('Target service not found, skipping', { targetServiceId });
                skippedCount++;
              }
            });
          }
        } catch (e) {
          logger.database.error('Failed to parse dependencies', { serviceId: service.id, error: e });
        }
      });
    });
    
    migrationTransaction();
    
    logger.database.info('Migration completed', { migrated: migratedCount, skipped: skippedCount });
    res.json({ 
      message: 'Migration completed', 
      migrated: migratedCount,
      skipped: skippedCount
    });
  } catch (error: any) {
    logger.database.error('Migration failed', { error });
    res.status(500).json({ error: error.message });
  }
});

// 获取跨项目依赖图数据（用于可视化）
router.get('/graph/cross-project', (req: Request, res: Response) => {
  try {
    // 获取所有项目
    const projects = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM services s WHERE s.project_id = p.id) as service_count
      FROM projects p
    `).all();
    
    // 获取所有共享资源（security_configs）
    const sharedResources = db.prepare(`
      SELECT sc.*, 
        (SELECT COUNT(*) FROM service_dependencies d WHERE d.target_resource_id = sc.id) as dependent_count
      FROM security_configs sc
      WHERE sc.id IN (SELECT DISTINCT target_resource_id FROM service_dependencies WHERE target_resource_id IS NOT NULL)
    `).all();
    
    // 获取跨项目依赖
    const crossDependencies = db.prepare(`
      SELECT 
        d.*,
        ss.project_id as source_project_id,
        ts.project_id as target_project_id
      FROM service_dependencies d
      JOIN services ss ON d.source_service_id = ss.id
      LEFT JOIN services ts ON d.target_service_id = ts.id
      WHERE 
        (ss.project_id != ts.project_id AND ts.id IS NOT NULL)
        OR d.target_resource_id IS NOT NULL
    `).all();
    
    // 构建图数据
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // 添加项目节点
    projects.forEach((p: any) => {
      nodes.push({
        id: `project-${p.id}`,
        data: {
          nodeType: 'project',
          name: p.name,
          serviceCount: p.service_count,
          iconColor: p.icon_color
        }
      });
    });
    
    // 添加共享资源节点
    sharedResources.forEach((r: any) => {
      nodes.push({
        id: `resource-${r.id}`,
        data: {
          nodeType: 'resource',
          name: r.name,
          resourceType: r.type,
          dependentCount: r.dependent_count
        }
      });
    });
    
    // 添加边（聚合到项目级别）
    const edgeMap = new Map<string, { count: number; types: Set<string>; riskLevels: Set<string> }>();
    
    crossDependencies.forEach((d: any) => {
      let sourceId = `project-${d.source_project_id}`;
      let targetId = d.target_project_id 
        ? `project-${d.target_project_id}` 
        : `resource-${d.target_resource_id}`;
      
      const edgeKey = `${sourceId}->${targetId}`;
      
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, { count: 0, types: new Set(), riskLevels: new Set() });
      }
      
      const edge = edgeMap.get(edgeKey)!;
      edge.count++;
      edge.types.add(d.dependency_type);
      edge.riskLevels.add(d.risk_level);
    });
    
    edgeMap.forEach((value, key) => {
      const [source, target] = key.split('->');
      edges.push({
        source,
        target,
        data: {
          count: value.count,
          types: Array.from(value.types),
          riskLevels: Array.from(value.riskLevels),
          maxRisk: value.riskLevels.has('critical') ? 'critical' 
            : value.riskLevels.has('high') ? 'high'
            : value.riskLevels.has('medium') ? 'medium' : 'low'
        }
      });
    });
    
    res.json({ nodes, edges });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
