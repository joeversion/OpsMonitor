const fs = require('fs');
const path = require('path');

// Initialize an empty DB first, start the backend, wait for its 30-second scheduler load,
// then seed while the backend is still running so synthetic checks are not executed.
const dataDirectory = path.resolve(__dirname, '..', 'data');
const databasePath = path.join(dataDirectory, 'docs-screenshots.db');
const command = process.argv[2];

const projects = [
  {
    id: 'docs-demo-project-commerce',
    name: 'Atlas Commerce',
    description: 'Synthetic services for the OpsMonitor documentation screenshots.',
    icon_color: '#3478f6',
  },
  {
    id: 'docs-demo-project-platform',
    name: 'Platform Services',
    description: 'Synthetic shared platform services for documentation screenshots.',
    icon_color: '#7c5ce7',
  },
];

const hosts = [
  {
    id: 'docs-demo-host-edge',
    name: 'edge-demo-01',
    ip: '192.0.2.10',
    project_id: projects[0].id,
    connection_type: 'local',
    enabled: 0,
    last_test_status: 'success',
    last_test_message: 'Synthetic documentation data',
    last_test_latency: 12,
    check_interval: 300,
  },
  {
    id: 'docs-demo-host-data',
    name: 'data-demo-01',
    ip: '192.0.2.20',
    project_id: projects[0].id,
    connection_type: 'local',
    enabled: 0,
    last_test_status: 'success',
    last_test_message: 'Synthetic documentation data',
    last_test_latency: 18,
    check_interval: 300,
  },
  {
    id: 'docs-demo-host-platform',
    name: 'platform-demo-01',
    ip: '192.0.2.30',
    project_id: projects[1].id,
    connection_type: 'local',
    enabled: 0,
    last_test_status: 'success',
    last_test_message: 'Synthetic documentation data',
    last_test_latency: 9,
    check_interval: 300,
  },
];

const serviceDefinitions = [
  {
    id: 'docs-demo-web',
    name: 'Web Portal',
    project_id: projects[0].id,
    host_id: hosts[0].id,
    host: hosts[0].ip,
    port: 443,
    status: 'up',
    response_time: 42,
    risk_level: 'high',
    layer: 'frontend',
    layout_x: 80,
    layout_y: 40,
    icon: '🌐',
  },
  {
    id: 'docs-demo-gateway',
    name: 'API Gateway',
    project_id: projects[0].id,
    host_id: hosts[0].id,
    host: hosts[0].ip,
    port: 8080,
    status: 'up',
    response_time: 28,
    risk_level: 'critical',
    layer: 'backend',
    layout_x: 360,
    layout_y: 40,
    icon: '🚪',
  },
  {
    id: 'docs-demo-orders',
    name: 'Orders API',
    project_id: projects[0].id,
    host_id: hosts[0].id,
    host: hosts[0].ip,
    port: 3000,
    status: 'warning',
    response_time: 840,
    error_message: 'Synthetic elevated latency for documentation.',
    risk_level: 'high',
    layer: 'backend',
    layout_x: 300,
    layout_y: 210,
    icon: '📦',
  },
  {
    id: 'docs-demo-payments',
    name: 'Payments API',
    project_id: projects[0].id,
    host_id: hosts[0].id,
    host: hosts[0].ip,
    port: 3001,
    status: 'up',
    response_time: 56,
    risk_level: 'critical',
    layer: 'backend',
    layout_x: 550,
    layout_y: 210,
    icon: '💳',
  },
  {
    id: 'docs-demo-postgres',
    name: 'PostgreSQL',
    project_id: projects[0].id,
    host_id: hosts[1].id,
    host: hosts[1].ip,
    port: 5432,
    status: 'up',
    response_time: 7,
    risk_level: 'critical',
    layer: 'database',
    layout_x: 180,
    layout_y: 400,
    icon: '🐘',
  },
  {
    id: 'docs-demo-cache',
    name: 'Redis Cache',
    project_id: projects[0].id,
    host_id: hosts[1].id,
    host: hosts[1].ip,
    port: 6379,
    status: 'down',
    response_time: 0,
    error_message: 'Synthetic unavailable state for documentation.',
    risk_level: 'high',
    layer: 'database',
    layout_x: 430,
    layout_y: 400,
    icon: '🧰',
  },
  {
    id: 'docs-demo-queue',
    name: 'Message Queue',
    project_id: projects[0].id,
    host_id: hosts[1].id,
    host: hosts[1].ip,
    port: 5672,
    status: 'unknown',
    response_time: 0,
    risk_level: 'medium',
    layer: 'backend',
    layout_x: 680,
    layout_y: 400,
    icon: '📨',
  },
  {
    id: 'docs-demo-import',
    name: 'Scheduled Import',
    project_id: projects[0].id,
    host_id: hosts[1].id,
    host: hosts[1].ip,
    port: 0,
    status: 'unknown',
    response_time: 0,
    risk_level: 'low',
    layer: 'backend',
    layout_x: 900,
    layout_y: 210,
    icon: '⏸️',
    enabled: 0,
  },
  {
    id: 'docs-demo-auth',
    name: 'Identity Service',
    project_id: projects[1].id,
    host_id: hosts[2].id,
    host: hosts[2].ip,
    port: 8081,
    status: 'up',
    response_time: 34,
    risk_level: 'high',
    layer: 'backend',
    layout_x: 1150,
    layout_y: 40,
    icon: '🔐',
  },
  {
    id: 'docs-demo-metrics',
    name: 'Metrics API',
    project_id: projects[1].id,
    host_id: hosts[2].id,
    host: hosts[2].ip,
    port: 9090,
    status: 'warning',
    response_time: 510,
    error_message: 'Synthetic elevated latency for documentation.',
    risk_level: 'medium',
    layer: 'backend',
    layout_x: 360,
    layout_y: 40,
    icon: '📈',
  },
  {
    id: 'docs-demo-docs',
    name: 'Docs Site',
    project_id: projects[1].id,
    host_id: hosts[2].id,
    host: hosts[2].ip,
    port: 5174,
    status: 'up',
    response_time: 21,
    risk_level: 'low',
    layer: 'frontend',
    layout_x: 220,
    layout_y: 220,
    icon: '📘',
  },
  {
    id: 'docs-demo-maintenance',
    name: 'Maintenance Job',
    project_id: projects[1].id,
    host_id: hosts[2].id,
    host: hosts[2].ip,
    port: 0,
    status: 'unknown',
    response_time: 0,
    risk_level: 'low',
    layer: 'backend',
    layout_x: 500,
    layout_y: 220,
    icon: '🛠️',
    enabled: 0,
  },
];

const dependencies = [
  { id: 'docs-demo-link-web-gateway', source: 'docs-demo-web', target: 'docs-demo-gateway', type: 'depends', risk: 'high' },
  { id: 'docs-demo-link-gateway-orders', source: 'docs-demo-gateway', target: 'docs-demo-orders', type: 'depends', risk: 'critical' },
  { id: 'docs-demo-link-gateway-payments', source: 'docs-demo-gateway', target: 'docs-demo-payments', type: 'uses', risk: 'high' },
  { id: 'docs-demo-link-orders-postgres', source: 'docs-demo-orders', target: 'docs-demo-postgres', type: 'depends', risk: 'critical' },
  { id: 'docs-demo-link-orders-cache', source: 'docs-demo-orders', target: 'docs-demo-cache', type: 'uses', risk: 'medium' },
  { id: 'docs-demo-link-orders-queue', source: 'docs-demo-orders', target: 'docs-demo-queue', type: 'sync', risk: 'medium' },
  { id: 'docs-demo-link-gateway-auth', source: 'docs-demo-gateway', target: 'docs-demo-auth', type: 'depends', risk: 'high' },
  { id: 'docs-demo-link-metrics-auth', source: 'docs-demo-metrics', target: 'docs-demo-auth', type: 'uses', risk: 'low' },
];

function initializeDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  process.env.DB_PATH = databasePath;
  require('ts-node/register');
  const database = require('../src/db/database');
  database.initDatabase();
  database.default.close();
  console.log(`Initialized isolated screenshot database: ${databasePath}`);
  console.log('Start the backend with this DB_PATH and let its empty scheduler load before running the seed command.');
}

function seedDatabase() {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Screenshot database not found. Run "node scripts/seed-docs-screenshots.js init" first.`);
  }

  const Database = require('better-sqlite3');
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');

  try {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
    for (const table of ['projects', 'hosts', 'services', 'check_records', 'service_dependencies']) {
      if (!tables.has(table)) {
        throw new Error(`Required table "${table}" is missing. Initialize the screenshot database first.`);
      }
    }

    const unexpectedService = db.prepare("SELECT id FROM services WHERE id NOT LIKE 'docs-demo-%' LIMIT 1").get();
    if (unexpectedService) {
      throw new Error(`Refusing to seed a database containing non-demo services (example: ${unexpectedService.id}).`);
    }

    const insertOrUpdate = (table, row) => {
      const availableColumns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
      const entries = Object.entries(row).filter(([column]) => availableColumns.has(column));
      const columns = entries.map(([column]) => column);
      const placeholders = columns.map(() => '?');
      const updates = columns.filter(column => column !== 'id').map(column => `${column} = excluded.${column}`);
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
        ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`;
      db.prepare(sql).run(...entries.map(([, value]) => value));
    };

    const seed = db.transaction(() => {
      const timestamp = db.prepare("SELECT strftime('%Y-%m-%d %H:%M:%S', 'now') AS value").get().value;
      db.prepare(`DELETE FROM check_records WHERE service_id IN (${serviceDefinitions.map(() => '?').join(', ')})`)
        .run(...serviceDefinitions.map(service => service.id));

      projects.forEach(project => insertOrUpdate('projects', project));
      hosts.forEach(host => insertOrUpdate('hosts', host));

      serviceDefinitions.forEach(service => {
        const relatedDependencies = dependencies
          .filter(dependency => dependency.source === service.id)
          .map(dependency => dependency.target);
        insertOrUpdate('services', {
          ...service,
          check_type: 'tcp',
          check_config: JSON.stringify({ port: service.port, timeout: 3000 }),
          description: 'Synthetic documentation data. No real service is monitored.',
          risk_level: service.risk_level,
          check_interval: 3600,
          warning_threshold: 2,
          error_threshold: 4,
          enabled: service.enabled ?? 1,
          alert_enabled: 0,
          dependencies: JSON.stringify(relatedDependencies),
          service_type: 'http',
          schedule_type: 'fixed',
          schedule_config: JSON.stringify({ type: 'fixed', defaultInterval: 3600 }),
        });

        if (service.status !== 'unknown' && (service.enabled ?? 1) === 1) {
          insertOrUpdate('check_records', {
            id: `${service.id}-check`,
            service_id: service.id,
            status: service.status,
            response_time: service.response_time,
            error_message: service.error_message ?? null,
            output: `Synthetic ${service.status.toUpperCase()} result for documentation screenshots.`,
            checked_at: timestamp,
          });
        }
      });

      dependencies.forEach(dependency => insertOrUpdate('service_dependencies', {
        id: dependency.id,
        source_service_id: dependency.source,
        target_service_id: dependency.target,
        dependency_type: dependency.type,
        risk_level: dependency.risk,
        link_direction: 'normal',
        description: 'Synthetic dependency for documentation screenshots.',
      }));
    });

    seed();
    console.log(`Seeded ${projects.length} projects, ${hosts.length} disabled hosts, ${serviceDefinitions.length} services, and ${dependencies.length} dependency links.`);
    console.log('All monitoring targets use reserved TEST-NET addresses; host monitoring and service alerts are disabled.');
    console.log('Select "Atlas Commerce" to capture the topology graph, then switch to "All Projects" for overview screenshots.');
  } finally {
    db.close();
  }
}

if (command === 'init') {
  initializeDatabase();
} else if (command === 'seed') {
  seedDatabase();
} else {
  throw new Error('Usage: node scripts/seed-docs-screenshots.js <init|seed>');
}
