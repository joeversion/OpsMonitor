-- Projects table (多项目支持)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_color TEXT DEFAULT 'blue',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hosts table (Spec 013: Host-centric architecture)
CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  project_id TEXT,
  connection_type TEXT CHECK(connection_type IN ('ssh', 'local') OR connection_type IS NULL),  -- 允许 NULL
  -- Direct SSH configuration (instead of referencing security_configs)
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
  tags TEXT,  -- JSON array of tags
  -- Connection test status
  last_test_status TEXT,     -- 'success' or 'failed'
  last_test_at DATETIME,     -- Last connection test timestamp
  last_test_message TEXT,    -- Test result message
  last_test_latency INTEGER, -- Test latency in milliseconds
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT,  -- 关联项目
  host_id TEXT,  -- 关联主机 (Spec 013)
  description TEXT,
  host TEXT NOT NULL,  -- Deprecated: kept for backward compatibility
  port INTEGER NOT NULL,
  check_type TEXT NOT NULL CHECK(check_type IN ('tcp', 'http', 'https', 'script', 'file', 'log', 'file-age', 'file-exists', 'docker-running', 'docker-health', 'command')),
  check_config TEXT, -- JSON string for check-specific configuration
  http_config TEXT, -- JSON string (deprecated, use check_config)
  risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
  layer TEXT CHECK(layer IN ('frontend', 'backend', 'database', 'external')), -- Explicit layer
  check_interval INTEGER NOT NULL,
  warning_threshold INTEGER NOT NULL,
  error_threshold INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  alert_enabled INTEGER NOT NULL DEFAULT 1,
  dependencies TEXT, -- JSON string array of service IDs
  layout_x INTEGER, -- Custom X position
  layout_y INTEGER, -- Custom Y position
  icon TEXT, -- Custom icon emoji for topology view
  -- SSH monitoring fields
  service_type TEXT DEFAULT 'http' CHECK(service_type IN ('http', 'ssh')),
  ssh_config_id TEXT,  -- Reference to security_configs for SSH credentials
  ssh_check_type TEXT CHECK(ssh_check_type IN ('file-age', 'file-exists', 'docker-running', 'docker-health', 'command')),
  ssh_check_config TEXT, -- JSON: path, pattern, max_age_seconds, container_name, command, success_pattern
  -- New monitoring type configs (Optimized Add Service Form)
  script_config TEXT,    -- JSON: { type: 'bash'|'python'|'powershell'|'nodejs', content, exit_code, timeout }
  process_config TEXT,   -- JSON: { name, min_instances, max_instances }
  database_config TEXT,  -- JSON: { name, username, password, query }
  file_config TEXT,      -- JSON: { path, check_type: 'exists'|'modified', max_age }
  -- Service-level alert customization
  impact_description TEXT, -- Service outage impact description (e.g., "Users cannot access the system")
  custom_alert_template TEXT, -- Custom alert message template
  -- Flexible schedule configuration (Spec 020)
  schedule_type TEXT DEFAULT 'fixed', -- 'fixed' or 'timeRange'
  schedule_config TEXT, -- JSON string for time-range schedule
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE SET NULL,
  FOREIGN KEY(ssh_config_id) REFERENCES security_configs(id) ON DELETE SET NULL
);

-- Check records table
CREATE TABLE IF NOT EXISTS check_records (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('up', 'down', 'warning', 'unknown')),
  response_time INTEGER NOT NULL,
  error_message TEXT,
  output TEXT,            -- short summary for UI
  stdout TEXT,            -- captured stdout (script/file checks)
  stderr TEXT,            -- captured stderr (script/file checks)
  details TEXT,           -- JSON blob with structured info (file path, mtime, size, content match, etc.)
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  service_id TEXT,
  security_config_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('down', 'warning', 'recovery', 'expiry')),
  message TEXT NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0,
  notified_at DATETIME,
  notify_channels TEXT, -- JSON string array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY(security_config_id) REFERENCES security_configs(id) ON DELETE CASCADE
);

-- Security configs table
CREATE TABLE IF NOT EXISTS security_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('accesskey', 'ftp', 'ssl', 'ssh')),
  affected_services TEXT, -- JSON string array of service IDs
  affected_projects TEXT, -- JSON string array of project IDs (跨项目支持)
  validity_days INTEGER,
  last_reset_at DATETIME,
  expiry_date DATETIME NOT NULL,
  reminder_days TEXT NOT NULL, -- JSON string array of integers
  last_reminded_at DATETIME,
  last_status TEXT DEFAULT 'normal' CHECK(last_status IN ('normal', 'warning', 'critical', 'expired')), -- Track status for recovery alerts
  notes TEXT, -- User notes/comments
  -- SSH specific fields
  ssh_host TEXT,
  ssh_port INTEGER DEFAULT 22,
  ssh_username TEXT,
  ssh_auth_type TEXT CHECK(ssh_auth_type IN ('password', 'private_key')),
  ssh_credential TEXT,      -- encrypted password or private key
  ssh_passphrase TEXT,      -- encrypted passphrase for private key
  ssh_proxy_host TEXT,
  ssh_proxy_port INTEGER,
  ssh_proxy_username TEXT,
  ssh_proxy_auth_type TEXT CHECK(ssh_proxy_auth_type IN ('password', 'private_key')),
  ssh_proxy_credential TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service dependencies table (跨项目依赖关系)
-- Bug Fix: Changed ON DELETE CASCADE to RESTRICT to prevent accidental dependency deletion
-- When a service is deleted, dependencies must be manually removed first
CREATE TABLE IF NOT EXISTS service_dependencies (
  id TEXT PRIMARY KEY,
  source_service_id TEXT NOT NULL,
  target_service_id TEXT,           -- 目标服务ID（可选，跨项目时使用）
  target_resource_id TEXT,          -- 目标资源ID（如 security_configs）
  dependency_type TEXT NOT NULL,    -- 关联 dependency_types.name，支持自定义类型
  risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
  link_direction TEXT DEFAULT 'normal', -- 连线方向：normal(A→B) 或 reverse(A←B)
  description TEXT,
  impact_description TEXT,          -- 描述当此依赖服务宕机时的影响
  custom_alert_template TEXT,       -- 自定义告警模板，支持变量如 {service_name}, {affected_count}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_service_id) REFERENCES services(id) ON DELETE RESTRICT,
  FOREIGN KEY(target_service_id) REFERENCES services(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_check_records_service_id ON check_records(service_id);
CREATE INDEX IF NOT EXISTS idx_check_records_checked_at ON check_records(checked_at);
CREATE INDEX IF NOT EXISTS idx_alerts_service_id ON alerts(service_id);
CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_services_host_id ON services(host_id);
CREATE INDEX IF NOT EXISTS idx_hosts_project_id ON hosts(project_id);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_source ON service_dependencies(source_service_id);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_target ON service_dependencies(target_service_id);

-- System configs table
CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dependency types table (自定义依赖类型)
CREATE TABLE IF NOT EXISTS dependency_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '🔗',
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_system INTEGER DEFAULT 0,  -- 1 = 系统内置类型，不可删除
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认依赖类型
INSERT OR IGNORE INTO dependency_types (id, name, label, icon, description, color, is_system, sort_order) VALUES
  ('type-depends', 'depends', 'Depends', '🔗', 'Strong dependency, must be available', '#ef4444', 1, 1),
  ('type-uses', 'uses', 'Uses', '📡', 'Weak dependency, can degrade', '#6366f1', 1, 2),
  ('type-sync', 'sync', 'Sync', '🔄', 'Data synchronization relationship', '#06b6d4', 1, 3),
  ('type-backup', 'backup', 'Backup', '💾', 'Backup/redundancy relationship', '#10b981', 1, 4);

-- Grafana Dashboards table
CREATE TABLE IF NOT EXISTS grafana_dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id TEXT,                    -- 关联项目（可选）
  service_id TEXT,                    -- 关联服务（可选）
  grafana_url TEXT NOT NULL,          -- Grafana 服务地址
  dashboard_uid TEXT NOT NULL,        -- Dashboard UID
  panel_id INTEGER,                   -- 特定面板 ID（可选）
  embed_options TEXT,                 -- JSON: { theme, refresh, kiosk, vars }
  display_order INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Indexes for grafana_dashboards
CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_project ON grafana_dashboards(project_id);
CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_service ON grafana_dashboards(service_id);

-- Users table (用户认证)
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

-- Index for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- System settings table (global configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default system settings
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
  ('timezone', 'UTC', 'System timezone for logs and timestamps (e.g., Asia/Shanghai, UTC, America/New_York)'),
  ('date_format', 'YYYY-MM-DD HH:mm:ss', 'Date format for display'),
  ('log_retention_days', '30', 'Number of days to keep logs');

-- Cross-project service layout positions
-- Stores layout positions for services when displayed in another project's topology
CREATE TABLE IF NOT EXISTS cross_project_layouts (
  id TEXT PRIMARY KEY,
  viewing_project_id TEXT NOT NULL,  -- The project viewing the topology
  service_id TEXT NOT NULL,          -- The cross-project service being displayed
  layout_x INTEGER,                  -- X position in the viewing project's topology
  layout_y INTEGER,                  -- Y position in the viewing project's topology
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(viewing_project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(viewing_project_id, service_id)
);

-- Index for cross_project_layouts
CREATE INDEX IF NOT EXISTS idx_cross_project_layouts_viewing ON cross_project_layouts(viewing_project_id);
CREATE INDEX IF NOT EXISTS idx_cross_project_layouts_service ON cross_project_layouts(service_id);
