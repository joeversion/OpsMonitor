import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
// import { migrateHostsSSHConfig } from './migrate-hosts-ssh-config';
// import { migrateHostsRenameAddress } from './migrate-hosts-rename-address';
// import { migrateAddCheckConfigColumns } from './migrate-add-check-config-columns';

// 支持环境变量指定数据库路径，默认使用本地开发路径
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../monitor.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 先运行 schema.sql 创建基础表结构
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // 分割SQL语句并逐条执行，忽略索引创建失败（可能列不存在）
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (err: any) {
      // 如果是索引已存在或列不存在的错误，忽略
      if (err.message?.includes('already exists') || 
          err.message?.includes('no such column')) {
        console.log(`Skipping: ${err.message}`);
      } else {
        throw err;
      }
    }
  }
  
  // 然后运行迁移以确保旧数据库的表结构正确
  runMigrations();
  
  console.log('Database initialized');
}

function runMigrations() {
  // 运行 hosts 列重命名迁移 (address -> ip, connection_type values)
  // migrateHostsRenameAddress(db);
  
  // 运行 hosts SSH 配置迁移（Spec 013 - 从 security_configs 迁移到 hosts 表）
  // migrateHostsSSHConfig(db);
  
  // 运行新增 check config 列迁移 (支持多种监控类型)
  // migrateAddCheckConfigColumns(db);
  
  // 检查 services 表是否存在
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='services'
  `).get();
  
  if (tableExists) {
    // 如果表存在，运行services表相关的迁移
    // 检查 services 表是否有 project_id 列
    const columns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
    const hasProjectId = columns.some(col => col.name === 'project_id');
  
  if (!hasProjectId) {
    console.log('Running migration: add project_id to services...');
    db.exec('ALTER TABLE services ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL');
    console.log('Migration complete: project_id added to services');
  }

  // 检查 services 表是否有 layout_x/y 列
  const hasLayoutX = columns.some(col => col.name === 'layout_x');
  if (!hasLayoutX) {
    console.log('Running migration: add layout columns to services...');
    db.exec('ALTER TABLE services ADD COLUMN layout_x INTEGER');
    db.exec('ALTER TABLE services ADD COLUMN layout_y INTEGER');
    console.log('Migration complete: layout columns added to services');
  }
  
  // 检查 projects 表是否存在
  const projectsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='projects'
  `).get();
  
  if (!projectsTableExists) {
    console.log('Creating projects table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon_color TEXT DEFAULT 'blue',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Projects table created');
  }
  
  // 检查 security_configs 表是否有 affected_projects 列
  const securityConfigsExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='security_configs'
  `).get();
  
  if (securityConfigsExists) {
    const secColumns = db.prepare("PRAGMA table_info(security_configs)").all() as { name: string }[];
    const hasAffectedProjects = secColumns.some(col => col.name === 'affected_projects');
    
    if (!hasAffectedProjects) {
      console.log('Running migration: add affected_projects to security_configs...');
      db.exec('ALTER TABLE security_configs ADD COLUMN affected_projects TEXT');
      console.log('Migration complete: affected_projects added to security_configs');
    }
  }

  // Migration: extend check_records with output fields (idempotent)
  try {
    const checkRecordColumns = db.prepare("PRAGMA table_info(check_records)").all() as { name: string }[];
    const hasOutput = checkRecordColumns.some(col => col.name === 'output');
    const hasStdout = checkRecordColumns.some(col => col.name === 'stdout');
    const hasStderr = checkRecordColumns.some(col => col.name === 'stderr');
    const hasDetails = checkRecordColumns.some(col => col.name === 'details');
    if (!hasOutput) {
      console.log('Running migration: add output to check_records...');
      db.exec('ALTER TABLE check_records ADD COLUMN output TEXT');
    }
    if (!hasStdout) {
      console.log('Running migration: add stdout to check_records...');
      db.exec('ALTER TABLE check_records ADD COLUMN stdout TEXT');
    }
    if (!hasStderr) {
      console.log('Running migration: add stderr to check_records...');
      db.exec('ALTER TABLE check_records ADD COLUMN stderr TEXT');
    }
    if (!hasDetails) {
      console.log('Running migration: add details to check_records...');
      db.exec('ALTER TABLE check_records ADD COLUMN details TEXT');
    }
  } catch (err) {
    console.error('Migration error: extend check_records columns', err);
  }

  // Migration: relax services.check_type constraint to include file/log (recreate table if needed)
  // DISABLED: This migration is dangerous and can cause data loss
  // The backup database already has the correct schema with file/log support
  try {
    const servicesSqlRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='services'").get() as { sql?: string } | undefined;
    const servicesSql = servicesSqlRow?.sql || '';
    
    // Skip this migration - backup database already has correct schema
    if (false && servicesSql) {
      const hasFileCheck = servicesSql.includes("'file'") || servicesSql.includes('file"');
      const hasLogCheck = servicesSql.includes("'log'") || servicesSql.includes('log"');

      if (!hasFileCheck || !hasLogCheck) {
        console.log('Running migration: rebuild services table to allow file/log check types...');
        
        // Drop problematic trigger if exists (it blocks table modifications)
        db.exec('DROP TRIGGER IF EXISTS sync_service_project_on_host_update');

        db.exec(`
        CREATE TABLE services_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          project_id TEXT,
          host_id TEXT,
          description TEXT,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          check_type TEXT NOT NULL CHECK(check_type IN ('tcp','http','https','script','file','log','file-age','file-exists','docker-running','docker-health','command')),
          check_config TEXT,
          http_config TEXT,
          risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
          layer TEXT CHECK(layer IN ('frontend','backend','database','external')),
          check_interval INTEGER NOT NULL,
          warning_threshold INTEGER NOT NULL,
          error_threshold INTEGER NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          alert_enabled INTEGER NOT NULL DEFAULT 1,
          dependencies TEXT,
          layout_x INTEGER,
          layout_y INTEGER,
          service_type TEXT DEFAULT 'http' CHECK(service_type IN ('http','ssh')),
          ssh_config_id TEXT,
          ssh_check_type TEXT CHECK(ssh_check_type IN ('file-age','file-exists','docker-running','docker-health','command')),
          ssh_check_config TEXT,
          script_config TEXT,
          process_config TEXT,
          database_config TEXT,
          file_config TEXT,
          impact_description TEXT,
          custom_alert_template TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
          FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE SET NULL,
          FOREIGN KEY(ssh_config_id) REFERENCES security_configs(id) ON DELETE SET NULL
        );

        INSERT INTO services_new (
          id, name, project_id, host_id, description, host, port, check_type, check_config, http_config, risk_level, layer,
          check_interval, warning_threshold, error_threshold, enabled, alert_enabled, dependencies, layout_x, layout_y,
          service_type, ssh_config_id, ssh_check_type, ssh_check_config, script_config, process_config, database_config, file_config,
          impact_description, custom_alert_template, created_at, updated_at
        )
        SELECT id, name, project_id, host_id, description, host, port, check_type, check_config, http_config, risk_level, layer,
               check_interval, warning_threshold, error_threshold, enabled, alert_enabled, dependencies, layout_x, layout_y,
               service_type, ssh_config_id, ssh_check_type, ssh_check_config, script_config, process_config, database_config, file_config,
               impact_description, custom_alert_template, created_at, updated_at
        FROM services;

        DROP TABLE services;
        ALTER TABLE services_new RENAME TO services;
      `);
      console.log('Migration complete: services table rebuilt with file/log check types');
      }
    }
  } catch (err) {
    console.error('Migration error: rebuild services table', err);
  }
  
  // 检查 service_dependencies 表是否存在
  const dependenciesTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='service_dependencies'
  `).get();

  if (!dependenciesTableExists) {
    console.log('Creating service_dependencies table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS service_dependencies (
        id TEXT PRIMARY KEY,
        source_service_id TEXT NOT NULL,
        target_service_id TEXT,
        target_resource_id TEXT,
        dependency_type TEXT NOT NULL,
        risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(source_service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY(target_service_id) REFERENCES services(id) ON DELETE CASCADE
      )
    `);
    console.log('service_dependencies table created');
  } else {
    // 检查是否需要迁移移除 CHECK 约束（旧表有硬编码的 dependency_type 约束）
    // 通过尝试插入一个自定义类型来检测
    try {
      const testId = 'migration-test-' + Date.now();
      db.prepare(`INSERT INTO service_dependencies (id, source_service_id, dependency_type) VALUES (?, 'test', 'custom_test_type')`).run(testId);
      // 如果成功，删除测试数据
      db.prepare('DELETE FROM service_dependencies WHERE id = ?').run(testId);
    } catch (err: any) {
      if (err.message?.includes('CHECK constraint failed')) {
        console.log('Running migration: remove dependency_type CHECK constraint...');
        db.exec(`
          -- 创建新表（无 dependency_type CHECK 约束）
          CREATE TABLE service_dependencies_new (
            id TEXT PRIMARY KEY,
            source_service_id TEXT NOT NULL,
            target_service_id TEXT,
            target_resource_id TEXT,
            dependency_type TEXT NOT NULL,
            risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(source_service_id) REFERENCES services(id) ON DELETE CASCADE,
            FOREIGN KEY(target_service_id) REFERENCES services(id) ON DELETE CASCADE
          );
          
          -- 复制数据
          INSERT INTO service_dependencies_new 
          SELECT * FROM service_dependencies;
          
          -- 删除旧表
          DROP TABLE service_dependencies;
          
          -- 重命名新表
          ALTER TABLE service_dependencies_new RENAME TO service_dependencies;
          
          -- 重建索引
          CREATE INDEX IF NOT EXISTS idx_service_dependencies_source ON service_dependencies(source_service_id);
          CREATE INDEX IF NOT EXISTS idx_service_dependencies_target ON service_dependencies(target_service_id);
        `);
        console.log('Migration complete: dependency_type CHECK constraint removed');
      }
    }
    
    // 检查 service_dependencies 表是否有 impact_description 和 custom_alert_template 列
    const depColumns = db.prepare("PRAGMA table_info(service_dependencies)").all() as { name: string }[];
    const hasImpactDescription = depColumns.some(col => col.name === 'impact_description');
    const hasCustomAlertTemplate = depColumns.some(col => col.name === 'custom_alert_template');
    
    if (!hasImpactDescription) {
      console.log('Running migration: add impact_description to service_dependencies...');
      db.exec('ALTER TABLE service_dependencies ADD COLUMN impact_description TEXT');
      console.log('Migration complete: impact_description added to service_dependencies');
    }
    
    if (!hasCustomAlertTemplate) {
      console.log('Running migration: add custom_alert_template to service_dependencies...');
      db.exec('ALTER TABLE service_dependencies ADD COLUMN custom_alert_template TEXT');
      console.log('Migration complete: custom_alert_template added to service_dependencies');
    }
    
    // Check for link_direction column and fix old CHECK constraint
    const depsColsForDirection = db.prepare("PRAGMA table_info(service_dependencies)").all() as { name: string }[];
    const existingColumnNames = depsColsForDirection.map(col => col.name);
    const hasLinkDirection = existingColumnNames.includes('link_direction');
    
    if (!hasLinkDirection) {
      // Add new column without CHECK constraint
      console.log('Running migration: add link_direction to service_dependencies...');
      db.exec("ALTER TABLE service_dependencies ADD COLUMN link_direction TEXT DEFAULT 'normal'");
      console.log('Migration complete: link_direction added to service_dependencies');
    } else {
      // Check if we have old CHECK constraint by looking at table SQL
      const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='service_dependencies'
      `).get() as { sql: string } | undefined;
      
      if (tableInfo && tableInfo.sql && tableInfo.sql.includes("link_direction IN ('auto', 'TB', 'BT', 'LR', 'RL')")) {
        // Need to rebuild table to remove old CHECK constraint
        console.log('Running migration: rebuilding service_dependencies to fix link_direction constraint...');
        
        // Build column list dynamically based on what exists in old table
        const newTableColumns = [
          'id', 'source_service_id', 'target_service_id', 'dependency_type', 'description',
          'created_at', 'updated_at', 'project_id', 'source_project_id', 'target_project_id',
          'impact_description', 'custom_alert_template', 'link_direction'
        ];
        
        // Only copy columns that exist in the old table (except link_direction which we handle specially)
        const columnsToCopy = newTableColumns.filter(col => 
          col === 'link_direction' || existingColumnNames.includes(col)
        );
        
        // Build SELECT part - handle link_direction conversion
        const selectParts = columnsToCopy.map(col => {
          if (col === 'link_direction') {
            return `CASE WHEN link_direction IS NULL OR link_direction IN ('auto', 'TB', 'BT', 'LR', 'RL') THEN 'normal' ELSE link_direction END`;
          }
          return col;
        });
        
        // Disable foreign key checks temporarily for migration
        db.exec(`PRAGMA foreign_keys = OFF;`);
        
        // Drop temp table if it exists from a failed previous migration
        db.exec(`DROP TABLE IF EXISTS service_dependencies_new;`);
        
        db.exec(`
          -- Create new table without CHECK constraints (to support any existing data)
          CREATE TABLE service_dependencies_new (
            id TEXT PRIMARY KEY,
            source_service_id TEXT NOT NULL,
            target_service_id TEXT NOT NULL,
            dependency_type TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            project_id TEXT DEFAULT 'default',
            source_project_id TEXT,
            target_project_id TEXT,
            impact_description TEXT,
            custom_alert_template TEXT,
            link_direction TEXT DEFAULT 'normal',
            UNIQUE(source_service_id, target_service_id)
          );
        `);
        
        // Insert data from old table
        db.exec(`
          INSERT INTO service_dependencies_new (${columnsToCopy.join(', ')})
          SELECT ${selectParts.join(', ')}
          FROM service_dependencies;
        `);
        
        db.exec(`
          -- Drop old table and rename new one
          DROP TABLE service_dependencies;
          ALTER TABLE service_dependencies_new RENAME TO service_dependencies;
        `);
        
        // Re-enable foreign key checks
        db.exec(`PRAGMA foreign_keys = ON;`);
        
        console.log('Migration complete: service_dependencies table rebuilt with new link_direction format');
      }
    }
    
    // === Bug Fix: Change ON DELETE CASCADE to ON DELETE RESTRICT ===
    // CASCADE causes all dependencies to be deleted when any service is deleted
    // This is dangerous and can cause accidental data loss
    const tableInfo = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='service_dependencies'
    `).get() as { sql: string } | undefined;
    
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('ON DELETE CASCADE')) {
      console.log('Running migration: fix ON DELETE CASCADE in service_dependencies...');
      console.log('WARNING: This will change foreign key behavior from CASCADE to RESTRICT');
      
      // Get all columns from current table
      const columns = db.prepare("PRAGMA table_info(service_dependencies)").all() as { name: string }[];
      const columnNames = columns.map(c => c.name);
      
      // Disable foreign keys temporarily
      db.exec(`PRAGMA foreign_keys = OFF;`);
      
      // Drop temp table if exists
      db.exec(`DROP TABLE IF EXISTS service_dependencies_new;`);
      
      // Create new table with RESTRICT instead of CASCADE
      db.exec(`
        CREATE TABLE service_dependencies_new (
          id TEXT PRIMARY KEY,
          source_service_id TEXT NOT NULL,
          target_service_id TEXT,
          target_resource_id TEXT,
          dependency_type TEXT NOT NULL,
          risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          impact_description TEXT,
          custom_alert_template TEXT,
          link_direction TEXT DEFAULT 'normal',
          FOREIGN KEY(source_service_id) REFERENCES services(id) ON DELETE RESTRICT,
          FOREIGN KEY(target_service_id) REFERENCES services(id) ON DELETE RESTRICT
        );
      `);
      
      // Copy all data
      db.exec(`
        INSERT INTO service_dependencies_new 
        SELECT * FROM service_dependencies;
      `);
      
      // Drop old table and rename
      db.exec(`
        DROP TABLE service_dependencies;
        ALTER TABLE service_dependencies_new RENAME TO service_dependencies;
      `);
      
      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_service_dependencies_source ON service_dependencies(source_service_id);
        CREATE INDEX IF NOT EXISTS idx_service_dependencies_target ON service_dependencies(target_service_id);
      `);
      
      // Re-enable foreign keys
      db.exec(`PRAGMA foreign_keys = ON;`);
      
      console.log('Migration complete: ON DELETE CASCADE changed to RESTRICT');
      console.log('Note: Services with dependencies must have dependencies removed before deletion');
    }
  }

  // 检查 alerts 表是否有 security_config_id 列
  const alertsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='alerts'
  `).get();

  if (alertsTableExists) {
    const alertColumns = db.prepare("PRAGMA table_info(alerts)").all() as { name: string }[];
    const hasSecurityConfigId = alertColumns.some(col => col.name === 'security_config_id');
    
    if (!hasSecurityConfigId) {
      console.log('Running migration: add security_config_id to alerts...');
      db.exec('ALTER TABLE alerts ADD COLUMN security_config_id TEXT REFERENCES security_configs(id) ON DELETE CASCADE');
      console.log('Migration complete: security_config_id added to alerts');
    }
    
    // Make service_id nullable if it's not already
    // SQLite doesn't support directly modifying column constraints, so we check if we need to do anything

    // Add acknowledged column for bell icon read/unread tracking
    const hasAcknowledged = alertColumns.some(col => col.name === 'acknowledged');
    if (!hasAcknowledged) {
      console.log('Running migration: add acknowledged to alerts...');
      db.exec('ALTER TABLE alerts ADD COLUMN acknowledged INTEGER NOT NULL DEFAULT 0');
      console.log('Migration complete: acknowledged added to alerts');
    }
  }

  // 检查 services 表是否有 layer 列
  const servicesColumns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasLayer = servicesColumns.some(col => col.name === 'layer');

  if (!hasLayer) {
    console.log('Running migration: add layer to services...');
    db.exec("ALTER TABLE services ADD COLUMN layer TEXT CHECK(layer IN ('frontend', 'backend', 'database', 'external'))");
    console.log('Migration complete: layer added to services');
  }

  // 检查 services 表是否有 impact_description 和 custom_alert_template 列
  const svcColsForAlert = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const svcHasImpactDescription = svcColsForAlert.some(col => col.name === 'impact_description');
  const svcHasCustomAlertTemplate = svcColsForAlert.some(col => col.name === 'custom_alert_template');
  
  if (!svcHasImpactDescription) {
    console.log('Running migration: add impact_description to services...');
    db.exec('ALTER TABLE services ADD COLUMN impact_description TEXT');
    console.log('Migration complete: impact_description added to services');
  }
  
  if (!svcHasCustomAlertTemplate) {
    console.log('Running migration: add custom_alert_template to services...');
    db.exec('ALTER TABLE services ADD COLUMN custom_alert_template TEXT');
    console.log('Migration complete: custom_alert_template added to services');
  }

  // 检查 services 表是否有 check_config 列
  const svcColsForCheck = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasCheckConfig = svcColsForCheck.some(col => col.name === 'check_config');
  
  if (!hasCheckConfig) {
    console.log('Running migration: add check_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN check_config TEXT');
    console.log('Migration complete: check_config added to services');
  }

  // 检查 services 表是否有 SSH 监控相关列
  const svcColsForSSH = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasServiceType = svcColsForSSH.some(col => col.name === 'service_type');
  const hasSshConfigId = svcColsForSSH.some(col => col.name === 'ssh_config_id');
  const hasSshCheckType = svcColsForSSH.some(col => col.name === 'ssh_check_type');
  const hasSshCheckConfig = svcColsForSSH.some(col => col.name === 'ssh_check_config');
  const hasHostId = svcColsForSSH.some(col => col.name === 'host_id');
  
  if (!hasServiceType) {
    console.log('Running migration: add service_type to services...');
    db.exec("ALTER TABLE services ADD COLUMN service_type TEXT DEFAULT 'http' CHECK(service_type IN ('http', 'ssh'))");
    console.log('Migration complete: service_type added to services');
  }
  
  if (!hasSshConfigId) {
    console.log('Running migration: add ssh_config_id to services...');
    db.exec('ALTER TABLE services ADD COLUMN ssh_config_id TEXT REFERENCES security_configs(id) ON DELETE SET NULL');
    console.log('Migration complete: ssh_config_id added to services');
  }
  
  if (!hasSshCheckType) {
    console.log('Running migration: add ssh_check_type to services...');
    db.exec("ALTER TABLE services ADD COLUMN ssh_check_type TEXT CHECK(ssh_check_type IN ('file-age', 'file-exists', 'docker-running', 'docker-health', 'command'))");
    console.log('Migration complete: ssh_check_type added to services');
  }
  
  if (!hasSshCheckConfig) {
    console.log('Running migration: add ssh_check_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN ssh_check_config TEXT');
    console.log('Migration complete: ssh_check_config added to services');
  }

  if (!hasHostId) {
    console.log('Running migration: add host_id to services...');
    db.exec('ALTER TABLE services ADD COLUMN host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL');
    console.log('Migration complete: host_id added to services');
  }

  // 检查 services 表是否有新的配置字段（脚本、进程、数据库、文件监控）
  const svcColsForNewConfigs = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasScriptConfig = svcColsForNewConfigs.some(col => col.name === 'script_config');
  const hasProcessConfig = svcColsForNewConfigs.some(col => col.name === 'process_config');
  const hasDatabaseConfig = svcColsForNewConfigs.some(col => col.name === 'database_config');
  const hasFileConfig = svcColsForNewConfigs.some(col => col.name === 'file_config');
  const hasIcon = svcColsForNewConfigs.some(col => col.name === 'icon');
  
  if (!hasScriptConfig) {
    console.log('Running migration: add script_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN script_config TEXT');
    console.log('Migration complete: script_config added to services');
  }
  
  if (!hasProcessConfig) {
    console.log('Running migration: add process_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN process_config TEXT');
    console.log('Migration complete: process_config added to services');
  }
  
  if (!hasDatabaseConfig) {
    console.log('Running migration: add database_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN database_config TEXT');
    console.log('Migration complete: database_config added to services');
  }
  
  if (!hasFileConfig) {
    console.log('Running migration: add file_config to services...');
    db.exec('ALTER TABLE services ADD COLUMN file_config TEXT');
    console.log('Migration complete: file_config added to services');
  }
  
  if (!hasIcon) {
    console.log('Running migration: add icon to services...');
    db.exec('ALTER TABLE services ADD COLUMN icon TEXT');
    console.log('Migration complete: icon added to services');
  }
  } // End of if (tableExists) for services table

  // 检查 hosts 表是否存在 (Spec 013)
  const hostsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='hosts'
  `).get();
  
  if (!hostsTableExists) {
    console.log('Creating hosts table (Spec 013)...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS hosts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip TEXT NOT NULL,
        project_id TEXT,
        connection_type TEXT NOT NULL DEFAULT 'ssh' CHECK(connection_type IN ('ssh', 'local')),
        ssh_host TEXT,
        ssh_port INTEGER DEFAULT 22,
        ssh_username TEXT,
        ssh_auth_type TEXT CHECK(ssh_auth_type IN ('password', 'private_key')),
        ssh_password TEXT,
        ssh_private_key TEXT,
        ssh_passphrase TEXT,
        ssh_proxy_host TEXT,
        ssh_proxy_port INTEGER,
        description TEXT,
        tags TEXT,
        last_test_status TEXT,
        last_test_at DATETIME,
        last_test_message TEXT,
        last_test_latency INTEGER,
        ssh_max_retries INTEGER DEFAULT 3,
        ssh_retry_delay INTEGER DEFAULT 2000,
        ssh_connection_timeout INTEGER DEFAULT 10000,
        ssh_command_timeout INTEGER DEFAULT 30000,
        check_interval INTEGER DEFAULT 300,
        schedule_type TEXT DEFAULT 'fixed',
        schedule_config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hosts_project_id ON hosts(project_id);
      CREATE INDEX IF NOT EXISTS idx_services_host_id ON services(host_id);
    `);
    console.log('Hosts table created with all fields (Spec 013 + Spec 020)');
  } else {
    // 检查 hosts 表是否有测试状态字段
    const hostColumns = db.prepare("PRAGMA table_info(hosts)").all() as { name: string }[];
    const hasLastTestStatus = hostColumns.some(col => col.name === 'last_test_status');
    const hasLastTestAt = hostColumns.some(col => col.name === 'last_test_at');
    const hasLastTestMessage = hostColumns.some(col => col.name === 'last_test_message');
    const hasLastTestLatency = hostColumns.some(col => col.name === 'last_test_latency');
    
    if (!hasLastTestStatus) {
      console.log('Running migration: add last_test_status to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN last_test_status TEXT');
      console.log('Migration complete: last_test_status added to hosts');
    }
    
    if (!hasLastTestAt) {
      console.log('Running migration: add last_test_at to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN last_test_at DATETIME');
      console.log('Migration complete: last_test_at added to hosts');
    }
    
    if (!hasLastTestMessage) {
      console.log('Running migration: add last_test_message to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN last_test_message TEXT');
      console.log('Migration complete: last_test_message added to hosts');
    }
    
    if (!hasLastTestLatency) {
      console.log('Running migration: add last_test_latency to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN last_test_latency INTEGER');
      console.log('Migration complete: last_test_latency added to hosts');
    }
    
    // Add SSH connection settings per host
    const hasSshMaxRetries = hostColumns.some(col => col.name === 'ssh_max_retries');
    const hasSshRetryDelay = hostColumns.some(col => col.name === 'ssh_retry_delay');
    const hasSshConnectionTimeout = hostColumns.some(col => col.name === 'ssh_connection_timeout');
    const hasSshCommandTimeout = hostColumns.some(col => col.name === 'ssh_command_timeout');
    
    if (!hasSshMaxRetries) {
      console.log('Running migration: add ssh_max_retries to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN ssh_max_retries INTEGER DEFAULT 3');
      console.log('Migration complete: ssh_max_retries added to hosts');
    }
    
    if (!hasSshRetryDelay) {
      console.log('Running migration: add ssh_retry_delay to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN ssh_retry_delay INTEGER DEFAULT 2000');
      console.log('Migration complete: ssh_retry_delay added to hosts');
    }
    
    if (!hasSshConnectionTimeout) {
      console.log('Running migration: add ssh_connection_timeout to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN ssh_connection_timeout INTEGER DEFAULT 10000');
      console.log('Migration complete: ssh_connection_timeout added to hosts');
    }
    
    if (!hasSshCommandTimeout) {
      console.log('Running migration: add ssh_command_timeout to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN ssh_command_timeout INTEGER DEFAULT 30000');
      console.log('Migration complete: ssh_command_timeout added to hosts');
    }
    
    // Add host check interval per host
    const hasCheckInterval = hostColumns.some(col => col.name === 'check_interval');
    if (!hasCheckInterval) {
      console.log('Running migration: add check_interval to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN check_interval INTEGER DEFAULT 300');
      console.log('Migration complete: check_interval added to hosts');
    }

    // Add schedule configuration fields to hosts
    const hasScheduleType = hostColumns.some(col => col.name === 'schedule_type');
    if (!hasScheduleType) {
      console.log('Running migration: add schedule_type to hosts...');
      db.exec("ALTER TABLE hosts ADD COLUMN schedule_type TEXT DEFAULT 'fixed'");
      console.log('Migration complete: schedule_type added to hosts');
    }

    const hasScheduleConfig = hostColumns.some(col => col.name === 'schedule_config');
    if (!hasScheduleConfig) {
      console.log('Running migration: add schedule_config to hosts...');
      db.exec('ALTER TABLE hosts ADD COLUMN schedule_config TEXT');
      console.log('Migration complete: schedule_config added to hosts');
    }

    // Add enabled field for monitoring toggle (Spec 027)
    const hasEnabled = hostColumns.some(col => col.name === 'enabled');
    if (!hasEnabled) {
      console.log('Running migration: add enabled to hosts (Spec 027)...');
      db.exec('ALTER TABLE hosts ADD COLUMN enabled INTEGER DEFAULT 1');
      console.log('Migration complete: enabled added to hosts (default: 1=enabled)');
    }
  }

  // Add schedule configuration fields to services (only if table exists)
  const servicesExistsForSchedule = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='services'
  `).get();
  
  if (servicesExistsForSchedule) {
    const serviceColumns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
    const hasServiceScheduleType = serviceColumns.some(col => col.name === 'schedule_type');
    if (!hasServiceScheduleType) {
      console.log('Running migration: add schedule_type to services...');
      db.exec("ALTER TABLE services ADD COLUMN schedule_type TEXT DEFAULT 'fixed'");
      console.log('Migration complete: schedule_type added to services');
    }

    const hasServiceScheduleConfig = serviceColumns.some(col => col.name === 'schedule_config');
    if (!hasServiceScheduleConfig) {
      console.log('Running migration: add schedule_config to services...');
      db.exec('ALTER TABLE services ADD COLUMN schedule_config TEXT');
      console.log('Migration complete: schedule_config added to services');
    }
  }

  // 检查并删除 group_name 列（如果存在）
  // 重新获取列信息以确保是最新的
  const currentColumns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasGroupName = currentColumns.some(col => col.name === 'group_name');
  
  if (hasGroupName) {
    console.log('Running migration: remove group_name from services...');
    
    // SQLite 不支持 DROP COLUMN，需要重建表
    db.exec(`
      -- 创建临时表
      CREATE TABLE services_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_id TEXT,
        description TEXT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        check_type TEXT NOT NULL CHECK(check_type IN ('tcp', 'http', 'https', 'script')),
        http_config TEXT,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
        layer TEXT CHECK(layer IN ('frontend', 'backend', 'database', 'external')),
        check_interval INTEGER NOT NULL,
        warning_threshold INTEGER NOT NULL,
        error_threshold INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        alert_enabled INTEGER NOT NULL DEFAULT 1,
        dependencies TEXT,
        layout_x INTEGER,
        layout_y INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
      );
      
      -- 复制数据（排除 group_name）
      INSERT INTO services_new (
        id, name, project_id, description, host, port, check_type,
        http_config, risk_level, layer, check_interval, warning_threshold,
        error_threshold, enabled, alert_enabled, dependencies, layout_x, layout_y,
        created_at, updated_at
      )
      SELECT 
        id, name, project_id, description, host, port, check_type,
        http_config, risk_level, layer, check_interval, warning_threshold,
        error_threshold, enabled, alert_enabled, dependencies, layout_x, layout_y,
        created_at, updated_at
      FROM services;
      
      -- 删除旧表
      DROP TABLE services;
      
      -- 重命名新表
      ALTER TABLE services_new RENAME TO services;
      
      -- 重建索引
      CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
    `);
    
    console.log('Migration complete: group_name removed from services');
  }

  // 检查 security_configs 表是否有 SSH 相关列
  const securityConfigsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='security_configs'
  `).get();

  if (securityConfigsTableExists) {
    const secConfigCols = db.prepare("PRAGMA table_info(security_configs)").all() as { name: string }[];
    const secConfigColNames = secConfigCols.map(col => col.name);
    
    // Check and add last_status field for recovery notifications
    if (!secConfigColNames.includes('last_status')) {
      console.log('Running migration: add last_status to security_configs...');
      db.exec("ALTER TABLE security_configs ADD COLUMN last_status TEXT DEFAULT 'normal' CHECK(last_status IN ('normal', 'warning', 'critical', 'expired'))");
      
      // Initialize last_status for existing records
      const configs = db.prepare('SELECT id, expiry_date FROM security_configs').all() as any[];
      const updateStmt = db.prepare('UPDATE security_configs SET last_status = ? WHERE id = ?');
      
      configs.forEach((config: any) => {
        const expiry = new Date(config.expiry_date);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status = 'normal';
        if (daysRemaining <= 0) status = 'expired';
        else if (daysRemaining <= 3) status = 'critical';
        else if (daysRemaining <= 7) status = 'warning';
        
        updateStmt.run(status, config.id);
      });
      
      console.log(`Migration complete: last_status added and initialized for ${configs.length} configs`);
    }
    
    const sshColumns = [
      'ssh_host', 'ssh_port', 'ssh_username', 'ssh_auth_type', 
      'ssh_credential', 'ssh_passphrase', 'ssh_proxy_host', 'ssh_proxy_port',
      'ssh_proxy_username', 'ssh_proxy_auth_type', 'ssh_proxy_credential'
    ];
    
    for (const colName of sshColumns) {
      if (!secConfigColNames.includes(colName)) {
        console.log(`Running migration: add ${colName} to security_configs...`);
        
        // 根据列类型添加适当的定义
        let colDef = 'TEXT';
        if (colName === 'ssh_port' || colName === 'ssh_proxy_port') {
          colDef = 'INTEGER DEFAULT 22';
        } else if (colName === 'ssh_auth_type' || colName === 'ssh_proxy_auth_type') {
          colDef = "TEXT CHECK(" + colName + " IN ('password', 'private_key'))";
        }
        
        db.exec(`ALTER TABLE security_configs ADD COLUMN ${colName} ${colDef}`);
        console.log(`Migration complete: ${colName} added to security_configs`);
      }
    }
  }

  // 检查 users 表是否存在
  const usersTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='users'
  `).get();

  if (!usersTableExists) {
    console.log('Creating users table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('Users table created');
  }

  // 检查 dependency_types 表是否存在
  const dependencyTypesTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='dependency_types'
  `).get();

  if (!dependencyTypesTableExists) {
    console.log('Creating dependency_types table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS dependency_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        icon TEXT DEFAULT '🔗',
        description TEXT,
        color TEXT DEFAULT '#6366f1',
        is_system INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT OR IGNORE INTO dependency_types (id, name, label, icon, description, color, is_system, sort_order) VALUES
        ('type-depends', 'depends', 'Depends', '🔗', 'Strong dependency, must be available', '#ef4444', 1, 1),
        ('type-uses', 'uses', 'Uses', '📡', 'Weak dependency, can degrade', '#6366f1', 1, 2),
        ('type-sync', 'sync', 'Sync', '🔄', 'Data synchronization relationship', '#06b6d4', 1, 3),
        ('type-backup', 'backup', 'Backup', '💾', 'Backup/redundancy relationship', '#10b981', 1, 4);
    `);
    console.log('dependency_types table created');
  }

  // 检查 grafana_dashboards 表是否存在
  const grafanaTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='grafana_dashboards'
  `).get();

  if (!grafanaTableExists) {
    console.log('Creating grafana_dashboards table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS grafana_dashboards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        project_id TEXT,
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
      );
      CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_project ON grafana_dashboards(project_id);
      CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_service ON grafana_dashboards(service_id);
    `);
    console.log('grafana_dashboards table created');
  }

  // === Bug #006 Fix: Add composite index for check_records performance ===
  console.log('Running migration: add composite index for check_records...');
  
  // Check if the composite index already exists
  const indexExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND name='idx_check_records_service_checked'
  `).get();
  
  if (!indexExists) {
    try {
      db.exec(`
        CREATE INDEX idx_check_records_service_checked 
        ON check_records(service_id, checked_at DESC)
      `);
      console.log('Migration complete: composite index created for faster latest status queries');
    } catch (err: any) {
      console.error('Failed to create composite index:', err.message);
    }
  } else {
    console.log('Composite index already exists, skipping');
  }

  // === General Settings: Initialize default system configs ===
  console.log('Initializing General Settings defaults...');
  
  const configKeys = ['default_check_interval', 'default_warning_threshold', 'default_error_threshold', 'data_retention_days'];
  const existingConfigs = db.prepare(`
    SELECT key FROM system_configs WHERE key IN (?, ?, ?, ?)
  `).all(...configKeys) as { key: string }[];
  const existingKeys = new Set(existingConfigs.map(c => c.key));
  
  const configDefaults = [
    ['default_check_interval', '60', 'Default health check interval in seconds for new services'],
    ['default_warning_threshold', '3', 'Default consecutive failures before warning status'],
    ['default_error_threshold', '5', 'Default consecutive failures before error status'],
    ['data_retention_days', '30', 'Days to retain check records in database']
  ];
  
  const insertConfig = db.prepare('INSERT INTO system_configs (key, value, description) VALUES (?, ?, ?)');
  for (const [key, value, description] of configDefaults) {
    if (!existingKeys.has(key)) {
      insertConfig.run(key, value, description);
      console.log(`Initialized config: ${key} = ${value}`);
    }
  }

  // === System Settings: Initialize timezone and global settings ===
  console.log('Checking system_settings table...');
  
  const systemSettingsExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='system_settings'
  `).get();

  if (!systemSettingsExists) {
    console.log('Creating system_settings table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('system_settings table created');
  }

  // Initialize default system settings
  const settingDefaults = [
    ['timezone', 'UTC', 'System timezone for logs and timestamps (e.g., Asia/Shanghai, UTC, America/New_York)'],
    ['date_format', 'YYYY-MM-DD HH:mm:ss', 'Date format for display'],
    ['log_retention_days', '30', 'Number of days to keep logs'],
    // SSH connection settings for network stability
    ['ssh_max_retries', '3', 'Maximum number of SSH connection retry attempts (1-10)'],
    ['ssh_retry_delay', '2000', 'Delay between SSH retry attempts in milliseconds (1000-10000)'],
    ['ssh_connection_timeout', '10000', 'SSH connection timeout in milliseconds (5000-60000)'],
    ['ssh_command_timeout', '30000', 'SSH command execution timeout in milliseconds (10000-300000)']
  ];
  
  const settingKeys = settingDefaults.map(s => s[0]);
  const placeholders = settingKeys.map(() => '?').join(', ');
  const existingSettings = db.prepare(`
    SELECT key FROM system_settings WHERE key IN (${placeholders})
  `).all(...settingKeys) as { key: string }[];
  const existingSettingKeys = new Set(existingSettings.map(s => s.key));
  
  const insertSetting = db.prepare('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)');
  for (const [key, value, description] of settingDefaults) {
    if (!existingSettingKeys.has(key)) {
      insertSetting.run(key, value, description);
      console.log(`Initialized system setting: ${key} = ${value}`);
    }
  }

  // === Network Stability Alert Enhancement ===
  // Add failure_threshold and current_failure_count to services table
  // This allows users to configure consecutive failures before alerting
  console.log('Checking services table for network stability fields...');
  const servicesColumnsForStability = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  const hasFailureThreshold = servicesColumnsForStability.some(col => col.name === 'failure_threshold');
  const hasCurrentFailureCount = servicesColumnsForStability.some(col => col.name === 'current_failure_count');
  
  if (!hasFailureThreshold) {
    console.log('Running migration: add failure_threshold to services...');
    db.exec('ALTER TABLE services ADD COLUMN failure_threshold INTEGER DEFAULT 3');
    console.log('Migration complete: failure_threshold added to services (default: 3 consecutive failures)');
  }
  
  if (!hasCurrentFailureCount) {
    console.log('Running migration: add current_failure_count to services...');
    db.exec('ALTER TABLE services ADD COLUMN current_failure_count INTEGER DEFAULT 0');
    console.log('Migration complete: current_failure_count added to services');
  }

  // === Fix risk_level constraint to include 'critical' ===
  // Check if services table has old constraint (without 'critical')
  const servicesTableSql = db.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='services'
  `).get() as { sql: string } | undefined;

  if (servicesTableSql && !servicesTableSql.sql.includes("'critical'")) {
    console.log('Running migration: fix services risk_level constraint to include critical...');
    
    // Get current columns to rebuild table
    const currentCols = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
    const colNames = currentCols.map(c => c.name);
    
    // Disable foreign keys for migration
    db.exec('PRAGMA foreign_keys=OFF');
    
    // Drop temp table if exists from partial migration
    db.exec('DROP TABLE IF EXISTS services_risk_fix');
    
    db.exec(`
      CREATE TABLE services_risk_fix (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_id TEXT,
        host_id TEXT,
        description TEXT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        check_type TEXT NOT NULL CHECK(check_type IN ('tcp','http','https','script','file','log','file-age','file-exists','docker-running','docker-health','command')),
        check_config TEXT,
        http_config TEXT,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
        layer TEXT CHECK(layer IN ('frontend','backend','database','external')),
        check_interval INTEGER NOT NULL,
        warning_threshold INTEGER NOT NULL,
        error_threshold INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        alert_enabled INTEGER NOT NULL DEFAULT 1,
        dependencies TEXT,
        layout_x INTEGER,
        layout_y INTEGER,
        service_type TEXT DEFAULT 'http' CHECK(service_type IN ('http','ssh')),
        ssh_config_id TEXT,
        ssh_check_type TEXT CHECK(ssh_check_type IN ('file-age','file-exists','docker-running','docker-health','command')),
        ssh_check_config TEXT,
        script_config TEXT,
        process_config TEXT,
        database_config TEXT,
        file_config TEXT,
        impact_description TEXT,
        custom_alert_template TEXT,
        schedule_type TEXT DEFAULT 'fixed',
        schedule_config TEXT,
        failure_threshold INTEGER DEFAULT 3,
        current_failure_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE SET NULL,
        FOREIGN KEY(ssh_config_id) REFERENCES security_configs(id) ON DELETE SET NULL
      );
      
      INSERT INTO services_risk_fix (
        id, name, project_id, host_id, description, host, port, check_type, check_config, http_config,
        risk_level, layer, check_interval, warning_threshold, error_threshold, enabled, alert_enabled,
        dependencies, layout_x, layout_y, service_type, ssh_config_id, ssh_check_type, ssh_check_config,
        script_config, process_config, database_config, file_config, impact_description, custom_alert_template,
        schedule_type, schedule_config, failure_threshold, current_failure_count, created_at, updated_at
      )
      SELECT 
        id, name, project_id, host_id, description, host, port, check_type, check_config, http_config,
        risk_level, layer, check_interval, warning_threshold, error_threshold, enabled, alert_enabled,
        dependencies, layout_x, layout_y, service_type, ssh_config_id, ssh_check_type, ssh_check_config,
        script_config, process_config, database_config, file_config, impact_description, custom_alert_template,
        ${colNames.includes('schedule_type') ? 'schedule_type' : "'fixed'"},
        ${colNames.includes('schedule_config') ? 'schedule_config' : 'NULL'},
        ${colNames.includes('failure_threshold') ? 'failure_threshold' : '3'},
        ${colNames.includes('current_failure_count') ? 'current_failure_count' : '0'},
        created_at, updated_at
      FROM services;
      
      DROP TABLE services;
      ALTER TABLE services_risk_fix RENAME TO services;
      CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
      CREATE INDEX IF NOT EXISTS idx_services_host_id ON services(host_id);
    `);
    
    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys=ON');
    
    console.log('Migration complete: services risk_level constraint now includes critical');
  }
}

// === Bug #006 Fix: Data cleanup function ===
export function cleanupOldCheckRecords(retentionDays: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();
    
    const result = db.prepare(`
      DELETE FROM check_records 
      WHERE checked_at < ?
    `).run(cutoffISO);
    
    console.log(`Cleaned up ${result.changes} check records older than ${retentionDays} days`);

    // Also clean up old alerts using the same retention period
    const alertResult = db.prepare(`
      DELETE FROM alerts 
      WHERE created_at < ?
    `).run(cutoffISO);
    
    console.log(`Cleaned up ${alertResult.changes} alerts older than ${retentionDays} days`);

    return result.changes + alertResult.changes;
  } catch (error) {
    console.error('Error cleaning up old records:', error);
    throw error;
  }
}

export default db;
