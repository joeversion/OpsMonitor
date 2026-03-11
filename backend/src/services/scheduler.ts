import db, { cleanupOldCheckRecords } from '../db/database';
import { HealthChecker } from './health-checker';
import { AlertService } from './alert-service';
import { SSHService } from './ssh-service';
import logger from '../utils/logger';
import { DynamicScheduler } from './dynamic-scheduler';
import { ScheduleConfig } from '../types/schedule';
import { checkEventBus } from './check-event-bus';

export class Scheduler {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();
  private static securityCheckInterval: NodeJS.Timeout | null = null;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  static init() {
    logger.scheduler.info('Initializing scheduler...');
    logger.scheduler.debug('Current intervals count', { count: this.intervals.size });
    
    // Bug #023 Fix: 调整启动顺序
    // 1. 先启动Host连接检查（确认Host在线）
    // 2. 延迟后再启动Service检查（等Host连接建立）
    this.startHostConnectionCheck();
    this.startSecurityConfigCheck();
    this.startDataCleanup();
    
    // 延迟启动Service检查，等Host连接稳定后再开始
    // SSH Host最大延迟 = localHosts * 2s + sshHosts * 10s，预留额外缓冲
    const serviceStartDelay = 30; // 30秒后开始Service检查
    logger.scheduler.info(`Service checks will start in ${serviceStartDelay}s (waiting for host connections)`);
    setTimeout(() => {
      this.loadJobs();
    }, serviceStartDelay * 1000);
  }

  static loadJobs() {
    const services = db.prepare(`
      SELECT s.*, 
        h.connection_type as host_connection_type,
        h.ssh_host as host_ssh_host,
        h.ssh_port as host_ssh_port,
        h.ssh_username as host_ssh_username,
        h.ssh_auth_type as host_ssh_auth_type,
        h.ssh_password as host_ssh_password,
        h.ssh_private_key as host_ssh_private_key,
        h.ssh_passphrase as host_ssh_passphrase,
        h.ssh_proxy_host as host_ssh_proxy_host,
        h.ssh_proxy_port as host_ssh_proxy_port
      FROM services s
      LEFT JOIN hosts h ON s.host_id = h.id
      WHERE s.enabled = 1
    `).all() as any[];
    
    logger.scheduler.info('Loading jobs - clearing existing intervals', { count: this.intervals.size });
    // Clear existing intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Bug #023 Fix: 按Host分组并stagger延迟启动，避免同一Host瞬间收到大量SSH请求
    const servicesByHost = new Map<string, any[]>();
    services.forEach(service => {
      const hostKey = service.host_id || 'no-host';
      if (!servicesByHost.has(hostKey)) servicesByHost.set(hostKey, []);
      servicesByHost.get(hostKey)!.push(service);
    });
    
    let globalDelay = 0;
    servicesByHost.forEach((hostServices, hostKey) => {
      hostServices.forEach((service, index) => {
        // 同一Host的Service间隔1秒，不同Host间隔3秒
        const delay = globalDelay + index * 1;
        this.scheduleService(service, delay);
      });
      globalDelay += hostServices.length * 1 + 3;
    });
    
    logger.scheduler.info(`Scheduled ${services.length} services with staggered start (total delay: ${globalDelay}s)`, { activeIntervals: this.intervals.size });
  }

  static scheduleService(service: any, initialDelaySeconds: number = 0) {
    if (this.intervals.has(service.id)) {
      logger.scheduler.debug(`Service ${service.name} already scheduled, clearing old timeout`);
      clearTimeout(this.intervals.get(service.id)!);
      this.intervals.delete(service.id);
    }

    if (!service.enabled) return;

    // Parse schedule configuration
    const config: ScheduleConfig = service.schedule_config 
      ? JSON.parse(service.schedule_config)
      : { type: 'fixed', defaultInterval: service.check_interval || 60 };
    
    // Recursive scheduling function
    const scheduleNext = () => {
      const performCheck = async () => {
        logger.scheduler.debug(`Checking service: ${service.name}`);
        try {
          // Bug #013 Fix: Reload latest host configuration before each check
          const latestService = db.prepare(`
            SELECT s.*, 
              h.connection_type as host_connection_type,
              h.ssh_host as host_ssh_host,
              h.ssh_port as host_ssh_port,
              h.ssh_username as host_ssh_username,
              h.ssh_auth_type as host_ssh_auth_type,
              h.ssh_password as host_ssh_password,
              h.ssh_private_key as host_ssh_private_key,
              h.ssh_passphrase as host_ssh_passphrase,
              h.ssh_proxy_host as host_ssh_proxy_host,
              h.ssh_proxy_port as host_ssh_proxy_port
            FROM services s
            LEFT JOIN hosts h ON s.host_id = h.id
            WHERE s.id = ?
          `).get(service.id) as any;
          
          if (!latestService) {
            logger.scheduler.warn(`Service ${service.name} no longer exists, stopping check`);
            this.stopService(service.id);
            return;
          }
          
          if (!latestService.enabled) {
            logger.scheduler.info(`Service ${service.name} disabled, stopping scheduler`);
            this.stopService(service.id);
            return;
          }
          
          // Update config if changed
          const latestConfig: ScheduleConfig = latestService.schedule_config
            ? JSON.parse(latestService.schedule_config)
            : { type: 'fixed', defaultInterval: latestService.check_interval || 60 };
          
          const result = await HealthChecker.check(latestService);
          await HealthChecker.saveResult(latestService.id, result);
          await AlertService.processCheckResult(latestService, result);
          
          // Schedule next check with potentially updated config
          const intervalSeconds = DynamicScheduler.calculateNextInterval(latestConfig);
          const rangeName = DynamicScheduler.getCurrentRangeName(latestConfig);
          const nextRunTime = new Date(Date.now() + intervalSeconds * 1000);
          
          logger.scheduler.debug(`Next check for ${latestService.name}`, {
            intervalSeconds,
            rangeName,
            nextRunTime: nextRunTime.toISOString()
          });
          
          const timeout = setTimeout(performCheck, intervalSeconds * 1000);
          this.intervals.set(latestService.id, timeout);
          
        } catch (error) {
          logger.scheduler.error(`Error checking service ${service.name}`, error);
          // Schedule next check even on error
          const intervalSeconds = DynamicScheduler.calculateNextInterval(config);
          const timeout = setTimeout(performCheck, intervalSeconds * 1000);
          this.intervals.set(service.id, timeout);
        }
      };
      
      performCheck();
    };

    // Bug #023 Fix: 首次检查使用延迟启动，避免启动时大量并发
    if (initialDelaySeconds > 0) {
      const timeout = setTimeout(scheduleNext, initialDelaySeconds * 1000);
      this.intervals.set(service.id, timeout);
    } else {
      // 手动触发或重新调度时立即开始
      scheduleNext();
    }
    
    const initialInterval = DynamicScheduler.calculateNextInterval(config);
    const rangeName = DynamicScheduler.getCurrentRangeName(config);
    logger.scheduler.info(`Service ${service.name} scheduled`, { 
      scheduleType: config.type,
      initialInterval: `${initialInterval}s`,
      rangeName,
      totalScheduled: this.intervals.size 
    });
  }

  static stopService(serviceId: string) {
    if (this.intervals.has(serviceId)) {
      clearTimeout(this.intervals.get(serviceId)!);
      this.intervals.delete(serviceId);
      logger.scheduler.debug(`Stopped scheduling for service: ${serviceId}`);
    }
  }
  
  static restartService(service: any) {
    this.stopService(service.id);
    this.scheduleService(service);
  }

  // AccessKey / Security Config expiry check
  static startSecurityConfigCheck() {
    // Check every hour
    const checkIntervalMs = 60 * 60 * 1000;
    
    // Run immediately on startup
    this.checkSecurityConfigs();
    
    this.securityCheckInterval = setInterval(() => {
      this.checkSecurityConfigs();
    }, checkIntervalMs);
    
    logger.scheduler.info('Security config expiry check scheduled (hourly)');
  }

  private static async checkSecurityConfigs() {
    try {
      const configs = db.prepare('SELECT * FROM security_configs').all() as any[];
      
      for (const config of configs) {
        const daysRemaining = this.calculateDaysRemaining(config.expiry_date);
        const reminderDays = config.reminder_days ? JSON.parse(config.reminder_days) : [7, 3, 1];
        
        // Calculate current status
        const currentStatus = this.getSecurityConfigStatus(daysRemaining);
        const lastStatus = config.last_status || 'normal';
        
        // Check if we should send alert for expiry
        // Changed logic: Alert if within reminder window (e.g., <=7 days when [7,3,1])
        // and not already reminded today
        const maxReminderDay = Math.max(...reminderDays);
        const shouldAlert = 
          (daysRemaining <= maxReminderDay && daysRemaining > 0) || 
          daysRemaining <= 0;
        
        if (shouldAlert) {
          // Check if already reminded today
          const lastReminded = config.last_reminded_at ? new Date(config.last_reminded_at) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (lastReminded && lastReminded >= today) {
            continue; // Already reminded today
          }
          
          await AlertService.processSecurityConfigExpiry(config, daysRemaining);
          
          // Update last_reminded_at and last_status
          db.prepare('UPDATE security_configs SET last_reminded_at = ?, last_status = ? WHERE id = ?')
            .run(new Date().toISOString(), currentStatus, config.id);
        } else if (currentStatus === 'normal' && lastStatus !== 'normal') {
          // Recovery: status changed from expired/critical/warning to normal
          await AlertService.processSecurityConfigRecovery(config, lastStatus);
          
          // Update last_status and clear last_reminded_at
          db.prepare('UPDATE security_configs SET last_status = ?, last_reminded_at = NULL WHERE id = ?')
            .run(currentStatus, config.id);
        } else if (currentStatus !== lastStatus) {
          // Status changed but not to normal, just update last_status
          db.prepare('UPDATE security_configs SET last_status = ? WHERE id = ?')
            .run(currentStatus, config.id);
        }
      }
    } catch (error) {
      logger.scheduler.error('Error checking security configs', error);
    }
  }

  // Public method to manually trigger security config check
  static async triggerSecurityConfigCheck() {
    logger.scheduler.info('Manually triggering security config expiry check...');
    await this.checkSecurityConfigs();
    logger.scheduler.info('Security config check completed');
  }

  private static calculateDaysRemaining(expiryDate: string): number {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private static getSecurityConfigStatus(daysRemaining: number): 'normal' | 'warning' | 'critical' | 'expired' {
    if (daysRemaining <= 0) return 'expired';
    if (daysRemaining <= 3) return 'critical';
    if (daysRemaining <= 7) return 'warning';
    return 'normal';
  }

  // === Bug #006 Fix: Periodic cleanup of old check records ===
  static startDataCleanup() {
    // Run cleanup every day at 2 AM (or every 24 hours from startup)
    const cleanupIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
    
    // Get retention days from General Settings
    const getRetentionDays = (): number => {
      try {
        const row = db.prepare('SELECT value FROM system_configs WHERE key = ?').get('data_retention_days') as { value: string } | undefined;
        return row ? parseInt(row.value, 10) : 30;
      } catch (err) {
        logger.database.error('Failed to read data_retention_days config, using default 30', err);
        return 30;
      }
    };
    
    // Run immediately on startup
    logger.scheduler.info('Running initial data cleanup...');
    try {
      const retentionDays = getRetentionDays();
      cleanupOldCheckRecords(retentionDays);
    } catch (err) {
      logger.scheduler.error('Initial cleanup failed', err);
    }
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      logger.scheduler.info('Running scheduled data cleanup...');
      try {
        const retentionDays = getRetentionDays();
        cleanupOldCheckRecords(retentionDays);
      } catch (err) {
        logger.scheduler.error('Scheduled cleanup failed', err);
      }
    }, cleanupIntervalMs);
    
    logger.scheduler.info('Data cleanup scheduled (daily, retention days from General Settings)');
  }

  // === Bug #014 Fix: Periodic host connection check ===
  // Each host has its own check interval
  private static hostIntervals: Map<string, NodeJS.Timeout> = new Map();

  static startHostConnectionCheck() {
    // Load all SSH hosts and schedule individual checks
    this.loadHostChecks();
    logger.scheduler.info('Host connection checks scheduled');
  }

  static loadHostChecks() {
    // Clear existing host intervals
    this.hostIntervals.forEach(timeout => clearTimeout(timeout));
    this.hostIntervals.clear();
    
    // Get all hosts (both SSH and local types) - only enabled hosts (Spec 027)
    const hosts = db.prepare(`
      SELECT id, name, connection_type, check_interval, schedule_type, schedule_config 
      FROM hosts
      WHERE enabled = 1
    `).all() as { id: string; name: string; connection_type: string; check_interval: number | null; schedule_type: string | null; schedule_config: string | null }[];
    
    // Stagger initial checks to avoid concurrent SSH connections
    // SSH hosts get longer delays to prevent proxy server overload
    const sshHosts = hosts.filter(h => h.connection_type === 'ssh');
    const localHosts = hosts.filter(h => h.connection_type === 'local');
    
    // Schedule local hosts first with short delays (ping is fast)
    localHosts.forEach((host, index) => {
      const initialDelay = index * 2; // 2 seconds apart
      this.scheduleHostCheck(host, initialDelay);
    });
    
    // Schedule SSH hosts with longer delays to avoid concurrent connections
    sshHosts.forEach((host, index) => {
      const initialDelay = (localHosts.length * 2) + (index * 10); // 10 seconds apart for SSH
      this.scheduleHostCheck(host, initialDelay);
    });
    
    logger.scheduler.info(`Scheduled ${hosts.length} host checks (SSH: ${sshHosts.length}, Local: ${localHosts.length}) with staggered start`);
  }

  private static scheduleHostCheck(host: any, initialDelaySeconds: number = 0) {
    // Parse schedule configuration
    const config: ScheduleConfig = host.schedule_config 
      ? JSON.parse(host.schedule_config)
      : { type: 'fixed', defaultInterval: host.check_interval || 300 };
    
    // Recursive scheduling function
    const performCheck = async () => {
      try {
        // Reload latest host config (Spec 027: check enabled status)
        const latestHost = db.prepare(`
          SELECT id, name, check_interval, schedule_type, schedule_config, enabled FROM hosts WHERE id = ?
        `).get(host.id) as any;
        
        if (!latestHost || latestHost.enabled !== 1) {
          logger.scheduler.warn(`Host ${host.name} is disabled or deleted, stopping check`);
          if (this.hostIntervals.has(host.id)) {
            clearTimeout(this.hostIntervals.get(host.id)!);
            this.hostIntervals.delete(host.id);
          }
          return;
        }
        
        // Perform actual check
        await this.checkSingleHost(host.id);
        
        // Update config if changed
        const latestConfig: ScheduleConfig = latestHost.schedule_config
          ? JSON.parse(latestHost.schedule_config)
          : { type: 'fixed', defaultInterval: latestHost.check_interval || 300 };
        
        // Schedule next check
        const intervalSeconds = DynamicScheduler.calculateNextInterval(latestConfig);
        const rangeName = DynamicScheduler.getCurrentRangeName(latestConfig);
        
        logger.scheduler.debug(`Next host check for ${latestHost.name}`, {
          intervalSeconds,
          rangeName
        });
        
        const timeout = setTimeout(performCheck, intervalSeconds * 1000);
        this.hostIntervals.set(host.id, timeout);
        
      } catch (error) {
        logger.scheduler.error(`Error checking host ${host.name}`, error);
        // Schedule next check even on error
        const intervalSeconds = DynamicScheduler.calculateNextInterval(config);
        const timeout = setTimeout(performCheck, intervalSeconds * 1000);
        this.hostIntervals.set(host.id, timeout);
      }
    };
    
    // Schedule initial check with delay to stagger connections
    if (initialDelaySeconds > 0) {
      logger.scheduler.debug(`Host ${host.name} check will start in ${initialDelaySeconds}s`);
      const timeout = setTimeout(performCheck, initialDelaySeconds * 1000);
      this.hostIntervals.set(host.id, timeout);
    } else {
      // Start immediately for manually triggered restarts
      performCheck();
    }
    
    const scheduledInterval = DynamicScheduler.calculateNextInterval(config);
    const rangeName = DynamicScheduler.getCurrentRangeName(config);
    logger.scheduler.debug(`Host ${host.name} check scheduled`, {
      scheduleType: config.type,
      initialDelay: `${initialDelaySeconds}s`,
      interval: `${scheduledInterval}s`,
      rangeName
    });
  }

  // Restart host connection check (called when config changes)
  static restartHostConnectionCheck() {
    this.loadHostChecks();
  }
  
  // Restart single host check (called when host config changes)
  static restartSingleHostCheck(hostId: string) {
    // Clear existing timeout
    if (this.hostIntervals.has(hostId)) {
      clearTimeout(this.hostIntervals.get(hostId)!);
      this.hostIntervals.delete(hostId);
    }
    
    // Get host info (both SSH and local types) - check if enabled (Spec 027)
    const host = db.prepare(`
      SELECT id, name, connection_type, check_interval, schedule_type, schedule_config, enabled 
      FROM hosts WHERE id = ?
    `).get(hostId) as any;
    
    if (host && host.enabled === 1) {
      this.scheduleHostCheck(host);
    } else if (host && host.enabled !== 1) {
      logger.scheduler.info(`Host ${host.name} is disabled, skipping schedule`);
    }
  }
  
  // Stop single host check (Spec 027: called when host is disabled)
  static stopSingleHostCheck(hostId: string) {
    if (this.hostIntervals.has(hostId)) {
      clearTimeout(this.hostIntervals.get(hostId)!);
      this.hostIntervals.delete(hostId);
      logger.scheduler.info(`Stopped monitoring for host ${hostId}`);
    }
  }

  private static async checkSingleHost(hostId: string) {
    try {
      const host = db.prepare(`
        SELECT id, name, ip, connection_type, ssh_host, ssh_port, ssh_username, 
               ssh_auth_type, ssh_password, ssh_private_key, ssh_passphrase,
               ssh_proxy_host, ssh_proxy_port,
               ssh_max_retries, ssh_retry_delay, ssh_connection_timeout, ssh_command_timeout
        FROM hosts WHERE id = ?
      `).get(hostId) as any;
      
      if (!host) {
        // Host deleted, remove timeout
        if (this.hostIntervals.has(hostId)) {
          clearTimeout(this.hostIntervals.get(hostId)!);
          this.hostIntervals.delete(hostId);
        }
        return;
      }
      
      await this.performHostCheck(host);
    } catch (error) {
      logger.scheduler.error(`Error checking host ${hostId}`, error);
    }
  }

  private static async checkHostConnections() {
    try {
      
      // Get all SSH hosts (including host-level SSH settings)
      const hosts = db.prepare(`
        SELECT id, name, ip, ssh_host, ssh_port, ssh_username, 
               ssh_auth_type, ssh_password, ssh_private_key, ssh_passphrase,
               ssh_proxy_host, ssh_proxy_port,
               ssh_max_retries, ssh_retry_delay, ssh_connection_timeout, ssh_command_timeout
        FROM hosts 
        WHERE connection_type = 'ssh'
      `).all() as any[];
      
      logger.scheduler.info(`Checking SSH host connections`, { count: hosts.length });
      
      for (const host of hosts) {
        await this.performHostCheck(host);
      }
    } catch (error) {
      logger.scheduler.error('Error checking host connections', error);
    }
  }

  private static async performHostCheck(host: any) {
    try {
      let result: { success: boolean; message: string; latency?: number };
      
      if (host.connection_type === 'local') {
        // Ping test for local hosts
        result = await this.performPingCheck(host);
      } else {
        // SSH test for SSH hosts
        const sshHost = host.ssh_host || host.ip;
        const credential = host.ssh_auth_type === 'password' 
          ? host.ssh_password 
          : host.ssh_private_key;
        
        // Bug #023: Host heartbeat 使用低优先级(1)，避免阻塞 Service 检查
        result = await SSHService.testConnection({
          host: sshHost,
          port: host.ssh_port || 22,
          username: host.ssh_username,
          auth_type: host.ssh_auth_type,
          credential: credential,
          passphrase: host.ssh_passphrase,
          proxy_host: host.ssh_proxy_host,
          proxy_port: host.ssh_proxy_port,
          // Host-level SSH settings
          max_retries: host.ssh_max_retries,
          retry_delay: host.ssh_retry_delay,
          connection_timeout: host.ssh_connection_timeout,
          command_timeout: host.ssh_command_timeout
        }, 1);  // 优先级=1（低优先级）
      }
      
      // Update host test status based on result
      if (result.success) {
        db.prepare(`
          UPDATE hosts 
          SET last_test_status = 'success',
              last_test_message = ?,
              last_test_latency = ?,
              last_test_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.message, result.latency || 0, host.id);
        
        logger.scheduler.debug(`Host ${host.name}: Connection OK`, { latency: `${result.latency}ms` });
      } else {
        db.prepare(`
          UPDATE hosts 
          SET last_test_status = 'failed',
              last_test_message = ?,
              last_test_latency = ?,
              last_test_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.message, result.latency || 0, host.id);
        
        // Update all services on this host to 'down' status when host is offline
        this.updateServicesForOfflineHost(host.id, host.name, result.message);
        
        logger.scheduler.warn(`Host ${host.name}: Connection failed`, { message: result.message });
      }
    } catch (error: any) {
      // Update host test status to failed (for unexpected errors)
      db.prepare(`
        UPDATE hosts 
        SET last_test_status = 'failed',
            last_test_message = ?,
            last_test_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error.message || 'Connection failed', host.id);
      
      // Update all services on this host to 'down' status when host is offline
      this.updateServicesForOfflineHost(host.id, host.name, error.message || 'Host connection failed');
      
      logger.scheduler.warn(`Host ${host.name}: Unexpected error`, { error: error.message });
    }
  }

  /**
   * Perform ping check for local type hosts
    * Uses system ping command to check host reachability.
    * Ping-only behavior: no TCP fallback.
   */
  private static async performPingCheck(host: any): Promise<{ success: boolean; message: string; latency?: number }> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const startTime = Date.now();
    const targetIp = host.ip;
    
    if (!targetIp) {
      return { success: false, message: 'Host IP address is not configured', latency: 0 };
    }

    // Bug #031: Validate IP/hostname to prevent shell command injection
    if (!/^[a-zA-Z0-9.\-]+$/.test(targetIp)) {
      return { success: false, message: 'Invalid host IP address format', latency: 0 };
    }
    
    // Use different ping command based on platform
    const isWindows = process.platform === 'win32';
    const pingCommand = isWindows 
      ? `ping -n 1 -w 3000 ${targetIp}` 
      : `ping -c 1 -W 3 ${targetIp}`;
    
    try {
      await execAsync(pingCommand, { timeout: 5000 });
      const latency = Date.now() - startTime;
      
      return { 
        success: true, 
        message: `Host ${targetIp} is reachable`, 
        latency 
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return { 
        success: false, 
        message: `Host ${targetIp} is unreachable`, 
        latency 
      };
    }
  }

  /**
   * Update all services on a host to 'unknown' status when the host goes offline
   * Includes both enabled and disabled services, as Host status should affect all services
   */
  private static updateServicesForOfflineHost(hostId: string, hostName: string, errorMessage: string) {
    try {
      // Get ALL services on this host (including disabled ones)
      // When host is offline, all services should reflect this status
      const services = db.prepare(`
        SELECT id, name FROM services WHERE host_id = ?
      `).all(hostId) as { id: string; name: string }[];
      
      if (services.length === 0) return;
      
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO check_records (id, service_id, status, response_time, error_message, checked_at)
        VALUES (?, ?, 'down', 0, ?, ?)
      `);
      
      const transaction = db.transaction(() => {
        for (const service of services) {
          // Insert a check record with 'down' status
          const id = require('uuid').v4();
          insertStmt.run(id, service.id, `Host ${hostName} is offline: ${errorMessage}`, now);
        }
      });
      
      transaction();
      
      // Broadcast SSE events so frontend (topology, etc.) gets real-time updates
      for (const service of services) {
        checkEventBus.broadcast({
          serviceId: service.id,
          status: 'down',
          responseTime: null,
          errorMessage: `Host ${hostName} is offline: ${errorMessage}`,
          checkedAt: now,
        });
      }
      
      logger.scheduler.info(`Updated ${services.length} services to DOWN due to host ${hostName} offline`);
    } catch (error) {
      logger.scheduler.error(`Error updating services for offline host ${hostName}`, error);
    }
  }
}
