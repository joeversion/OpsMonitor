/**
 * 数据一致性检测工具
 * 
 * 检测 Project-Host-Service 之间的数据不一致问题
 * 
 * 使用方法:
 *   node scripts/check-data-consistency.js
 *   node scripts/check-data-consistency.js --fix  # 自动修复问题
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'monitor.db');
const db = new Database(dbPath);

const args = process.argv.slice(2);
const autoFix = args.includes('--fix');

console.log('🔍 开始检查数据一致性...\n');

const issues = [];
let totalIssues = 0;

// ===== 检查1: Host-Service 项目不一致 =====
console.log('📋 检查1: Host-Service 项目归属一致性');

const projectMismatch = db.prepare(`
  SELECT 
    s.id as service_id,
    s.name as service_name,
    s.project_id as service_project,
    h.id as host_id,
    h.name as host_name,
    h.project_id as host_project,
    p1.name as service_project_name,
    p2.name as host_project_name
  FROM services s
  INNER JOIN hosts h ON s.host_id = h.id
  LEFT JOIN projects p1 ON s.project_id = p1.id
  LEFT JOIN projects p2 ON h.project_id = p2.id
  WHERE (s.project_id != h.project_id)
    OR (s.project_id IS NULL AND h.project_id IS NOT NULL)
    OR (s.project_id IS NOT NULL AND h.project_id IS NULL)
`).all();

if (projectMismatch.length > 0) {
  console.log(`   ❌ 发现 ${projectMismatch.length} 个项目不一致问题:\n`);
  
  projectMismatch.forEach((item, index) => {
    console.log(`   ${index + 1}. 服务: ${item.service_name}`);
    console.log(`      - 服务项目: ${item.service_project_name || item.service_project || '(未分配)'}`);
    console.log(`      - 主机: ${item.host_name}`);
    console.log(`      - 主机项目: ${item.host_project_name || item.host_project || '(未分配)'}\n`);
  });
  
  issues.push({
    type: 'PROJECT_MISMATCH',
    count: projectMismatch.length,
    items: projectMismatch,
    fix: `UPDATE services SET project_id = (SELECT project_id FROM hosts WHERE hosts.id = services.host_id) WHERE host_id IS NOT NULL`
  });
  
  totalIssues += projectMismatch.length;
  
  if (autoFix) {
    console.log('   🔧 正在修复...');
    const result = db.prepare(`
      UPDATE services 
      SET project_id = (SELECT project_id FROM hosts WHERE hosts.id = services.host_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id IS NOT NULL
        AND (
          project_id != (SELECT project_id FROM hosts WHERE hosts.id = services.host_id)
          OR (project_id IS NULL AND (SELECT project_id FROM hosts WHERE hosts.id = services.host_id) IS NOT NULL)
          OR (project_id IS NOT NULL AND (SELECT project_id FROM hosts WHERE hosts.id = services.host_id) IS NULL)
        )
    `).run();
    console.log(`   ✅ 已修复 ${result.changes} 个服务的项目归属\n`);
  }
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 检查2: 无效的主机引用 =====
console.log('📋 检查2: 服务的主机引用有效性');

const invalidHostRefs = db.prepare(`
  SELECT s.id, s.name, s.host_id
  FROM services s
  LEFT JOIN hosts h ON s.host_id = h.id
  WHERE s.host_id IS NOT NULL AND h.id IS NULL
`).all();

if (invalidHostRefs.length > 0) {
  console.log(`   ❌ 发现 ${invalidHostRefs.length} 个无效主机引用:\n`);
  
  invalidHostRefs.forEach((item, index) => {
    console.log(`   ${index + 1}. 服务: ${item.name} (${item.id})`);
    console.log(`      - 引用主机ID: ${item.host_id} (不存在)\n`);
  });
  
  issues.push({
    type: 'INVALID_HOST_REFERENCE',
    count: invalidHostRefs.length,
    items: invalidHostRefs,
    fix: `UPDATE services SET host_id = NULL WHERE host_id NOT IN (SELECT id FROM hosts)`
  });
  
  totalIssues += invalidHostRefs.length;
  
  if (autoFix) {
    console.log('   🔧 正在修复 (将 host_id 设为 NULL)...');
    const result = db.prepare(
      'UPDATE services SET host_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE host_id NOT IN (SELECT id FROM hosts)'
    ).run();
    console.log(`   ✅ 已清理 ${result.changes} 个无效引用\n`);
  }
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 检查3: 无效的项目引用 =====
console.log('📋 检查3: 主机和服务的项目引用有效性');

const invalidProjectRefsHosts = db.prepare(`
  SELECT h.id, h.name, h.project_id
  FROM hosts h
  LEFT JOIN projects p ON h.project_id = p.id
  WHERE h.project_id IS NOT NULL AND p.id IS NULL
`).all();

const invalidProjectRefsServices = db.prepare(`
  SELECT s.id, s.name, s.project_id
  FROM services s
  LEFT JOIN projects p ON s.project_id = p.id
  WHERE s.project_id IS NOT NULL AND p.id IS NULL
`).all();

const totalInvalidProjects = invalidProjectRefsHosts.length + invalidProjectRefsServices.length;

if (totalInvalidProjects > 0) {
  console.log(`   ❌ 发现 ${totalInvalidProjects} 个无效项目引用:\n`);
  
  if (invalidProjectRefsHosts.length > 0) {
    console.log(`   主机 (${invalidProjectRefsHosts.length}):`);
    invalidProjectRefsHosts.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.name} - 项目ID: ${item.project_id} (不存在)`);
    });
    console.log('');
  }
  
  if (invalidProjectRefsServices.length > 0) {
    console.log(`   服务 (${invalidProjectRefsServices.length}):`);
    invalidProjectRefsServices.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.name} - 项目ID: ${item.project_id} (不存在)`);
    });
    console.log('');
  }
  
  issues.push({
    type: 'INVALID_PROJECT_REFERENCE',
    count: totalInvalidProjects,
    items: { hosts: invalidProjectRefsHosts, services: invalidProjectRefsServices }
  });
  
  totalIssues += totalInvalidProjects;
  
  if (autoFix) {
    console.log('   🔧 正在修复 (将 project_id 设为 NULL)...');
    const hostsFixed = db.prepare(
      'UPDATE hosts SET project_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE project_id NOT IN (SELECT id FROM projects)'
    ).run();
    const servicesFixed = db.prepare(
      'UPDATE services SET project_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE project_id NOT IN (SELECT id FROM projects)'
    ).run();
    console.log(`   ✅ 已清理 ${hostsFixed.changes} 个主机和 ${servicesFixed.changes} 个服务的无效引用\n`);
  }
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 检查4: SSH服务与主机连接类型不匹配 =====
console.log('📋 检查4: SSH服务与主机连接类型兼容性');

const typeMismatch = db.prepare(`
  SELECT 
    s.id as service_id,
    s.name as service_name,
    s.service_type,
    h.id as host_id,
    h.name as host_name,
    h.connection_type
  FROM services s
  INNER JOIN hosts h ON s.host_id = h.id
  WHERE s.service_type = 'ssh' 
    AND (h.connection_type IS NULL OR h.connection_type != 'ssh')
`).all();

if (typeMismatch.length > 0) {
  console.log(`   ⚠️  发现 ${typeMismatch.length} 个连接类型不匹配:\n`);
  
  typeMismatch.forEach((item, index) => {
    console.log(`   ${index + 1}. 服务: ${item.service_name} (SSH)`);
    console.log(`      - 主机: ${item.host_name}`);
    console.log(`      - 主机连接类型: ${item.connection_type || '(未设置)'}\n`);
  });
  
  issues.push({
    type: 'CONNECTION_TYPE_MISMATCH',
    count: typeMismatch.length,
    items: typeMismatch,
    warning: '这些服务可能无法正常监控，需要手动调整'
  });
  
  totalIssues += typeMismatch.length;
  
  console.log('   ℹ️  此问题需要手动处理：');
  console.log('      - 选项1: 将主机 connection_type 改为 ssh');
  console.log('      - 选项2: 将服务迁移到支持SSH的主机');
  console.log('      - 选项3: 修改服务的监控类型\n');
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 检查5: 孤儿服务（有host_id但主机无project_id） =====
console.log('📋 检查5: 孤儿服务检测');

const orphanServices = db.prepare(`
  SELECT 
    s.id,
    s.name as service_name,
    s.project_id,
    h.id as host_id,
    h.name as host_name,
    h.project_id as host_project_id
  FROM services s
  INNER JOIN hosts h ON s.host_id = h.id
  WHERE h.project_id IS NULL AND s.project_id IS NOT NULL
`).all();

if (orphanServices.length > 0) {
  console.log(`   ⚠️  发现 ${orphanServices.length} 个孤儿服务:\n`);
  
  orphanServices.forEach((item, index) => {
    console.log(`   ${index + 1}. 服务: ${item.service_name}`);
    console.log(`      - 服务项目ID: ${item.project_id}`);
    console.log(`      - 主机: ${item.host_name} (无项目归属)\n`);
  });
  
  issues.push({
    type: 'ORPHAN_SERVICES',
    count: orphanServices.length,
    items: orphanServices,
    suggestion: '建议将这些服务的 project_id 设为 NULL 或为主机分配项目'
  });
  
  totalIssues += orphanServices.length;
  
  if (autoFix) {
    console.log('   🔧 正在修复 (将服务 project_id 设为 NULL)...');
    const result = db.prepare(`
      UPDATE services 
      SET project_id = NULL, 
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id IN (SELECT id FROM hosts WHERE project_id IS NULL)
        AND project_id IS NOT NULL
    `).run();
    console.log(`   ✅ 已修复 ${result.changes} 个孤儿服务\n`);
  }
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 检查6: 重复的服务名称（同项目内） =====
console.log('📋 检查6: 重复服务名称检测');

const duplicateNames = db.prepare(`
  SELECT 
    s1.name,
    s1.project_id,
    p.name as project_name,
    COUNT(*) as count,
    GROUP_CONCAT(s1.id) as service_ids
  FROM services s1
  LEFT JOIN projects p ON s1.project_id = p.id
  GROUP BY s1.name, s1.project_id
  HAVING count > 1
`).all();

if (duplicateNames.length > 0) {
  console.log(`   ⚠️  发现 ${duplicateNames.length} 组重复服务名称:\n`);
  
  duplicateNames.forEach((item, index) => {
    console.log(`   ${index + 1}. 服务名: ${item.name}`);
    console.log(`      - 项目: ${item.project_name || '(未分配)'}`);
    console.log(`      - 重复次数: ${item.count}`);
    console.log(`      - 服务IDs: ${item.service_ids}\n`);
  });
  
  issues.push({
    type: 'DUPLICATE_SERVICE_NAMES',
    count: duplicateNames.length,
    items: duplicateNames,
    warning: '重复的服务名称可能导致混淆，建议重命名'
  });
  
  console.log('   ℹ️  此问题需要手动处理：重命名重复的服务\n');
} else {
  console.log('   ✅ 未发现问题\n');
}

// ===== 汇总报告 =====
console.log('=' .repeat(60));
console.log('📊 检查汇总\n');

if (totalIssues === 0) {
  console.log('✅ 恭喜！数据一致性检查通过，未发现任何问题。\n');
} else {
  console.log(`❌ 共发现 ${totalIssues} 个问题:\n`);
  
  issues.forEach(issue => {
    console.log(`   - ${issue.type}: ${issue.count} 个`);
  });
  
  console.log('');
  
  if (autoFix) {
    console.log('✅ 已自动修复可以自动修复的问题');
    console.log('⚠️  部分问题需要手动处理\n');
  } else {
    console.log('💡 运行 `node scripts/check-data-consistency.js --fix` 自动修复部分问题\n');
  }
}

// 显示统计信息
console.log('📈 数据库统计:');

const stats = db.prepare(`
  SELECT 
    (SELECT COUNT(*) FROM projects) as project_count,
    (SELECT COUNT(*) FROM hosts) as host_count,
    (SELECT COUNT(*) FROM services) as service_count,
    (SELECT COUNT(*) FROM hosts WHERE project_id IS NOT NULL) as hosts_with_project,
    (SELECT COUNT(*) FROM services WHERE project_id IS NOT NULL) as services_with_project,
    (SELECT COUNT(*) FROM services WHERE host_id IS NOT NULL) as services_with_host
`).get();

console.log(`   - 项目: ${stats.project_count}`);
console.log(`   - 主机: ${stats.host_count} (${stats.hosts_with_project} 个已分配项目)`);
console.log(`   - 服务: ${stats.service_count} (${stats.services_with_project} 个已分配项目, ${stats.services_with_host} 个已关联主机)`);

console.log('\n✅ 检查完成');

db.close();

// 如果有问题且未修复，以非零状态退出
if (totalIssues > 0 && !autoFix) {
  process.exit(1);
}
