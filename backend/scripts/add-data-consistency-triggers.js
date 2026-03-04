/**
 * 数据一致性触发器迁移脚本
 * 
 * 目的：确保 Host.project_id 和 Service.project_id 保持一致
 * 
 * 触发器功能：
 * 1. 当修改 Host.project_id 时，自动同步更新该主机下所有服务的 project_id
 * 2. 防止 Host-Service 项目归属不一致的问题
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'monitor.db');
const db = new Database(dbPath);

console.log('🚀 开始添加数据一致性触发器...\n');

try {
  // 1. 创建触发器：当 Host.project_id 更新时，同步更新相关服务
  console.log('📝 创建触发器: sync_service_project_on_host_update');
  
  db.exec(`
    -- 删除旧触发器（如果存在）
    DROP TRIGGER IF EXISTS sync_service_project_on_host_update;
    
    -- 创建新触发器
    CREATE TRIGGER sync_service_project_on_host_update
    AFTER UPDATE OF project_id ON hosts
    WHEN OLD.project_id IS NOT NEW.project_id  -- 只在 project_id 真正变化时触发
    BEGIN
      -- 更新该主机下所有服务的 project_id
      UPDATE services 
      SET project_id = NEW.project_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id = NEW.id;
      
      -- 记录变更日志（可选）
      -- INSERT INTO audit_log (entity_type, entity_id, action, details) 
      -- VALUES ('host', NEW.id, 'project_sync', 
      --         json_object('old_project', OLD.project_id, 'new_project', NEW.project_id));
    END;
  `);
  
  console.log('✅ 触发器创建成功\n');
  
  // 2. 检查并修复现有的数据不一致问题
  console.log('🔍 检查现有数据一致性问题...');
  
  const inconsistencies = db.prepare(`
    SELECT 
      s.id as service_id,
      s.name as service_name,
      s.project_id as service_project,
      h.id as host_id,
      h.name as host_name,
      h.project_id as host_project
    FROM services s
    INNER JOIN hosts h ON s.host_id = h.id
    WHERE s.project_id != h.project_id
      OR (s.project_id IS NULL AND h.project_id IS NOT NULL)
      OR (s.project_id IS NOT NULL AND h.project_id IS NULL)
  `).all();
  
  if (inconsistencies.length > 0) {
    console.log(`⚠️  发现 ${inconsistencies.length} 个数据不一致问题：\n`);
    
    inconsistencies.forEach((item, index) => {
      console.log(`  ${index + 1}. 服务: ${item.service_name}`);
      console.log(`     - 服务项目: ${item.service_project || '(未分配)'}`);
      console.log(`     - 主机项目: ${item.host_project || '(未分配)'}`);
      console.log(`     - 主机: ${item.host_name}\n`);
    });
    
    console.log('🔧 正在修复数据不一致问题...');
    
    // 事务中修复所有不一致
    const fixStmt = db.prepare(`
      UPDATE services 
      SET project_id = (SELECT project_id FROM hosts WHERE hosts.id = services.host_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id IS NOT NULL
        AND (
          project_id != (SELECT project_id FROM hosts WHERE hosts.id = services.host_id)
          OR (project_id IS NULL AND (SELECT project_id FROM hosts WHERE hosts.id = services.host_id) IS NOT NULL)
          OR (project_id IS NOT NULL AND (SELECT project_id FROM hosts WHERE hosts.id = services.host_id) IS NULL)
        )
    `);
    
    const result = fixStmt.run();
    console.log(`✅ 已修复 ${result.changes} 个服务的项目归属\n`);
  } else {
    console.log('✅ 未发现数据不一致问题\n');
  }
  
  // 3. 验证触发器工作正常
  console.log('🧪 测试触发器功能...');
  
  // 查找一个测试用的主机
  const testHost = db.prepare(`
    SELECT h.id, h.name, h.project_id, COUNT(s.id) as service_count
    FROM hosts h
    LEFT JOIN services s ON s.host_id = h.id
    GROUP BY h.id
    HAVING service_count > 0
    LIMIT 1
  `).get();
  
  if (testHost) {
    console.log(`   使用主机: ${testHost.name} (有 ${testHost.service_count} 个服务)`);
    
    // 获取服务的当前 project_id
    const beforeServices = db.prepare(
      'SELECT id, name, project_id FROM services WHERE host_id = ?'
    ).all(testHost.id);
    
    console.log(`   触发器测试前服务项目: ${beforeServices[0].project_id || '(未分配)'}`);
    
    // 临时更改主机的 project_id (如果是NULL就设置一个值，否则清空)
    const testProjectId = testHost.project_id ? null : 'test-project';
    db.prepare('UPDATE hosts SET project_id = ? WHERE id = ?')
      .run(testProjectId, testHost.id);
    
    // 检查服务的 project_id 是否同步更新
    const afterServices = db.prepare(
      'SELECT id, name, project_id FROM services WHERE host_id = ?'
    ).all(testHost.id);
    
    console.log(`   触发器测试后服务项目: ${afterServices[0].project_id || '(未分配)'}`);
    
    // 恢复原始值
    db.prepare('UPDATE hosts SET project_id = ? WHERE id = ?')
      .run(testHost.project_id, testHost.id);
    
    const restored = db.prepare(
      'SELECT project_id FROM services WHERE host_id = ? LIMIT 1'
    ).get(testHost.id);
    
    console.log(`   恢复原值后服务项目: ${restored.project_id || '(未分配)'}`);
    
    if (afterServices[0].project_id === testProjectId && 
        restored.project_id === testHost.project_id) {
      console.log('✅ 触发器工作正常\n');
    } else {
      console.log('⚠️  触发器可能未正常工作\n');
    }
  } else {
    console.log('   ℹ️  没有合适的测试数据，跳过触发器测试\n');
  }
  
  // 4. 显示最终统计
  console.log('📊 数据统计：');
  
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT p.id) as project_count,
      COUNT(DISTINCT h.id) as host_count,
      COUNT(DISTINCT s.id) as service_count,
      COUNT(DISTINCT CASE WHEN h.project_id IS NOT NULL THEN h.id END) as hosts_with_project,
      COUNT(DISTINCT CASE WHEN s.project_id IS NOT NULL THEN s.id END) as services_with_project
    FROM projects p
    LEFT JOIN hosts h ON h.project_id = p.id
    LEFT JOIN services s ON s.project_id = p.id
  `).get();
  
  console.log(`   - 项目数: ${stats.project_count}`);
  console.log(`   - 主机数: ${stats.host_count} (${stats.hosts_with_project} 个已分配项目)`);
  console.log(`   - 服务数: ${stats.service_count} (${stats.services_with_project} 个已分配项目)`);
  
  console.log('\n✅ 数据一致性触发器安装完成！');
  console.log('\n📝 后续操作：');
  console.log('   - 修改主机项目时，相关服务会自动同步');
  console.log('   - 可以运行 node scripts/check-data-consistency.js 检查数据一致性');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
