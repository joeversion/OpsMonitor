/**
 * 调度配置验证工具
 * @module utils/schedule-validator
 */

import { ScheduleConfig, ScheduleValidation, TimeRange } from '../types/schedule';

export class ScheduleValidator {
  /**
   * 验证调度配置
   * @param config 调度配置
   * @returns 验证结果
   */
  static validate(config: ScheduleConfig): ScheduleValidation {
    const errors: string[] = [];

    // 1. 基础验证
    if (!config.type) {
      errors.push('Schedule type is required');
    }

    if (config.type !== 'fixed' && config.type !== 'timeRange') {
      errors.push('Schedule type must be "fixed" or "timeRange"');
    }

    if (!config.defaultInterval) {
      errors.push('Default interval is required');
    } else if (config.defaultInterval < 10) {
      errors.push('Default interval must be >= 10 seconds');
    } else if (config.defaultInterval > 86400) {
      errors.push('Default interval must be <= 86400 seconds (24 hours)');
    }

    // 2. 时段规则验证
    if (config.type === 'timeRange') {
      if (!config.timeRanges || config.timeRanges.length === 0) {
        errors.push('Time ranges are required when type is "timeRange"');
      } else {
        config.timeRanges.forEach((range, index) => {
          this.validateTimeRange(range, index, errors);
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证单个时段规则
   * @param range 时段规则
   * @param index 索引
   * @param errors 错误列表
   */
  private static validateTimeRange(range: TimeRange, index: number, errors: string[]): void {
    const prefix = `TimeRange[${index}]`;

    // 必填字段
    if (!range.name || range.name.trim() === '') {
      errors.push(`${prefix}: Name is required`);
    }

    // 时间格式验证
    if (!range.start) {
      errors.push(`${prefix}: Start time is required`);
    } else if (!this.isValidTime(range.start)) {
      errors.push(`${prefix}: Invalid start time format (expected HH:mm)`);
    }

    if (!range.end) {
      errors.push(`${prefix}: End time is required`);
    } else if (!this.isValidTime(range.end)) {
      errors.push(`${prefix}: Invalid end time format (expected HH:mm)`);
    }

    // 周期验证
    if (range.interval === undefined || range.interval === null) {
      errors.push(`${prefix}: Interval is required`);
    } else if (range.interval < 10) {
      errors.push(`${prefix}: Interval must be >= 10 seconds`);
    } else if (range.interval > 3600) {
      errors.push(`${prefix}: Interval must be <= 3600 seconds (1 hour)`);
    }

    // 星期验证
    if (range.weekdays !== undefined && range.weekdays !== null) {
      if (!Array.isArray(range.weekdays)) {
        errors.push(`${prefix}: Weekdays must be an array`);
      } else if (range.weekdays.length === 0) {
        errors.push(`${prefix}: Weekdays array cannot be empty`);
      } else if (!range.weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7)) {
        errors.push(`${prefix}: Weekdays must be integers between 1-7 (1=Monday, 7=Sunday)`);
      }
    }

    // enabled 验证
    if (range.enabled === undefined || range.enabled === null) {
      errors.push(`${prefix}: Enabled flag is required`);
    } else if (typeof range.enabled !== 'boolean') {
      errors.push(`${prefix}: Enabled must be a boolean`);
    }
  }

  /**
   * 验证时间格式 HH:mm
   * @param time 时间字符串
   * @returns 是否有效
   */
  private static isValidTime(time: string): boolean {
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(time);
  }

  /**
   * 快速验证（仅返回是否有效）
   * @param config 调度配置
   * @returns 是否有效
   */
  static isValid(config: ScheduleConfig): boolean {
    return this.validate(config).valid;
  }
}
