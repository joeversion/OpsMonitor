/**
 * 动态调度器 - 支持时段规则的智能周期计算
 * @module services/dynamic-scheduler
 */

import { ScheduleConfig, TimeRange } from '../types/schedule';
import logger from '../utils/logger';

export class DynamicScheduler {
  /**
   * 计算下次检查的周期（秒）
   * @param config 调度配置
   * @returns 下次检查周期（秒）
   */
  static calculateNextInterval(config: ScheduleConfig): number {
    if (config.type === 'fixed') {
      return config.defaultInterval;
    }
    
    const now = new Date();
    const matchedRange = this.findMatchingTimeRange(config.timeRanges || [], now);
    
    if (matchedRange) {
      logger.scheduler?.debug?.(`Matched time range: ${matchedRange.name}, interval: ${matchedRange.interval}s`);
      return matchedRange.interval;
    }
    
    logger.scheduler?.debug?.(`No time range matched, using default interval: ${config.defaultInterval}s`);
    return config.defaultInterval;
  }
  
  /**
   * 查找当前时间匹配的时段规则
   * @param ranges 时段规则列表
   * @param now 当前时间
   * @returns 匹配的时段规则，无匹配返回null
   */
  private static findMatchingTimeRange(ranges: TimeRange[], now: Date): TimeRange | null {
    const currentTime = this.formatTime(now);
    const currentWeekday = now.getDay() || 7;  // 1=Monday, 7=Sunday
    
    for (const range of ranges) {
      if (!range.enabled) {
        continue;
      }
      
      // 时间匹配检查
      if (!this.isTimeInRange(currentTime, range.start, range.end)) {
        continue;
      }
      
      // 星期匹配检查（如果配置了weekdays）
      if (range.weekdays && range.weekdays.length > 0) {
        if (!range.weekdays.includes(currentWeekday)) {
          logger.scheduler?.debug?.(
            `Time range ${range.name} time matched but weekday ${currentWeekday} not in ${range.weekdays}`
          );
          continue;
        }
      }
      
      // 找到匹配的时段
      return range;
    }
    
    return null;
  }
  
  /**
   * 判断时间是否在范围内（支持跨午夜）
   * @param current 当前时间 HH:mm
   * @param start 开始时间 HH:mm
   * @param end 结束时间 HH:mm
   * @returns 是否在范围内
   * 
   * @example
   * isTimeInRange('10:00', '09:00', '18:00') // true - 正常范围
   * isTimeInRange('00:30', '23:00', '01:00') // true - 跨午夜
   * isTimeInRange('10:00', '23:00', '01:00') // false - 不在跨午夜范围
   */
  static isTimeInRange(current: string, start: string, end: string): boolean {
    if (start <= end) {
      // 正常范围：09:00 - 18:00
      return current >= start && current <= end;
    } else {
      // 跨午夜范围：23:00 - 01:00
      // 当前时间 >= 开始时间（如23:00之后）或 <= 结束时间（如01:00之前）
      return current >= start || current <= end;
    }
  }
  
  /**
   * 格式化时间为 HH:mm
   * @param date 日期对象
   * @returns HH:mm 格式字符串
   */
  private static formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  /**
   * 计算下次执行时间戳
   * @param config 调度配置
   * @param currentTime 当前时间（可选，默认为now）
   * @returns 下次执行的Date对象
   */
  static calculateNextRunTime(config: ScheduleConfig, currentTime?: Date): Date {
    const now = currentTime || new Date();
    const intervalSeconds = this.calculateNextInterval(config);
    return new Date(now.getTime() + intervalSeconds * 1000);
  }
  
  /**
   * 获取当前生效的时段规则名称（用于日志和调试）
   * @param config 调度配置
   * @param now 当前时间
   * @returns 时段规则名称，无匹配返回 'default'
   */
  static getCurrentRangeName(config: ScheduleConfig, now?: Date): string {
    if (config.type === 'fixed') {
      return 'fixed';
    }
    
    const matchedRange = this.findMatchingTimeRange(
      config.timeRanges || [], 
      now || new Date()
    );
    
    return matchedRange ? matchedRange.name : 'default';
  }
}
