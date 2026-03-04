import nodemailer from 'nodemailer';
import axios from 'axios';
import https from 'https';
import db from '../db/database';
import logger from '../utils/logger';

// Create axios instance that ignores SSL certificate errors (for Power Automate webhooks)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

interface SystemConfig {
  key: string;
  value: string;
}

export class NotificationService {
  private static async getConfig(key: string): Promise<string | null> {
    const row = db.prepare('SELECT value FROM system_configs WHERE key = ?').get(key) as SystemConfig | undefined;
    return row ? row.value : null;
  }

  static async sendEmail(to: string, subject: string, html: string) {
    const host = await this.getConfig('smtp_host');
    const port = await this.getConfig('smtp_port');
    const user = await this.getConfig('smtp_user');
    const pass = await this.getConfig('smtp_pass');

    if (!host || !port || !user || !pass) {
      const missing = [];
      if (!host) missing.push('smtp_host');
      if (!port) missing.push('smtp_port');
      if (!user) missing.push('smtp_user');
      if (!pass) missing.push('smtp_pass');
      
      const error = `SMTP configuration incomplete. Missing: ${missing.join(', ')}`;
      logger.notification.error(error);
      throw new Error(error);
    }

    const from = await this.getConfig('smtp_from') || user;
    const portNum = parseInt(port);

    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure: portNum === 465, // true for 465 (SSL), false for other ports (STARTTLS)
      auth: { user, pass },
      // Add timeout and connection options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    try {
      await transporter.sendMail({ from, to, subject, html });
      logger.notification.info('Email sent successfully', { to, subject });
    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      logger.notification.error('Failed to send email', { to, subject, error: errorMsg });
      
      // Provide more helpful error messages
      if (errorMsg.includes('socket close') || errorMsg.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to SMTP server ${host}:${port}. Please verify: 1) Server address is correct 2) Port number is correct (common: 25, 465, 587, 2525) 3) Firewall allows outbound connection`);
      } else if (errorMsg.includes('authentication') || errorMsg.includes('Invalid login')) {
        throw new Error(`SMTP authentication failed. Please verify username and password are correct`);
      } else {
        throw new Error(`SMTP error: ${errorMsg}`);
      }
    }
  }

  static async sendTeamsNotification(webhookUrl: string, message: string, title: string, color: string = '0076D7', detailedData?: any) {
    if (!webhookUrl) return;

    // Detect webhook type based on URL pattern
    const isPowerAutomate = webhookUrl.includes('api.powerplatform.com') || 
                            webhookUrl.includes('logic.azure.com') ||
                            webhookUrl.includes('.azure-apim.net');

    let payload: any;

    if (isPowerAutomate) {
      // Power Automate Workflow - use Adaptive Card format
      if (detailedData) {
        payload = this.buildDetailedAdaptiveCard(title, message, color, detailedData);
      } else {
        // Fallback to simple format
        const style = color === 'd9534f' ? 'attention' : 
                      color === 'f0ad4e' ? 'warning' : 
                      color === '5cb85c' ? 'good' : 'accent';
        
        payload = {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
              "type": "AdaptiveCard",
              "version": "1.4",
              "body": [
                {
                  "type": "TextBlock",
                  "text": title,
                  "weight": "bolder",
                  "size": "medium",
                  "style": "heading",
                  "color": style
                },
                {
                  "type": "TextBlock",
                  "text": message,
                  "wrap": true
                },
                {
                  "type": "TextBlock",
                  "text": `🕐 ${new Date().toLocaleString()}`,
                  "size": "small",
                  "isSubtle": true
                }
              ],
              "msteams": {
                "width": "Full"
              }
            }
          }]
        };
      }
    } else {
      // Legacy Office 365 Connector - use MessageCard format
      payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color,
        "summary": title,
        "sections": [{
          "activityTitle": title,
          "text": message
        }]
      };
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent // Skip SSL certificate verification for Power Automate
      });
      logger.notification.info('Teams notification sent successfully', { 
        status: response.status, 
        title,
        webhookType: isPowerAutomate ? 'Power Automate' : 'Office 365 Connector'
      });
    } catch (error: any) {
      const errorDetail = {
        title,
        webhookUrl: webhookUrl.substring(0, 50) + '...', // Only log first 50 chars for security
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      };
      logger.notification.error('Failed to send Teams notification', errorDetail);
      throw error; // Re-throw so caller knows it failed
    }
  }

  private static buildDetailedAdaptiveCard(title: string, message: string, color: string, data: any) {
    const style = color === 'd9534f' ? 'attention' : 
                  color === 'f0ad4e' ? 'warning' : 
                  color === '5cb85c' ? 'good' : 'accent';

    const iconMap: any = {
      'down': '🚨',
      'recovery': '✅',
      'warning': '⚠️',
      'expiry': '🔐'
    };

    const body: any[] = [
      {
        "type": "ColumnSet",
        "columns": [
          {
            "type": "Column",
            "width": "auto",
            "items": [
              {
                "type": "TextBlock",
                "text": iconMap[data.alertType] || '🔔',
                "size": "large"
              }
            ]
          },
          {
            "type": "Column",
            "width": "stretch",
            "items": [
              {
                "type": "TextBlock",
                "text": "OpsMonitor Notification",
                "weight": "bolder",
                "size": "medium"
              },
              {
                "type": "TextBlock",
                "text": "Service Monitoring Alert System",
                "size": "small",
                "isSubtle": true
              }
            ]
          }
        ]
      },
      {
        "type": "TextBlock",
        "text": title,
        "weight": "bolder",
        "size": "large",
        "color": style,
        "spacing": "medium"
      },
      {
        "type": "TextBlock",
        "text": message,
        "wrap": true,
        "spacing": "small"
      }
    ];

    // Add info facts
    if (data.facts && data.facts.length > 0) {
      body.push({
        "type": "FactSet",
        "facts": data.facts,
        "spacing": "medium"
      });
    }

    // Add impact section
    if (data.impact) {
      body.push({
        "type": "Container",
        "style": color === 'd9534f' ? 'attention' : 'warning',
        "spacing": "medium",
        "items": [
          {
            "type": "TextBlock",
            "text": "⚡ Impact Scope",
            "weight": "bolder",
            "size": "small"
          },
          {
            "type": "TextBlock",
            "text": data.impact,
            "wrap": true,
            "size": "small"
          }
        ]
      });
    }

    // Add affected services
    if (data.affectedServices && data.affectedServices.length > 0) {
      body.push({
        "type": "TextBlock",
        "text": "**Affected Services:** " + data.affectedServices.join(', '),
        "wrap": true,
        "size": "small",
        "spacing": "small"
      });
    }

    // Add timeline
    if (data.timeline && data.timeline.length > 0) {
      const timelineItems: any[] = [];
      data.timeline.forEach((item: any) => {
        timelineItems.push({
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "TextBlock",
                  "text": item.icon || "•",
                  "size": "small"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": `**${item.label}**`,
                  "size": "small",
                  "wrap": true
                },
                {
                  "type": "TextBlock",
                  "text": item.value,
                  "size": "small",
                  "wrap": true,
                  "color": item.valueColor || 'default'
                }
              ]
            }
          ],
          "spacing": "small"
        });
      });

      body.push({
        "type": "Container",
        "style": "emphasis",
        "spacing": "medium",
        "items": timelineItems
      });
    }

    // Add actions
    const actions: any[] = [];
    if (data.dashboardUrl) {
      actions.push({
        "type": "Action.OpenUrl",
        "title": "View Details",
        "url": data.dashboardUrl
      });
    }
    if (data.consoleUrl) {
      actions.push({
        "type": "Action.OpenUrl",
        "title": "Go to Console",
        "url": data.consoleUrl
      });
    }

    // Add footer
    body.push({
      "type": "TextBlock",
      "text": `OpsMonitor · ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`,
      "size": "small",
      "isSubtle": true,
      "spacing": "medium",
      "separator": true
    });

    return {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": body,
          "actions": actions.length > 0 ? actions : undefined,
          "msteams": {
            "width": "Full"
          }
        }
      }]
    };
  }
}
