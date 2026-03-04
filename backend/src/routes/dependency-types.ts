import { Router, Request, Response } from 'express';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface DependencyType {
  id: string;
  name: string;
  label: string;
  icon: string;
  description?: string;
  color: string;
  line_style: string; // solid, dashed, dotted, long-dash
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 初始化依赖类型表和默认数据
const initDependencyTypes = () => {
  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dependency_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      icon TEXT DEFAULT '🔗',
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      line_style TEXT DEFAULT 'solid',
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 添加 line_style 列（如果不存在）
  try {
    const columns = db.prepare("PRAGMA table_info(dependency_types)").all() as { name: string }[];
    const hasLineStyle = columns.some(col => col.name === 'line_style');
    if (!hasLineStyle) {
      db.exec('ALTER TABLE dependency_types ADD COLUMN line_style TEXT DEFAULT "solid"');
      // 为现有系统类型设置默认连线样式
      db.prepare('UPDATE dependency_types SET line_style = ? WHERE name = ?').run('solid', 'depends');
      db.prepare('UPDATE dependency_types SET line_style = ? WHERE name = ?').run('dashed', 'uses');
      db.prepare('UPDATE dependency_types SET line_style = ? WHERE name = ?').run('dotted', 'sync');
      db.prepare('UPDATE dependency_types SET line_style = ? WHERE name = ?').run('long-dash', 'backup');
    }
  } catch (e) {
    // 列可能已存在
  }

  // 检查是否有数据，没有则插入默认值
  const count = db.prepare('SELECT COUNT(*) as count FROM dependency_types').get() as { count: number };
  if (count.count === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO dependency_types (id, name, label, icon, description, color, line_style, is_system, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run('type-depends', 'depends', 'Depends', '🔗', 'Strong dependency, must be available', '#ef4444', 'solid', 1, 1);
    insertStmt.run('type-uses', 'uses', 'Uses', '📡', 'Weak dependency, can degrade', '#6366f1', 'dashed', 1, 2);
    insertStmt.run('type-sync', 'sync', 'Sync', '🔄', 'Data synchronization relationship', '#06b6d4', 'dotted', 1, 3);
    insertStmt.run('type-backup', 'backup', 'Backup', '💾', 'Backup/redundancy relationship', '#10b981', 'long-dash', 1, 4);
  }
};

// 初始化
initDependencyTypes();

// 获取所有依赖类型
router.get('/', (req: Request, res: Response) => {
  try {
    const types = db.prepare('SELECT * FROM dependency_types ORDER BY sort_order, name').all() as DependencyType[];
    res.json(types);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个依赖类型
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const type = db.prepare('SELECT * FROM dependency_types WHERE id = ?').get(id) as DependencyType | undefined;
    
    if (!type) {
      return res.status(404).json({ error: 'Dependency type not found' });
    }
    
    res.json(type);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建自定义依赖类型
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, label, icon = '🔗', description, color = '#6366f1', line_style = 'solid' } = req.body;
    
    if (!name || !label) {
      return res.status(400).json({ error: 'name and label are required' });
    }
    
    // 检查名称是否已存在
    const existing = db.prepare('SELECT id FROM dependency_types WHERE name = ?').get(name);
    if (existing) {
      return res.status(400).json({ error: 'Dependency type name already exists' });
    }
    
    // 获取最大排序号
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM dependency_types').get() as { max_order: number } | undefined;
    const sortOrder = (maxOrder?.max_order || 0) + 1;
    
    const id = `type-${uuidv4().slice(0, 8)}`;
    
    db.prepare(`
      INSERT INTO dependency_types (id, name, label, icon, description, color, line_style, is_system, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, name.toLowerCase().replace(/\s+/g, '-'), label, icon, description || null, color, line_style, sortOrder);
    
    const newType = db.prepare('SELECT * FROM dependency_types WHERE id = ?').get(id);
    res.status(201).json(newType);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新依赖类型
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, label, icon, description, color, line_style, sort_order } = req.body;
    
    const existing = db.prepare('SELECT * FROM dependency_types WHERE id = ?').get(id) as DependencyType | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Dependency type not found' });
    }
    
    // 如果提供了新的 name，检查是否与其他记录冲突（系统类型也可以修改 name）
    if (name && name !== existing.name) {
      // 检查是否有其他依赖类型使用了相同的 name
      const nameConflict = db.prepare('SELECT id FROM dependency_types WHERE name = ? AND id != ?').get(name, id);
      if (nameConflict) {
        return res.status(400).json({ error: 'Dependency type name already exists' });
      }
      
      // 检查是否有依赖关系使用旧的 name，如果有则需要更新它们
      const usageCount = db.prepare('SELECT COUNT(*) as count FROM service_dependencies WHERE dependency_type = ?').get(existing.name) as { count: number };
      if (usageCount.count > 0) {
        // 更新所有使用旧 name 的依赖关系
        db.prepare('UPDATE service_dependencies SET dependency_type = ? WHERE dependency_type = ?').run(name, existing.name);
      }
    }
    
    // 更新依赖类型（包括 name）
    db.prepare(`
      UPDATE dependency_types 
      SET name = COALESCE(?, name),
          label = COALESCE(?, label),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          color = COALESCE(?, color),
          line_style = COALESCE(?, line_style),
          sort_order = COALESCE(?, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, label, icon, description, color, line_style, sort_order, id);
    
    const updated = db.prepare('SELECT * FROM dependency_types WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除自定义依赖类型
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM dependency_types WHERE id = ?').get(id) as DependencyType | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Dependency type not found' });
    }
    
    // 不允许删除系统内置类型
    if (existing.is_system === 1) {
      return res.status(400).json({ error: 'Cannot delete system dependency type' });
    }
    
    // 检查是否有依赖关系使用此类型
    const usageCount = db.prepare('SELECT COUNT(*) as count FROM service_dependencies WHERE dependency_type = ?').get(existing.name) as { count: number };
    if (usageCount.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete: ${usageCount.count} dependencies are using this type. Please update them first.` 
      });
    }
    
    db.prepare('DELETE FROM dependency_types WHERE id = ?').run(id);
    res.json({ message: 'Dependency type deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
