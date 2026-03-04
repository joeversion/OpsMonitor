/**
 * 调度配置类型定义
 * @module types/schedule
 */

/**
 * 调度配置类型
 */
export type ScheduleType = 'fixed' | 'timeRange';

/**
 * 时段规则
 */
export interface TimeRange {
  /** 规则名称，如"工作时段" */
  name: string;
  /** 开始时间 "HH:mm" */
  start: string;
  /** 结束时间 "HH:mm" */
  end: string;
  /** 该时段的检查周期（秒） */
  interval: number;
  /** 可选，1-7 (1=周一，7=周日) */
  weekdays?: number[];
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 调度配置
 */
export interface ScheduleConfig {
  /** 调度类型 */
  type: ScheduleType;
  /** 默认检查周期（秒） */
  defaultInterval: number;
  /** 时段规则列表 */
  timeRanges?: TimeRange[];
}

/**
 * 调度配置验证结果
 */
export interface ScheduleValidation {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息列表 */
  errors: string[];
}

/**
 * 预置模板
 */
export interface ScheduleTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 调度配置 */
  config: ScheduleConfig;
}

/**
 * 预置模板定义
 */
export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'workday-optimized',
    name: '工作时段优化',
    description: '工作时间高频检查，非工作时间低频',
    config: {
      type: 'timeRange',
      defaultInterval: 300,
      timeRanges: [
        {
          name: '工作时段',
          start: '09:00',
          end: '18:00',
          interval: 60,
          weekdays: [1, 2, 3, 4, 5],
          enabled: true
        }
      ]
    }
  },
  {
    id: 'peak-hours',
    name: '业务高峰加强',
    description: '在业务高峰期提高检查频率',
    config: {
      type: 'timeRange',
      defaultInterval: 300,
      timeRanges: [
        {
          name: '午间高峰',
          start: '12:00',
          end: '14:00',
          interval: 30,
          enabled: true
        },
        {
          name: '晚间高峰',
          start: '18:00',
          end: '20:00',
          interval: 30,
          enabled: true
        }
      ]
    }
  },
  {
    id: 'energy-saving',
    name: '节能模式',
    description: '夜间和周末大幅降低检查频率',
    config: {
      type: 'timeRange',
      defaultInterval: 600,
      timeRanges: [
        {
          name: '深夜',
          start: '00:00',
          end: '06:00',
          interval: 1800,
          enabled: true
        }
      ]
    }
  }
];
