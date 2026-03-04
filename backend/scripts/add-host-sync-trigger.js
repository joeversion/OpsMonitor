/**
 * Host IP/Hostname 同步触发器
 * 
 * 目的：当修改 Host 的 IP/Hostname 时，自动同步到关联服务的 host 字段
 * 
 * 背景：
 * - services.host 字段（deprecated）仍然被健康检查代码使用
 * - services.host_id 是外键，但需要手动同步 IP 字符串
 * - 修改 host IP 应该立即生效到所有相关服务的监控
 * 
 * 触发器功能：
 * 1. 当修改 hosts.ip 时，自动更新该主机下所有服务的 host 字段
 * 2. 确保服务健康检查使用最新的主机地址
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'monitor.db');
const db = new Database(dbPath);

console.log('🚀 开始添加 Host IP 同步触发器...\n');

try {
  // 1. 创建触发器：当 Host.ip 更新时，同步更新 ssh_host 和相关服务的 host 字段
  console.log('📝 创建触发器: sync_service_host_on_host_ip_update');
  
  db.exec(`
    -- 删除旧触发器（如果存在）
    DROP TRIGGER IF EXISTS sync_service_host_on_host_ip_update;
    
    -- 创建新触发器：同时更新 ssh_host 和 services.host
    CREATE TRIGGER sync_service_host_on_host_ip_update
    AFTER UPDATE OF ip ON hosts
    WHEN OLD.ip IS NOT NEW.ip  -- 只在 IP 真正变化时触发
    BEGIN
      -- 1. 同步更新 hosts.ssh_host（保持 IP 和 SSH 地址一致）
      UPDATE hosts 
      SET ssh_host = NEW.ip
      WHERE id = NEW.id;
      
      -- 2. 更新该主机下所有服务的 host 字段
      UPDATE services 
      SET host = NEW.ip,
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id = NEW.id;
      
      -- 日志记录（开发阶段可以启用）
      -- SELECT 'Host IP updated: ' || OLD.ip || ' -> ' || NEW.ip || 
      --        ', ssh_host synced, affected services: ' || changes() as log_message;
    END;
  `);
  
  console.log('✅ 触发器创建成功\n');
  
  // 2. 检查并修复现有的不一致问题
  console.log('🔍 检查现有数据一致性...');
  
  // 2.1 检查 ssh_host 与 ip 的一致性
  const sshHostInconsistencies = db.prepare(`
    SELECT id, name, ip, ssh_host
    FROM hosts
    WHERE connection_type = 'ssh' 
      AND (ssh_host != ip OR (ssh_host IS NULL AND ip IS NOT NULL))
  `).all();
  
  if (sshHostInconsistencies.length > 0) {
    console.log(`⚠️  发现 ${sshHostInconsistencies.length} 个 ssh_host 不一致：\n`);
    sshHostInconsistencies.forEach((h, index) => {
      console.log(`  ${index + 1}. 主机: ${h.name}`);
      console.log(`     - IP: ${h.ip || '(空)'}`);
      console.log(`     - SSH Host: ${h.ssh_host || '(空)'}\n`);
    });
    
    console.log('🔧 同步 ssh_host 到 ip...');
    const fixSSH = db.prepare('UPDATE hosts SET ssh_host = ip WHERE id = ?');
    sshHostInconsistencies.forEach(h => fixSSH.run(h.id));
    console.log(`✅ 已修复 ${sshHostInconsistencies.length} 个主机的 ssh_host\n`);
  } else {
    console.log('✅ ssh_host 与 ip 一致\n');
  }
  
  // 2.2 检查 services.host 与 hosts.ip 的一致性
  const inconsistencies = db.prepare(`
    SELECT 
      s.id as service_id,
      s.name as service_name,
      s.host as service_host,
      h.id as host_id,
      h.name as host_name,
      h.ip as host_ip
    FROM services s
    INNER JOIN hosts h ON s.host_id = h.id
    WHERE s.host != h.ip
       OR (s.host IS NULL AND h.ip IS NOT NULL)
       OR (s.host IS NOT NULL AND h.ip IS NULL)
  `).all();
  
  if (inconsistencies.length > 0) {
    console.log(`⚠️  发现 ${inconsistencies.length} 个 host 字段不一致问题：\n`);
    
    inconsistencies.forEach((item, index) => {
      console.log(`  ${index + 1}. 服务: ${item.service_name}`);
      console.log(`     - 服务 host 字段: ${item.service_host || '(空)'}`);
      console.log(`     - 主机 IP: ${item.host_ip || '(空)'}`);
      console.log(`     - 主机名称: ${item.host_name}\n`);
    });
    
    console.log('🔧 正在修复 host 字段不一致问题...');
    
    // 修复所有不一致
    const fixStmt = db.prepare(`
      UPDATE services 
      SET host = (SELECT ip FROM hosts WHERE hosts.id = services.host_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE host_id IS NOT NULL
        AND (
          host != (SELECT ip FROM hosts WHERE hosts.id = services.host_id)
          OR (host IS NULL AND (SELECT ip FROM hosts WHERE hosts.id = services.host_id) IS NOT NULL)
          OR (host IS NOT NULL AND (SELECT ip FROM hosts WHERE hosts.id = services.host_id) IS NULL)
        )
    `);
    
    const result = fixStmt.run();
    console.log(`✅ 已修复 ${result.changes} 个服务的 host 字段\n`);
  } else {
    console.log('✅ 未发现 host 字段不一致问题\n');
  }
  
  // 3. 验证触发器工作正常
  console.log('🧪 测试触发器功能...');
  
  // 查找一个测试用的主机
  const testHost = db.prepare(`
    SELECT h.id, h.name, h.ip, COUNT(s.id) as service_count
    FROM hosts h
    LEFT JOIN services s ON s.host_id = h.id
    WHERE s.id IS NOT NULL
    GROUP BY h.id
    LIMIT 1
  `).get();
  
  if (testHost) {
    console.log(`   使用主机: ${testHost.name} (有 ${testHost.service_count} 个服务)`);
    console.log(`   当前 IP: ${testHost.ip}`);
    
    // 获取服务的当前 host 字段
    const beforeServices = db.prepare(
      'SELECT id, name, host FROM services WHERE host_id = ? LIMIT 1'
    ).get(testHost.id);
    
    console.log(`   触发器测试前 - 服务 host: ${beforeServices.host}`);
    
    // 临时修改主机 IP
    const testIp = testHost.ip + '.test';
    db.prepare('UPDATE hosts SET ip = ? WHERE id = ?')
      .run(testIp, testHost.id);
    
    // 检查服务的 host 字段是否同步更新
    const afterServices = db.prepare(
      'SELECT id, name, host FROM services WHERE host_id = ? LIMIT 1'
    ).get(testHost.id);
    
    console.log(`   触发器测试后 - 服务 host: ${afterServices.host}`);
    
    // 恢复原始值
    db.prepare('UPDATE hosts SET ip = ? WHERE id = ?')
      .run(testHost.ip, testHost.id);
    
    const restored = db.prepare(
      'SELECT host FROM services WHERE host_id = ? LIMIT 1'
    ).get(testHost.id);
    
    console.log(`   恢复原值后 - 服务 host: ${restored.host}`);
    
    if (afterServices.host === testIp && restored.host === testHost.ip) {
      console.log('✅ 触发器工作正常\n');
    } else {
      console.log('⚠️  触发器可能未正常工作\n');
      console.log(`   预期: ${testIp} -> ${testHost.ip}`);
      console.log(`   实际: ${afterServices.host} -> ${restored.host}`);
    }
  } else {
    console.log('   ℹ️  没有合适的测试数据，跳过触发器测试\n');
  }
  
  // 4. 显示最终统计
  console.log('📊 数据统计：');
  
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT h.id) as host_count,
      COUNT(DISTINCT s.id) as service_count,
      COUNT(DISTINCT CASE WHEN s.host_id IS NOT NULL THEN s.id END) as services_with_host_id,
      COUNT(DISTINCT CASE WHEN s.host = h.ip THEN s.id END) as services_host_match
    FROM hosts h
    LEFT JOIN services s ON s.host_id = h.id
    WHERE s.id IS NOT NULL
  `).get();
  
  console.log(`   - 主机数: ${stats.host_count}`);
  console.log(`   - 服务数: ${stats.service_count}`);
  console.log(`   - 有 host_id 的服务: ${stats.services_with_host_id}`);
  console.log(`   - host 字段匹配的服务: ${stats.services_host_match}`);
  
  console.log('\n✅ Host IP 同步触发器安装完成！');
  console.log('\n📝 触发器功能：');
  console.log('   - 修改主机 IP 时：');
  console.log('     1. 自动同步 hosts.ssh_host = hosts.ip');
  console.log('     2. 自动同步该主机下所有服务的 host 字段');
  console.log('   - 确保 IP、SSH Host、服务监控地址三者保持一致');
  console.log('   - 健康检查使用最新的主机地址');
  
  console.log('\n⚠️  注意事项：');
  console.log('   - IP 和 SSH Host 始终保持一致（适用于直连场景）');
  console.log('   - 如果需要通过跳板机访问，请单独修改 ssh_host 字段');
  console.log('   - services.host 是 deprecated 字段，但仍被健康检查使用');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
