/**
 * Backend i18n for notification messages (Email / Teams alerts).
 * Language preference is stored in system_configs as 'notification_lang'.
 */
import db from '../db/database';

export type Lang = 'zh-CN' | 'en-US';

const messages: Record<Lang, Record<string, string>> = {
  'en-US': {
    // ── Service Alert Messages ──
    'alert.serviceDown': 'Service {name} is DOWN after {count} consecutive failures. Error: {error}',
    'alert.serviceWarning': 'Service {name} is in WARNING state after {count} consecutive slow responses. Response time: {time}ms',
    'alert.serviceRecovery': 'Service {name} has recovered after {count} consecutive failures.',

    // ── Service Alert Detail Messages ──
    'alert.serviceDownMsg': 'Service **{name}** is currently unavailable. Immediate attention required!',
    'alert.serviceRecoveryMsg': 'Service **{name}** has recovered and is now operational.',
    'alert.serviceWarningMsg': 'Service **{name}** is experiencing slow response times.',

    // ── Email Subjects ──
    'email.subjectServiceAlert': '[{type}] {name}',
    'email.subjectExpiryReminder': '[{level}] {name} Expiry Reminder',
    'email.subjectRecoveryRenewed': '[RECOVERY] {name} Renewed',

    // ── Teams Alert Titles ──
    'teams.prefixDown': '🔴 [DOWN]',
    'teams.prefixRecovery': '🟢 [RECOVERY]',
    'teams.prefixWarning': '🟡 [WARNING]',
    'teams.expiryTitle': '🔐 [{level}] {name}',
    'teams.recoveryTitle': '✅ [RECOVERY] {name}',

    // ── Security Config Type Labels ──
    'secType.accesskey': 'AccessKey',
    'secType.ftp': 'FTP Password',
    'secType.ssh': 'SSH Credential',
    'secType.ssl': 'SSL Certificate',

    // ── Security Config Expiry Messages ──
    'sec.expired': '⚠️ {typeLabel} "{name}" has EXPIRED! Please update immediately.',
    'sec.critical': '🔴 {typeLabel} "{name}" will expire in {days} day(s)! Please update as soon as possible.',
    'sec.warning': '⚠️ {typeLabel} "{name}" will expire in {days} day(s). Please take note.',
    'sec.renewed': '✅ {typeLabel} "{name}" has been renewed and is now valid.',

    // ── Security Recovery Context ──
    'sec.recoveryMessage': 'Security configuration **{name}** has been renewed and is now valid for {days} more days.',
    'sec.recoveryImpact': 'The {typeLabel} has been successfully renewed. All services using this credential will continue to operate normally. No action required.',

    // ── Security Expiry Context ──
    'sec.expiryMessageExpired': 'Security configuration **{name}** has expired. Immediate action required!',
    'sec.expiryMessageSoon': 'Security configuration **{name}** will expire in {days} day(s). {urgency}',
    'sec.urgencyImmediate': 'Immediate action required!',
    'sec.urgencyPlan': 'Please plan for renewal.',
    'sec.expiryImpactExpired': 'This credential has EXPIRED. All services using this {typeLabel} will fail to authenticate. Please update the credential configuration immediately.',
    'sec.expiryImpactSoon': 'This {typeLabel} will expire soon. After expiration, all services using this credential will be unable to access the required resources. Please update in advance to avoid service interruptions.',

    // ── Fact Titles ──
    'fact.project': '📁 Project',
    'fact.riskLevel': '⚠️ Risk Level',
    'fact.address': '🌐 Address',
    'fact.checkType': '🔍 Check Type',
    'fact.responseTime': '📊 Response Time',
    'fact.warningThreshold': '⏱️ Warning Threshold',
    'fact.configType': '🔑 Config Type',
    'fact.currentStatus': '✅ Current Status',
    'fact.previousStatus': '⚠️ Previous Status',
    'fact.newExpiryDate': '📅 New Expiry Date',
    'fact.daysRemaining': '📊 Days Remaining',
    'fact.expiryStatus': '⚠️ Expiry Status',
    'fact.expiryDate': '📅 Expiry Date',
    'fact.createdDate': '📅 Created Date',

    // ── Fact Values ──
    'val.na': 'N/A',
    'val.normal': 'Normal',
    'val.expired': 'EXPIRED',
    'val.expiresInDays': 'Expires in {days} day(s)',
    'val.daysUnit': '{days} days',
    'val.daysRemaining': '{days} days remaining',
    'val.servicesUsing': '{count} service(s) using this credential',
    'val.noServicesLinked': 'No services linked',
    'val.defaultSchedule': 'Default schedule',
    'val.remindersAt': 'Reminders at: {days} days before expiry',

    // ── Timeline Labels ──
    'tl.failureDetected': 'Failure Detected',
    'tl.lastSuccessfulCheck': 'Last Successful Check',
    'tl.lastCheckAgo': '{time} ({minutes} minutes ago)',
    'tl.errorMessage': 'Error Message',
    'tl.serviceRecovered': 'Service Recovered',
    'tl.downtimeDuration': 'Downtime Duration',
    'tl.downtimeValue': '{m}m {s}s',
    'tl.currentStatus': 'Current Status',
    'tl.healthyResponse': 'Healthy (Response: {time}ms)',
    'tl.slowResponse': 'Slow Response Detected',
    'tl.configRenewed': 'Configuration Renewed',
    'tl.validUntil': 'Valid Until',
    'tl.validityPeriod': 'Validity Period',
    'tl.lastReset': 'Last Reset',
    'tl.daysRemainingLabel': 'Days Remaining',
    'tl.reminderSchedule': 'Reminder Schedule',
    'tl.usageStats': 'Usage Statistics',

    // ── Risk Level Labels ──
    'risk.critical': 'Critical (Severe)',
    'risk.high': 'High',
    'risk.medium': 'Medium',
    'risk.low': 'Low',

    // ── Default Impact Messages ──
    'impact.down': 'Service disruption detected. Users may be unable to access {name}. Please check server status and network connectivity immediately.',
    'impact.warning': 'Performance degradation detected. Slow response times may affect user experience. Consider checking database queries, server load, and network conditions.',
    'impact.recovery': 'Service has returned to normal operation. All functionality is now available.',

    // ── Email HTML Section Titles ──
    'html.details': '📊 Details',
    'html.timeline': '⏰ Timeline',
    'html.impact': '⚠️ Impact',
    'html.affectedServices': '🔗 Affected Services ({count})',
    'html.viewDashboard': 'View Dashboard',
    'html.openConsole': 'Open Console',

    // ── Teams Card Labels ──
    'card.opsmonitorNotification': 'OpsMonitor Notification',
    'card.serviceMonitoring': 'Service Monitoring Alert System',
    'card.impactScope': '⚡ Impact Scope',
    'card.affectedServices': '**Affected Services:** {list}',
    'card.viewDetails': 'View Details',
    'card.goToConsole': 'Go to Console',
  },

  'zh-CN': {
    // ── 服务告警消息 ──
    'alert.serviceDown': '服务 {name} 在连续 {count} 次检查失败后已宕机。错误：{error}',
    'alert.serviceWarning': '服务 {name} 在连续 {count} 次慢响应后进入告警状态。响应时间：{time}ms',
    'alert.serviceRecovery': '服务 {name} 在连续 {count} 次失败后已恢复。',

    // ── 服务告警详细消息 ──
    'alert.serviceDownMsg': '服务 **{name}** 当前不可用，请立即处理！',
    'alert.serviceRecoveryMsg': '服务 **{name}** 已恢复正常运行。',
    'alert.serviceWarningMsg': '服务 **{name}** 响应时间过长。',

    // ── 邮件主题 ──
    'email.subjectServiceAlert': '[{type}] {name}',
    'email.subjectExpiryReminder': '[{level}] {name} 过期提醒',
    'email.subjectRecoveryRenewed': '[恢复] {name} 已续期',

    // ── Teams 告警标题 ──
    'teams.prefixDown': '🔴 [宕机]',
    'teams.prefixRecovery': '🟢 [恢复]',
    'teams.prefixWarning': '🟡 [告警]',
    'teams.expiryTitle': '🔐 [{level}] {name}',
    'teams.recoveryTitle': '✅ [恢复] {name}',

    // ── 安全配置类型标签 ──
    'secType.accesskey': 'AccessKey',
    'secType.ftp': 'FTP 密码',
    'secType.ssh': 'SSH 凭证',
    'secType.ssl': 'SSL 证书',

    // ── 安全配置过期消息 ──
    'sec.expired': '⚠️ {typeLabel}「{name}」已过期！请立即更新。',
    'sec.critical': '🔴 {typeLabel}「{name}」将在 {days} 天内过期！请尽快更新。',
    'sec.warning': '⚠️ {typeLabel}「{name}」将在 {days} 天内过期，请注意。',
    'sec.renewed': '✅ {typeLabel}「{name}」已续期，当前有效。',

    // ── 安全恢复上下文 ──
    'sec.recoveryMessage': '安全配置 **{name}** 已续期，有效期还剩 {days} 天。',
    'sec.recoveryImpact': '{typeLabel} 已成功续期。所有使用此凭证的服务将继续正常运行，无需操作。',

    // ── 安全过期上下文 ──
    'sec.expiryMessageExpired': '安全配置 **{name}** 已过期，请立即处理！',
    'sec.expiryMessageSoon': '安全配置 **{name}** 将在 {days} 天内过期。{urgency}',
    'sec.urgencyImmediate': '请立即处理！',
    'sec.urgencyPlan': '请提前规划续期。',
    'sec.expiryImpactExpired': '此凭证已过期。所有使用此 {typeLabel} 的服务将无法认证。请立即更新凭证配置。',
    'sec.expiryImpactSoon': '此 {typeLabel} 即将过期。过期后所有使用此凭证的服务将无法访问所需资源。请提前更新以避免服务中断。',

    // ── 事实标题 ──
    'fact.project': '📁 项目',
    'fact.riskLevel': '⚠️ 风险等级',
    'fact.address': '🌐 地址',
    'fact.checkType': '🔍 检查类型',
    'fact.responseTime': '📊 响应时间',
    'fact.warningThreshold': '⏱️ 告警阈值',
    'fact.configType': '🔑 配置类型',
    'fact.currentStatus': '✅ 当前状态',
    'fact.previousStatus': '⚠️ 先前状态',
    'fact.newExpiryDate': '📅 新过期日期',
    'fact.daysRemaining': '📊 剩余天数',
    'fact.expiryStatus': '⚠️ 过期状态',
    'fact.expiryDate': '📅 过期日期',
    'fact.createdDate': '📅 创建日期',

    // ── 事实值 ──
    'val.na': '无',
    'val.normal': '正常',
    'val.expired': '已过期',
    'val.expiresInDays': '{days} 天后过期',
    'val.daysUnit': '{days} 天',
    'val.daysRemaining': '剩余 {days} 天',
    'val.servicesUsing': '{count} 个服务正在使用此凭证',
    'val.noServicesLinked': '无关联服务',
    'val.defaultSchedule': '默认计划',
    'val.remindersAt': '提醒时间：过期前 {days} 天',

    // ── 时间线标签 ──
    'tl.failureDetected': '检测到故障',
    'tl.lastSuccessfulCheck': '上次成功检查',
    'tl.lastCheckAgo': '{time}（{minutes} 分钟前）',
    'tl.errorMessage': '错误信息',
    'tl.serviceRecovered': '服务已恢复',
    'tl.downtimeDuration': '宕机时长',
    'tl.downtimeValue': '{m}分{s}秒',
    'tl.currentStatus': '当前状态',
    'tl.healthyResponse': '健康（响应：{time}ms）',
    'tl.slowResponse': '检测到慢响应',
    'tl.configRenewed': '配置已续期',
    'tl.validUntil': '有效期至',
    'tl.validityPeriod': '有效期',
    'tl.lastReset': '上次重置',
    'tl.daysRemainingLabel': '剩余天数',
    'tl.reminderSchedule': '提醒计划',
    'tl.usageStats': '使用统计',

    // ── 风险等级标签 ──
    'risk.critical': '严重',
    'risk.high': '高',
    'risk.medium': '中',
    'risk.low': '低',

    // ── 默认影响描述 ──
    'impact.down': '检测到服务中断。用户可能无法访问 {name}。请立即检查服务器状态和网络连接。',
    'impact.warning': '检测到性能下降。慢响应可能影响用户体验。请检查数据库查询、服务器负载和网络状况。',
    'impact.recovery': '服务已恢复正常运行。所有功能现已可用。',

    // ── 邮件 HTML 区域标题 ──
    'html.details': '📊 详情',
    'html.timeline': '⏰ 时间线',
    'html.impact': '⚠️ 影响',
    'html.affectedServices': '🔗 受影响的服务（{count}）',
    'html.viewDashboard': '查看仪表盘',
    'html.openConsole': '打开控制台',

    // ── Teams 卡片标签 ──
    'card.opsmonitorNotification': 'OpsMonitor 通知',
    'card.serviceMonitoring': '服务监控告警系统',
    'card.impactScope': '⚡ 影响范围',
    'card.affectedServices': '**受影响的服务：** {list}',
    'card.viewDetails': '查看详情',
    'card.goToConsole': '打开控制台',
  },
};

/**
 * Get the current notification language from system_configs.
 * Defaults to 'en-US' if not set.
 */
export function getNotificationLang(): Lang {
  try {
    const row = db.prepare('SELECT value FROM system_configs WHERE key = ?').get('notification_lang') as { value: string } | undefined;
    const lang = row?.value;
    if (lang === 'zh-CN' || lang === 'en-US') return lang;
  } catch { /* ignore */ }
  return 'en-US';
}

/**
 * Translate a key with optional parameter substitution.
 * Usage: nt('alert.serviceDown', { name: 'myService', count: 3, error: 'timeout' })
 */
export function nt(key: string, params?: Record<string, string | number>): string {
  const lang = getNotificationLang();
  let text = messages[lang]?.[key] ?? messages['en-US']?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

/**
 * Get security config type label translated.
 */
export function getTypeLabel(type: string): string {
  return nt(`secType.${type}`);
}
