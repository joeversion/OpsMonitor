import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification-service';
import { logger } from '../utils/logger';

interface CheckResult {
  status: 'up' | 'down' | 'warning' | 'unknown';
  responseTime: number;
  error?: string;
}

interface Service {
  id: string;
  name: string;
  alert_enabled: number;
  [key: string]: any;
}

interface SecurityConfig {
  id: string;
  name: string;
  type: string;
  expiry_date: string;
  affected_services?: string;
  [key: string]: any;
}

export class AlertService {
  /**
   * Convert UTC time to local display time (Asia/Shanghai timezone)
   * @param date - Date object or ISO string
   * @returns Formatted local time string
   */
  private static toLocalTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  static async processCheckResult(service: Service, result: CheckResult) {
    if (!service.alert_enabled) return;

    const currentStatus = result.status;
    
    // Get failure threshold (user configurable, default 3)
    const failureThreshold = (service as any).failure_threshold ?? 3;
    let currentFailureCount = (service as any).current_failure_count ?? 0;

    // Update failure count based on current status
    if (currentStatus === 'down' || currentStatus === 'warning') {
      // Increment failure count
      currentFailureCount++;
      
      // Update count in database
      db.prepare('UPDATE services SET current_failure_count = ? WHERE id = ?').run(currentFailureCount, service.id);
      
      logger.alert.debug(`Service ${service.name} failure count: ${currentFailureCount}/${failureThreshold}`);
      
      // Only alert if threshold is reached
      if (currentFailureCount === failureThreshold) {
        // Threshold reached, send alert
        if (currentStatus === 'down') {
          await this.createAlert(service, 'down', `Service ${service.name} is DOWN after ${currentFailureCount} consecutive failures. Error: ${result.error || 'Unknown error'}`);
        } else if (currentStatus === 'warning') {
          await this.createAlert(service, 'warning', `Service ${service.name} is in WARNING state after ${currentFailureCount} consecutive slow responses. Response time: ${result.responseTime}ms`);
        }
      } else if (currentFailureCount > failureThreshold) {
        // Already alerted, don't spam
        logger.alert.debug(`Service ${service.name} still down/warning, suppressing repeat alert`);
      }
      // If count < threshold, no alert yet (transient failure)
      
    } else if (currentStatus === 'up') {
      // Service is healthy
      if (currentFailureCount >= failureThreshold) {
        // Was in alerted state, now recovered - send recovery
        await this.createAlert(service, 'recovery', `Service ${service.name} has recovered after ${currentFailureCount} consecutive failures.`);
      }
      
      // Reset failure count
      if (currentFailureCount > 0) {
        db.prepare('UPDATE services SET current_failure_count = 0 WHERE id = ?').run(service.id);
        logger.alert.debug(`Service ${service.name} recovered, reset failure count`);
      }
    }
  }

  static async processSecurityConfigExpiry(config: SecurityConfig, daysRemaining: number) {
    let alertLevel: 'warning' | 'critical' | 'expired';
    let message: string;
    
    const typeLabel = config.type === 'accesskey' ? 'AccessKey' : 
                      config.type === 'ftp' ? 'FTP Password' : 
                      config.type === 'ssh' ? 'SSH Credential' : 'SSL Certificate';
    
    if (daysRemaining <= 0) {
      alertLevel = 'expired';
      message = `⚠️ ${typeLabel} "${config.name}" has EXPIRED! Please update immediately.`;
    } else if (daysRemaining <= 3) {
      alertLevel = 'critical';
      message = `🔴 ${typeLabel} "${config.name}" will expire in ${daysRemaining} day(s)! Please update as soon as possible.`;
    } else {
      alertLevel = 'warning';
      message = `⚠️ ${typeLabel} "${config.name}" will expire in ${daysRemaining} day(s). Please take note.`;
    }

    // Get affected services names
    let affectedServiceNames: string[] = [];
    if (config.affected_services) {
      const serviceIds = JSON.parse(config.affected_services);
      if (serviceIds.length > 0) {
        const placeholders = serviceIds.map(() => '?').join(',');
        const services = db.prepare(`SELECT name FROM services WHERE id IN (${placeholders})`).all(...serviceIds) as any[];
        affectedServiceNames = services.map(s => s.name);
      }
    }

    await this.createExpiryAlert(config, alertLevel, message, affectedServiceNames, daysRemaining);
  }

  static async processSecurityConfigRecovery(config: SecurityConfig, previousStatus: string) {
    const typeLabel = config.type === 'accesskey' ? 'AccessKey' : 
                      config.type === 'ftp' ? 'FTP Password' : 
                      config.type === 'ssh' ? 'SSH Credential' : 'SSL Certificate';
    
    const message = `✅ ${typeLabel} "${config.name}" has been renewed and is now valid.`;
    
    // Get affected services names
    let affectedServiceNames: string[] = [];
    if (config.affected_services) {
      const serviceIds = JSON.parse(config.affected_services);
      if (serviceIds.length > 0) {
        const placeholders = serviceIds.map(() => '?').join(',');
        const services = db.prepare(`SELECT name FROM services WHERE id IN (${placeholders})`).all(...serviceIds) as any[];
        affectedServiceNames = services.map(s => s.name);
      }
    }

    await this.createRecoveryAlert(config, previousStatus, message, affectedServiceNames);
  }

  private static async createRecoveryAlert(config: SecurityConfig, previousStatus: string, message: string, affectedServices: string[]) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const nowLocal = this.toLocalTime(now);
    
    // Save alert to DB (use security_config_id for security configs, NOT service_id)
    db.prepare(`
      INSERT INTO alerts (id, security_config_id, type, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, config.id, 'recovery', message, now);
    
    // Gather detailed context for recovery
    const detailedData = this.gatherRecoveryContext(config, previousStatus, affectedServices, nowLocal);

    // Send Notifications
    const defaultEmail = await this.getSystemConfig('smtp_to');
    if (defaultEmail) {
      const subject = `[RECOVERY] ${config.name} Renewed`;
      const html = this.buildEmailHtml(subject, detailedData, '#67C23A');
      
      await NotificationService.sendEmail(defaultEmail, subject, html);
      
      // Update alert as notified
      db.prepare('UPDATE alerts SET notified = 1, notified_at = ? WHERE id = ?').run(now, id);
    }
    
    // Teams with detailed data
    const teamsWebhook = await this.getSystemConfig('teams_webhook');
    if (teamsWebhook) {
       try {
         const title = `✅ [RECOVERY] ${config.name}`;
         await NotificationService.sendTeamsNotification(teamsWebhook, detailedData.message, title, '5cb85c', detailedData);
       } catch (error: any) {
         logger.notification.error('Failed to send Teams notification for recovery', { 
           config: config.name, 
           error: error.message,
           status: error.response?.status,
           statusText: error.response?.statusText,
           data: error.response?.data
         });
       }
    }
  }

  private static gatherRecoveryContext(config: SecurityConfig, previousStatus: string, affectedServices: string[], now: string) {
    const typeLabel = config.type === 'accesskey' ? 'AccessKey' : 
                      config.type === 'ftp' ? 'FTP Password' : 
                      config.type === 'ssh' ? 'SSH Credential' : 'SSL Certificate';

    // Calculate new days remaining
    const daysRemaining = Math.ceil((new Date(config.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    // Build facts
    const facts: any[] = [
      { title: "🔑 Config Type", value: typeLabel },
      { title: "✅ Current Status", value: 'Normal' },
      { title: "⚠️ Previous Status", value: previousStatus.toUpperCase() },
      { title: "📅 New Expiry Date", value: config.expiry_date },
      { title: "📊 Days Remaining", value: `${daysRemaining} days` }
    ];

    // Build timeline
    const timeline: any[] = [
      {
        icon: '✅',
        label: 'Configuration Renewed',
        value: now
      },
      {
        icon: '📅',
        label: 'Valid Until',
        value: config.expiry_date,
        valueColor: 'good'
      },
      {
        icon: '📊',
        label: 'Validity Period',
        value: `${daysRemaining} days remaining`,
        valueColor: 'good'
      }
    ];

    if (config.last_reset_at) {
      timeline.push({
        icon: '🔄',
        label: 'Last Reset',
        value: config.last_reset_at
      });
    }

    // Build impact message
    const impact = `The ${typeLabel} has been successfully renewed. All services using this credential will continue to operate normally. No action required.`;

    // Build message
    const messageText = `Security configuration **${config.name}** has been renewed and is now valid for ${daysRemaining} more days.`;

    return {
      alertType: 'recovery',
      message: messageText,
      facts,
      impact,
      affectedServices,
      timeline,
      dashboardUrl: `http://localhost:5173/#/security-configs`,
      consoleUrl: `http://localhost:5173/#/dashboard`
    };
  }

  private static async createExpiryAlert(config: SecurityConfig, level: string, message: string, affectedServices: string[], daysRemaining: number) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const nowLocal = this.toLocalTime(now);
    
    // Save alert to DB (use security_config_id for security configs, NOT service_id)
    db.prepare(`
      INSERT INTO alerts (id, security_config_id, type, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, config.id, 'expiry', message, now);

    // Gather detailed context for expiry
    const detailedData = this.gatherExpiryContext(config, level, daysRemaining, affectedServices, nowLocal);

    // Send Notifications
    const defaultEmail = await this.getSystemConfig('smtp_to');
    if (defaultEmail) {
      const subject = `[${level.toUpperCase()}] ${config.name} Expiry Reminder`;
      const color = level === 'expired' ? '#ff0000' : (level === 'critical' ? '#ff4500' : '#ffa500');
      const html = this.buildEmailHtml(subject, detailedData, color);
      
      await NotificationService.sendEmail(defaultEmail, subject, html);
      
      // Update alert as notified
      db.prepare('UPDATE alerts SET notified = 1, notified_at = ? WHERE id = ?').run(now, id);
    }
    
    // Teams with detailed data
    const teamsWebhook = await this.getSystemConfig('teams_webhook');
    if (teamsWebhook) {
       try {
         const color = level === 'expired' ? 'd9534f' : (level === 'critical' ? 'f0ad4e' : 'ffc107');
         const title = `🔐 [${level.toUpperCase()}] ${config.name}`;
         await NotificationService.sendTeamsNotification(teamsWebhook, detailedData.message, title, color, detailedData);
       } catch (error: any) {
         logger.notification.error('Failed to send Teams notification for expiry', { 
           config: config.name, 
           level, 
           error: error.message,
           status: error.response?.status,
           statusText: error.response?.statusText,
           data: error.response?.data
         });
       }
    }
  }

  private static gatherExpiryContext(config: SecurityConfig, level: string, daysRemaining: number, affectedServices: string[], now: string) {
    const typeLabel = config.type === 'accesskey' ? 'AccessKey' : 
                      config.type === 'ftp' ? 'FTP Password' : 
                      config.type === 'ssh' ? 'SSH Credential' : 'SSL Certificate';

    // Build facts
    const facts: any[] = [
      { title: "🔑 Config Type", value: typeLabel },
      { title: "⚠️ Expiry Status", value: daysRemaining <= 0 ? 'EXPIRED' : `Expires in ${daysRemaining} day(s)` },
      { title: "📅 Expiry Date", value: config.expiry_date },
      { title: "📅 Created Date", value: config.created_at || 'N/A' }
    ];

    // Build timeline
    const timeline: any[] = [
      {
        icon: '📅',
        label: 'Days Remaining',
        value: daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining} day(s)`,
        valueColor: daysRemaining <= 0 ? 'attention' : (daysRemaining <= 3 ? 'warning' : 'default')
      },
      {
        icon: '🔔',
        label: 'Reminder Schedule',
        value: config.reminder_days ? `Reminders at: ${JSON.parse(config.reminder_days).join(', ')} days before expiry` : 'Default schedule'
      },
      {
        icon: '📊',
        label: 'Usage Statistics',
        value: affectedServices.length > 0 ? `${affectedServices.length} service(s) using this credential` : 'No services linked'
      }
    ];

    // Build impact message
    const impact = daysRemaining <= 0 ?
      `This credential has EXPIRED. All services using this ${typeLabel} will fail to authenticate. Please update the credential configuration immediately.` :
      `This ${typeLabel} will expire soon. After expiration, all services using this credential will be unable to access the required resources. Please update in advance to avoid service interruptions.`;

    // Build message
    const messageText = `Security configuration **${config.name}** ${daysRemaining <= 0 ? 'has expired' : `will expire in ${daysRemaining} day(s)`}. ${daysRemaining <= 3 ? 'Immediate action required!' : 'Please plan for renewal.'}`;

    return {
      alertType: 'expiry',
      message: messageText,
      facts,
      impact,
      affectedServices,
      timeline,
      dashboardUrl: `http://localhost:5173/#/security-configs`,
      consoleUrl: `http://localhost:5173/#/dashboard`
    };
  }

  private static async createAlert(service: Service, type: 'down' | 'warning' | 'recovery' | 'expiry', message: string) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const nowLocal = this.toLocalTime(now);
    
    // 1. Save alert to DB
    db.prepare(`
      INSERT INTO alerts (id, service_id, type, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, service.id, type, message, now);

    // 2. Gather detailed context
    const detailedData = await this.gatherServiceContext(service, type, nowLocal);

    // 3. Send Notifications
    const defaultEmail = await this.getSystemConfig('smtp_to');
    if (defaultEmail) {
      const subject = `[${type.toUpperCase()}] ${service.name}`;
      const color = type === 'down' ? '#ff0000' : (type === 'recovery' ? '#00ff00' : '#ffa500');
      const html = this.buildEmailHtml(subject, detailedData, color);
      
      await NotificationService.sendEmail(defaultEmail, subject, html);
      
      // Update alert as notified
      db.prepare('UPDATE alerts SET notified = 1, notified_at = ? WHERE id = ?').run(now, id);
    }
    
    // Teams with detailed data
    const teamsWebhook = await this.getSystemConfig('teams_webhook');
    if (teamsWebhook) {
       try {
         const color = type === 'down' ? 'd9534f' : (type === 'recovery' ? '5cb85c' : 'f0ad4e');
         const title = this.buildAlertTitle(service.name, type);
         await NotificationService.sendTeamsNotification(teamsWebhook, detailedData.message, title, color, detailedData);
       } catch (error: any) {
         logger.notification.error('Failed to send Teams notification for service alert', { 
           service: service.name, 
           type, 
           error: error.message,
           status: error.response?.status,
           statusText: error.response?.statusText,
           data: error.response?.data
         });
       }
    }
  }

  private static buildAlertTitle(serviceName: string, type: string): string {
    const prefix = type === 'down' ? '🔴 [DOWN]' :
                   type === 'recovery' ? '🟢 [RECOVERY]' :
                   '🟡 [WARNING]';
    return `${prefix} ${serviceName}`;
  }

  private static async gatherServiceContext(service: Service, type: string, now: string) {
    // Get project info
    const project = service.project_id ? 
      db.prepare('SELECT name FROM projects WHERE id = ?').get(service.project_id) as any : 
      null;

    // Get previous check for timeline
    const prevCheck = db.prepare(`
      SELECT status, checked_at, response_time 
      FROM check_records 
      WHERE service_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1 OFFSET 1
    `).get(service.id) as any;

    // Get latest check
    const latestCheck = db.prepare(`
      SELECT status, checked_at, response_time, error_message 
      FROM check_records 
      WHERE service_id = ? 
      ORDER BY checked_at DESC 
      LIMIT 1
    `).get(service.id) as any;

    // Get dependent services
    const dependentServices = db.prepare(`
      SELECT s.name 
      FROM service_dependencies sd
      JOIN services s ON s.id = sd.source_service_id
      WHERE sd.target_service_id = ?
    `).all(service.id) as any[];

    // Build facts
    const facts: any[] = [
      { title: "📁 Project", value: project?.name || 'N/A' },
      { title: "⚠️ Risk Level", value: this.formatRiskLevel(service.risk_level) },
      { title: "🌐 Address", value: `${service.host}:${service.port}` },
      { title: "🔍 Check Type", value: service.check_type?.toUpperCase() || 'N/A' }
    ];

    // Build timeline
    const timeline: any[] = [];
    
    if (type === 'down') {
      timeline.push({
        icon: '❌',
        label: 'Failure Detected',
        value: now
      });
      if (prevCheck) {
        const minutesAgo = Math.round((new Date().getTime() - new Date(prevCheck.checked_at).getTime()) / 60000);
        const lastCheckLocal = this.toLocalTime(prevCheck.checked_at);
        timeline.push({
          icon: '📊',
          label: 'Last Successful Check',
          value: `${lastCheckLocal} (${minutesAgo} minutes ago)`
        });
      }
      if (latestCheck?.error_message) {
        timeline.push({
          icon: '🔧',
          label: 'Error Message',
          value: latestCheck.error_message,
          valueColor: 'attention'
        });
      }
    } else if (type === 'recovery') {
      timeline.push({
        icon: '✅',
        label: 'Service Recovered',
        value: now
      });
      if (prevCheck && latestCheck) {
        const downDuration = Math.round((new Date().getTime() - new Date(prevCheck.checked_at).getTime()) / 1000);
        const minutes = Math.floor(downDuration / 60);
        const seconds = downDuration % 60;
        timeline.push({
          icon: '⏱️',
          label: 'Downtime Duration',
          value: `${minutes}m ${seconds}s`
        });
      }
      if (latestCheck) {
        timeline.push({
          icon: '📈',
          label: 'Current Status',
          value: `Healthy (Response: ${latestCheck.response_time}ms)`,
          valueColor: 'good'
        });
      }
    } else if (type === 'warning') {
      facts.push(
        { title: "📊 Response Time", value: `${latestCheck?.response_time || 'N/A'}ms` },
        { title: "⏱️ Warning Threshold", value: `${service.warning_threshold}s` }
      );
      timeline.push({
        icon: '⚠️',
        label: 'Slow Response Detected',
        value: now
      });
    }

    // Build impact message
    let impact = service.impact_description || this.getDefaultImpact(type, service.name);
    
    // Affected services
    const affectedServices = dependentServices.map(s => s.name);

    // Build message
    const messageText = type === 'down' ?
      `Service **${service.name}** is currently unavailable. Immediate attention required!` :
      type === 'recovery' ?
      `Service **${service.name}** has recovered and is now operational.` :
      `Service **${service.name}** is experiencing slow response times.`;

    return {
      alertType: type,
      message: messageText,
      facts,
      impact,
      affectedServices,
      timeline,
      dashboardUrl: `http://localhost:5173/#/services`,
      consoleUrl: `http://localhost:5173/#/dashboard`
    };
  }

  private static formatRiskLevel(level: string): string {
    const map: any = {
      'critical': 'Critical (Severe)',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return map[level] || level;
  }

  private static getDefaultImpact(type: string, serviceName: string): string {
    if (type === 'down') {
      return `Service disruption detected. Users may be unable to access ${serviceName}. Please check server status and network connectivity immediately.`;
    } else if (type === 'warning') {
      return `Performance degradation detected. Slow response times may affect user experience. Consider checking database queries, server load, and network conditions.`;
    } else {
      return `Service has returned to normal operation. All functionality is now available.`;
    }
  }
  
  private static async getSystemConfig(key: string): Promise<string | null> {
    const row = db.prepare('SELECT value FROM system_configs WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  private static buildEmailHtml(subject: string, detailedData: any, color: string): string {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: ${color}; color: white; padding: 20px; border-radius: 5px; }
          .content { padding: 20px; background: #f9f9f9; margin-top: 20px; border-radius: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; color: #555; margin-bottom: 10px; font-size: 16px; }
          .fact-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
          .fact-title { font-weight: bold; min-width: 150px; color: #666; }
          .fact-value { color: #333; }
          .timeline-item { padding: 10px 0; border-left: 3px solid ${color}; padding-left: 15px; margin-left: 10px; }
          .timeline-icon { font-size: 18px; margin-right: 8px; }
          .impact { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 3px; margin: 15px 0; }
          .services-list { background: white; padding: 10px; border-radius: 3px; }
          .service-tag { display: inline-block; background: #e3f2fd; padding: 4px 12px; margin: 4px; border-radius: 12px; font-size: 14px; }
          .links { margin-top: 20px; padding-top: 20px; border-top: 2px solid #ddd; }
          .link-button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">${subject}</h2>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-bottom: 20px;">${detailedData.message}</p>
    `;

    // Facts section
    if (detailedData.facts && detailedData.facts.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">📊 Details</div>
          <div style="background: white; padding: 15px; border-radius: 5px;">
      `;
      detailedData.facts.forEach((fact: any) => {
        html += `
          <div class="fact-row">
            <div class="fact-title">${fact.title}</div>
            <div class="fact-value">${fact.value}</div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    // Timeline section
    if (detailedData.timeline && detailedData.timeline.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">⏰ Timeline</div>
      `;
      detailedData.timeline.forEach((item: any) => {
        const valueColor = item.valueColor === 'attention' ? 'color: #d9534f;' :
                          item.valueColor === 'warning' ? 'color: #f0ad4e;' :
                          item.valueColor === 'good' ? 'color: #5cb85c;' : '';
        html += `
          <div class="timeline-item">
            <span class="timeline-icon">${item.icon}</span>
            <strong>${item.label}:</strong> 
            <span style="${valueColor}">${item.value}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Impact section
    if (detailedData.impact) {
      html += `
        <div class="section">
          <div class="section-title">⚠️ Impact</div>
          <div class="impact">${detailedData.impact}</div>
        </div>
      `;
    }

    // Affected Services section
    if (detailedData.affectedServices && detailedData.affectedServices.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">🔗 Affected Services (${detailedData.affectedServices.length})</div>
          <div class="services-list">
      `;
      detailedData.affectedServices.forEach((service: string) => {
        html += `<span class="service-tag">${service}</span>`;
      });
      html += `</div></div>`;
    }

    // Links section
    html += `
      <div class="links">
        <a href="${detailedData.dashboardUrl || 'http://localhost:5173/#/dashboard'}" class="link-button">View Dashboard</a>
        <a href="${detailedData.consoleUrl || 'http://localhost:5173/#/dashboard'}" class="link-button">Open Console</a>
      </div>
    `;

    html += `
        </div>
      </body>
      </html>
    `;

    return html;
  }
}

