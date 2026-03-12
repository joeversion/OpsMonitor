import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notification-service';
import { logger } from '../utils/logger';
import { nt, getTypeLabel } from '../utils/notification-i18n';

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

  static async processCheckResult(service: Service, result: CheckResult): Promise<CheckResult> {
    if (!service.alert_enabled) return result;

    const rawStatus = result.status;
    
    // Get thresholds
    const warningThreshold = (service as any).warning_threshold ?? 3;
    const errorThreshold = (service as any).error_threshold ?? 5;
    const failureThreshold = (service as any).failure_threshold ?? 3;

    let effectiveResult = { ...result };

    if (rawStatus === 'down' || rawStatus === 'warning') {
      // Atomically increment and return the new count
      const newCount = db.transaction(() => {
        const row = db.prepare('SELECT current_failure_count FROM services WHERE id = ?').get(service.id) as any;
        const count = (row?.current_failure_count ?? 0) + 1;
        db.prepare('UPDATE services SET current_failure_count = ? WHERE id = ?').run(count, service.id);
        return count;
      })();
      
      logger.alert.debug(`Service ${service.name} failure count: ${newCount} (warn:${warningThreshold} err:${errorThreshold} alert:${failureThreshold})`);

      // Determine effective status based on consecutive failure counts
      if (newCount < warningThreshold) {
        // Below warning threshold: treat as UP (transient failure, suppress)
        effectiveResult = { ...result, status: 'up', error: undefined };
      } else if (newCount < errorThreshold) {
        // Between warning and error threshold: WARNING
        effectiveResult = { ...result, status: 'warning' };
      } else {
        // At or above error threshold: DOWN
        effectiveResult = { ...result, status: rawStatus === 'warning' ? 'warning' : 'down' };
      }

      // Read current is_alerted value
      const currentIsAlerted = (db.prepare('SELECT is_alerted FROM services WHERE id = ?').get(service.id) as any)?.is_alerted ?? 0;

      // Send alert notification when failure_threshold is reached exactly (first alert)
      if (newCount === failureThreshold) {
        if (effectiveResult.status === 'down') {
          await this.createAlert(service, 'down', nt('alert.serviceDown', { name: service.name, count: newCount, error: result.error || 'Unknown error' }));
          db.prepare('UPDATE services SET is_alerted = 1 WHERE id = ?').run(service.id);
        } else if (effectiveResult.status === 'warning') {
          await this.createAlert(service, 'warning', nt('alert.serviceWarning', { name: service.name, count: newCount, time: result.responseTime }));
          db.prepare('UPDATE services SET is_alerted = 1 WHERE id = ?').run(service.id);
        }
      } else if (newCount === errorThreshold && currentIsAlerted === 1 && effectiveResult.status === 'down') {
        // alertTrigger < errorThreshold case: first alert fired as WARNING, but now service is DOWN.
        // Send a DOWN escalation notification so the user knows the status has worsened.
        await this.createAlert(service, 'down', nt('alert.serviceDown', { name: service.name, count: newCount, error: result.error || 'Unknown error' }));
        db.prepare('UPDATE services SET is_alerted = 1 WHERE id = ?').run(service.id);
        logger.alert.debug(`Service ${service.name} escalated from WARNING to DOWN alert at count=${newCount}`);
      } else if (newCount > failureThreshold) {
        // Already alerted, suppress until recovery
        logger.alert.debug(`Service ${service.name} still down/warning, suppressing repeat alert (is_alerted=${currentIsAlerted})`);
      }
      // If count < failureThreshold, no alert yet (transient failure)
      
    } else if (rawStatus === 'up') {
      // Atomically read is_alerted + count, then reset both
      const { wasAlerted, prevCount } = db.transaction(() => {
        const row = db.prepare('SELECT current_failure_count, is_alerted FROM services WHERE id = ?').get(service.id) as any;
        const count = row?.current_failure_count ?? 0;
        const alerted = (row?.is_alerted ?? 0) >= 1;
        db.prepare('UPDATE services SET current_failure_count = 0, is_alerted = 0 WHERE id = ?').run(service.id);
        return { wasAlerted: alerted, prevCount: count };
      })();

      if (wasAlerted) {
        // Was in alerted state, now recovered - send recovery
        await this.createAlert(service, 'recovery', nt('alert.serviceRecovery', { name: service.name, count: prevCount }));
        logger.alert.debug(`Service ${service.name} recovered, reset failure count`);
      } else if (prevCount > 0) {
        logger.alert.debug(`Service ${service.name} recovered (below threshold), reset failure count`);
      }
    }

    return effectiveResult;
  }

  static async processSecurityConfigExpiry(config: SecurityConfig, daysRemaining: number) {
    let alertLevel: 'warning' | 'critical' | 'expired';
    let message: string;
    
    const typeLabel = getTypeLabel(config.type);
    
    if (daysRemaining <= 0) {
      alertLevel = 'expired';
      message = nt('sec.expired', { typeLabel, name: config.name });
    } else if (daysRemaining <= 3) {
      alertLevel = 'critical';
      message = nt('sec.critical', { typeLabel, name: config.name, days: daysRemaining });
    } else {
      alertLevel = 'warning';
      message = nt('sec.warning', { typeLabel, name: config.name, days: daysRemaining });
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
    const typeLabel = getTypeLabel(config.type);
    
    const message = nt('sec.renewed', { typeLabel, name: config.name });
    
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
      const subject = nt('email.subjectRecoveryRenewed', { name: config.name });
      const html = this.buildEmailHtml(subject, detailedData, '#67C23A');
      
      await NotificationService.sendEmail(defaultEmail, subject, html);
      
      // Update alert as notified
      db.prepare('UPDATE alerts SET notified = 1, notified_at = ? WHERE id = ?').run(now, id);
    }
    
    // Teams with detailed data
    const teamsWebhook = await this.getSystemConfig('teams_webhook');
    if (teamsWebhook) {
       try {
         const title = nt('teams.recoveryTitle', { name: config.name });
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
    const typeLabel = getTypeLabel(config.type);

    // Calculate new days remaining
    const daysRemaining = Math.ceil((new Date(config.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    // Build facts
    const facts: any[] = [
      { title: nt('fact.configType'), value: typeLabel },
      { title: nt('fact.currentStatus'), value: nt('val.normal') },
      { title: nt('fact.previousStatus'), value: previousStatus.toUpperCase() },
      { title: nt('fact.newExpiryDate'), value: config.expiry_date },
      { title: nt('fact.daysRemaining'), value: nt('val.daysUnit', { days: daysRemaining }) }
    ];

    // Build timeline
    const timeline: any[] = [
      {
        icon: '✅',
        label: nt('tl.configRenewed'),
        value: now
      },
      {
        icon: '📅',
        label: nt('tl.validUntil'),
        value: config.expiry_date,
        valueColor: 'good'
      },
      {
        icon: '📊',
        label: nt('tl.validityPeriod'),
        value: nt('val.daysRemaining', { days: daysRemaining }),
        valueColor: 'good'
      }
    ];

    if (config.last_reset_at) {
      timeline.push({
        icon: '🔄',
        label: nt('tl.lastReset'),
        value: config.last_reset_at
      });
    }

    // Build impact message
    const impact = nt('sec.recoveryImpact', { typeLabel });

    // Build message
    const messageText = nt('sec.recoveryMessage', { name: config.name, days: daysRemaining });

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
      const subject = nt('email.subjectExpiryReminder', { level: level.toUpperCase(), name: config.name });
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
         const title = nt('teams.expiryTitle', { level: level.toUpperCase(), name: config.name });
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
    const typeLabel = getTypeLabel(config.type);

    // Build facts
    const facts: any[] = [
      { title: nt('fact.configType'), value: typeLabel },
      { title: nt('fact.expiryStatus'), value: daysRemaining <= 0 ? nt('val.expired') : nt('val.expiresInDays', { days: daysRemaining }) },
      { title: nt('fact.expiryDate'), value: config.expiry_date },
      { title: nt('fact.createdDate'), value: config.created_at || nt('val.na') }
    ];

    // Build timeline
    const timeline: any[] = [
      {
        icon: '📅',
        label: nt('tl.daysRemainingLabel'),
        value: daysRemaining <= 0 ? nt('val.expired') : nt('val.daysUnit', { days: daysRemaining }),
        valueColor: daysRemaining <= 0 ? 'attention' : (daysRemaining <= 3 ? 'warning' : 'default')
      },
      {
        icon: '🔔',
        label: nt('tl.reminderSchedule'),
        value: config.reminder_days ? nt('val.remindersAt', { days: JSON.parse(config.reminder_days).join(', ') }) : nt('val.defaultSchedule')
      },
      {
        icon: '📊',
        label: nt('tl.usageStats'),
        value: affectedServices.length > 0 ? nt('val.servicesUsing', { count: affectedServices.length }) : nt('val.noServicesLinked')
      }
    ];

    // Build impact message
    const impact = daysRemaining <= 0 ?
      nt('sec.expiryImpactExpired', { typeLabel }) :
      nt('sec.expiryImpactSoon', { typeLabel });

    // Build message
    const messageText = daysRemaining <= 0
      ? nt('sec.expiryMessageExpired', { name: config.name })
      : nt('sec.expiryMessageSoon', { name: config.name, days: daysRemaining, urgency: daysRemaining <= 3 ? nt('sec.urgencyImmediate') : nt('sec.urgencyPlan') });

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
      const subject = nt('email.subjectServiceAlert', { type: type.toUpperCase(), name: service.name });
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
    const prefix = type === 'down' ? nt('teams.prefixDown') :
                   type === 'recovery' ? nt('teams.prefixRecovery') :
                   nt('teams.prefixWarning');
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
      { title: nt('fact.project'), value: project?.name || nt('val.na') },
      { title: nt('fact.riskLevel'), value: this.formatRiskLevel(service.risk_level) },
      { title: nt('fact.address'), value: `${service.host}:${service.port}` },
      { title: nt('fact.checkType'), value: service.check_type?.toUpperCase() || nt('val.na') }
    ];

    // Build timeline
    const timeline: any[] = [];
    
    if (type === 'down') {
      timeline.push({
        icon: '❌',
        label: nt('tl.failureDetected'),
        value: now
      });
      if (prevCheck) {
        const minutesAgo = Math.round((new Date().getTime() - new Date(prevCheck.checked_at).getTime()) / 60000);
        const lastCheckLocal = this.toLocalTime(prevCheck.checked_at);
        timeline.push({
          icon: '📊',
          label: nt('tl.lastSuccessfulCheck'),
          value: nt('tl.lastCheckAgo', { time: lastCheckLocal, minutes: minutesAgo })
        });
      }
      if (latestCheck?.error_message) {
        timeline.push({
          icon: '🔧',
          label: nt('tl.errorMessage'),
          value: latestCheck.error_message,
          valueColor: 'attention'
        });
      }
    } else if (type === 'recovery') {
      timeline.push({
        icon: '✅',
        label: nt('tl.serviceRecovered'),
        value: now
      });
      if (prevCheck && latestCheck) {
        const downDuration = Math.round((new Date().getTime() - new Date(prevCheck.checked_at).getTime()) / 1000);
        const minutes = Math.floor(downDuration / 60);
        const seconds = downDuration % 60;
        timeline.push({
          icon: '⏱️',
          label: nt('tl.downtimeDuration'),
          value: nt('tl.downtimeValue', { m: minutes, s: seconds })
        });
      }
      if (latestCheck) {
        timeline.push({
          icon: '📈',
          label: nt('tl.currentStatus'),
          value: nt('tl.healthyResponse', { time: latestCheck.response_time }),
          valueColor: 'good'
        });
      }
    } else if (type === 'warning') {
      facts.push(
        { title: nt('fact.responseTime'), value: `${latestCheck?.response_time || nt('val.na')}ms` },
        { title: nt('fact.warningThreshold'), value: `${service.warning_threshold} ${nt('val.times')}` }
      );
      timeline.push({
        icon: '⚠️',
        label: nt('tl.slowResponse'),
        value: now
      });
    }

    // Build impact message
    let impact = service.impact_description || this.getDefaultImpact(type, service.name);
    
    // Affected services
    const affectedServices = dependentServices.map(s => s.name);

    // Build message
    const messageText = type === 'down' ?
      nt('alert.serviceDownMsg', { name: service.name }) :
      type === 'recovery' ?
      nt('alert.serviceRecoveryMsg', { name: service.name }) :
      nt('alert.serviceWarningMsg', { name: service.name });

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
      'critical': nt('risk.critical'),
      'high': nt('risk.high'),
      'medium': nt('risk.medium'),
      'low': nt('risk.low')
    };
    return map[level] || level;
  }

  private static getDefaultImpact(type: string, serviceName: string): string {
    if (type === 'down') {
      return nt('impact.down', { name: serviceName });
    } else if (type === 'warning') {
      return nt('impact.warning');
    } else {
      return nt('impact.recovery');
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
          <div class="section-title">${nt('html.details')}</div>
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
          <div class="section-title">${nt('html.timeline')}</div>
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
          <div class="section-title">${nt('html.impact')}</div>
          <div class="impact">${detailedData.impact}</div>
        </div>
      `;
    }

    // Affected Services section
    if (detailedData.affectedServices && detailedData.affectedServices.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">${nt('html.affectedServices', { count: detailedData.affectedServices.length })}</div>
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
        <a href="${detailedData.dashboardUrl || 'http://localhost:5173/#/dashboard'}" class="link-button">${nt('html.viewDashboard')}</a>
        <a href="${detailedData.consoleUrl || 'http://localhost:5173/#/dashboard'}" class="link-button">${nt('html.openConsole')}</a>
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

