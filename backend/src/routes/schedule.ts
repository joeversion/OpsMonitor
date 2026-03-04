import express from 'express';
import db from '../db/database';
import { ScheduleValidator } from '../utils/schedule-validator';
import { DynamicScheduler } from '../services/dynamic-scheduler';
import { Scheduler } from '../services/scheduler';
import { ScheduleConfig, SCHEDULE_TEMPLATES } from '../types/schedule';
import logger from '../utils/logger';

const router = express.Router();

/**
 * 更新服务调度配置
 * PUT /api/services/:id/schedule
 */
router.put('/services/:id/schedule', (req, res) => {
  try {
    const { id } = req.params;
    const config: ScheduleConfig = req.body;
    
    logger.info('Schedule', `Updating schedule for service ${id}`, { config });
    
    // 验证配置
    const validation = ScheduleValidator.validate(config);
    if (!validation.valid) {
      logger.warn('Schedule', `Invalid schedule configuration for service ${id}`, validation.errors);
      return res.status(400).json({ 
        error: 'Invalid schedule configuration',
        details: validation.errors 
      });
    }
    
    // 检查服务是否存在
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // 更新数据库 - 两种模式都保存完整的 config
    const configJson = JSON.stringify(config);
    db.prepare(`
      UPDATE services 
      SET schedule_type = ?, 
          schedule_config = ?, 
          check_interval = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(config.type, configJson, config.defaultInterval, id);
    
    // 重新获取更新后的服务
    const updatedService = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    
    // 重启调度（仅当服务启用时）
    if (updatedService && updatedService.enabled) {
      Scheduler.restartService(updatedService);
      logger.info('Schedule', `Service ${updatedService.name} scheduler restarted with new configuration`);
    }
    
    const nextRunTime = DynamicScheduler.calculateNextRunTime(config);
    const currentInterval = DynamicScheduler.calculateNextInterval(config);
    const rangeName = DynamicScheduler.getCurrentRangeName(config);
    
    res.json({ 
      success: true,
      message: 'Schedule configuration updated',
      data: {
        scheduleType: config.type,
        currentInterval,
        currentRange: rangeName,
        nextRunTime: nextRunTime.toISOString(),
        schedulerRestarted: updatedService.enabled === 1
      }
    });
  } catch (error: any) {
    logger.error('Schedule', `Error updating service schedule: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新主机调度配置
 * PUT /api/hosts/:id/schedule
 */
router.put('/hosts/:id/schedule', (req, res) => {
  try {
    const { id } = req.params;
    const config: ScheduleConfig = req.body;
    
    logger.info('Schedule', `Updating schedule for host ${id}`, { config });
    
    // 验证配置
    const validation = ScheduleValidator.validate(config);
    if (!validation.valid) {
      logger.warn('Schedule', `Invalid schedule configuration for host ${id}`, validation.errors);
      return res.status(400).json({ 
        error: 'Invalid schedule configuration',
        details: validation.errors 
      });
    }
    
    // 检查主机是否存在
    const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as any;
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // 更新数据库 - 两种模式都保存完整的 config
    const configJson = JSON.stringify(config);
    db.prepare(`
      UPDATE hosts 
      SET schedule_type = ?, 
          schedule_config = ?, 
          check_interval = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(config.type, configJson, config.defaultInterval, id);
    
    // 重启主机检查
    Scheduler.restartSingleHostCheck(id);
    logger.info('Schedule', `Host ${host.name} scheduler restarted with new configuration`);
    
    const nextRunTime = DynamicScheduler.calculateNextRunTime(config);
    const currentInterval = DynamicScheduler.calculateNextInterval(config);
    const rangeName = DynamicScheduler.getCurrentRangeName(config);
    
    res.json({ 
      success: true,
      message: 'Host schedule configuration updated',
      data: {
        scheduleType: config.type,
        currentInterval,
        currentRange: rangeName,
        nextRunTime: nextRunTime.toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Schedule', `Error updating host schedule: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取预置模板
 * GET /api/schedule/templates
 */
router.get('/templates', (req, res) => {
  try {
    const templates = [
      {
        id: 'workday-optimized',
        name: '工作时段优化',
        description: '工作时间高频检查，非工作时间低频',
        icon: '💼',
        config: SCHEDULE_TEMPLATES[0].config
      },
      {
        id: 'peak-hours',
        name: '业务高峰加强',
        description: '在业务高峰期提高检查频率',
        icon: '📈',
        config: SCHEDULE_TEMPLATES[1].config
      },
      {
        id: 'energy-saving',
        name: '节能模式',
        description: '夜间和周末大幅降低检查频率',
        icon: '🌙',
        config: SCHEDULE_TEMPLATES[2].config
      },
      {
        id: 'fixed-interval',
        name: '固定周期',
        description: '使用固定的检查间隔',
        icon: '⏱️',
        config: {
          type: 'fixed' as const,
          defaultInterval: 60
        }
      }
    ];
    
    res.json(templates);
  } catch (error: any) {
    logger.error('Schedule', `Error getting templates: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 预览执行时间
 * POST /api/schedule/preview
 */
router.post('/preview', (req, res) => {
  try {
    const config: ScheduleConfig = req.body;
    
    // 验证配置
    const validation = ScheduleValidator.validate(config);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid configuration',
        details: validation.errors 
      });
    }
    
    const now = new Date();
    const nextRunTime = DynamicScheduler.calculateNextRunTime(config, now);
    const currentInterval = DynamicScheduler.calculateNextInterval(config);
    const currentRange = DynamicScheduler.getCurrentRangeName(config);
    
    // 生成未来24小时的执行时间预览
    const preview = [];
    let previewTime = now;
    const maxPreviewItems = 20;
    
    for (let i = 0; i < maxPreviewItems; i++) {
      const tempConfig = config.type === 'timeRange' 
        ? config 
        : { type: 'fixed' as const, defaultInterval: config.defaultInterval };
      
      const interval = DynamicScheduler.calculateNextInterval(tempConfig);
      const range = DynamicScheduler.getCurrentRangeName(tempConfig, previewTime);
      
      previewTime = new Date(previewTime.getTime() + interval * 1000);
      
      // 只预览未来24小时内的
      if (previewTime.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
        break;
      }
      
      preview.push({
        time: previewTime.toISOString(),
        interval,
        range,
        timeString: previewTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      });
    }
    
    res.json({
      currentTime: now.toISOString(),
      currentTimeString: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      nextRunTime: nextRunTime.toISOString(),
      currentInterval,
      currentRange,
      preview
    });
  } catch (error: any) {
    logger.error('Schedule', `Error previewing schedule: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 验证配置
 * POST /api/schedule/validate
 */
router.post('/validate', (req, res) => {
  try {
    const config: ScheduleConfig = req.body;
    const validation = ScheduleValidator.validate(config);
    res.json(validation);
  } catch (error: any) {
    logger.error('Schedule', `Error validating schedule: ${error.message}`, error);
    res.status(500).json({ 
      valid: false,
      errors: [{ field: 'general', message: error.message }]
    });
  }
});

export default router;
