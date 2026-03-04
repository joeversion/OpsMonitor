import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initDatabase } from './db/database';
import servicesRouter from './routes/services';
import checksRouter from './routes/checks';
import configRouter from './routes/config';
import alertsRouter from './routes/alerts';
import securityConfigsRouter from './routes/security-configs';
import projectsRouter from './routes/projects';
import dependenciesRouter from './routes/dependencies';
import dependencyTypesRouter from './routes/dependency-types';
import grafanaDashboardsRouter from './routes/grafana-dashboards';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import hostsRouter from './routes/hosts';
import systemSettingsRouter from './routes/system-settings';
import scheduleRouter from './routes/schedule';
import sshPoolRouter from './routes/ssh-pool';
import { Scheduler } from './services/scheduler';
import { AuthService } from './services/auth-service';
import SSHConnectionPool from './services/ssh-connection-pool';
import logger from './utils/logger';

// Global error handlers to prevent SSH2 errors from crashing the app
process.on('uncaughtException', (error: Error) => {
  logger.error('Global', 'Uncaught Exception', { 
    error: error.message, 
    stack: error.stack,
    name: error.name
  });
  
  // Don't exit the process for SSH connection errors
  const sshErrors = [
    'Connection lost before handshake',
    'Timed out while waiting for handshake',
    'ECONNRESET',
    'read ECONNRESET',
    'ETIMEDOUT',
    'Connection timeout',
    'Connection closed unexpectedly'
  ];
  
  const isSSHError = sshErrors.some(pattern => error.message.includes(pattern));
  
  if (isSSHError) {
    logger.error('Global', 'SSH connection error caught by global handler - continuing operation', {
      error: error.message
    });
  } else {
    // For other critical errors, exit gracefully
    logger.error('Global', 'Critical error - shutting down', error);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Global', 'Unhandled Rejection', { 
    reason: reason?.message || reason,
    stack: reason?.stack 
  });
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Initialize Database
logger.database.info('Initializing database...');
initDatabase();

// Initialize default admin user
AuthService.initDefaultAdmin().catch(err => {
  logger.auth.error('Failed to initialize default admin', err);
});

// Initialize SSH Connection Pool (Bug #022)
logger.ssh.info('Initializing SSH connection pool...');
SSHConnectionPool.init();

// Initialize Scheduler
logger.scheduler.info('Starting scheduler initialization...');
Scheduler.init();

// Routes - Auth (public)
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Routes - Protected (apply auth middleware per-route as needed)
app.use('/api/projects', projectsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/hosts', hostsRouter);
app.use('/api/checks', checksRouter);
app.use('/api/config', configRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/security-configs', securityConfigsRouter);
app.use('/api/dependencies', dependenciesRouter);
app.use('/api/dependency-types', dependencyTypesRouter);
app.use('/api/grafana-dashboards', grafanaDashboardsRouter);
app.use('/api/system-settings', systemSettingsRouter);
app.use('/api', scheduleRouter);  // Schedule routes use full path like /api/services/:id/schedule
app.use('/api/ssh', sshPoolRouter);  // SSH connection pool monitoring

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
// Explicitly listen on all interfaces (0.0.0.0) to ensure accessibility
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server', `Server running on 0.0.0.0:${PORT}`);
  logger.info('Server', 'Environment: ' + (process.env.NODE_ENV || 'development'));
});

// Graceful shutdown - cleanup SSH connection pool
process.on('SIGTERM', () => {
  logger.info('Server', 'SIGTERM received, closing SSH connection pool...');
  SSHConnectionPool.closeAllPools();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Server', 'SIGINT received, closing SSH connection pool...');
  SSHConnectionPool.closeAllPools();
  process.exit(0);
});

// Trigger restart
export default app;
