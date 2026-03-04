// 调度配置相关类型定义

export type ScheduleType = 'fixed' | 'timeRange';

export interface TimeRange {
  name: string;
  start: string;       // HH:mm 格式
  end: string;         // HH:mm 格式
  interval: number;    // 秒
  weekdays?: number[]; // 1-7 (1=周一, 7=周日)
  enabled: boolean;
}

export interface ScheduleConfig {
  type: ScheduleType;
  defaultInterval: number; // 秒
  timeRanges?: TimeRange[];
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: ScheduleConfig;
}

export interface SchedulePreview {
  currentTime: string;
  currentTimeString: string;
  nextRunTime: string;
  currentInterval: number;
  currentRange: string;
  preview: Array<{
    time: string;
    interval: number;
    range: string;
    timeString: string;
  }>;
}

export interface ScheduleValidationError {
  field: string;
  message: string;
}

export interface ScheduleValidation {
  valid: boolean;
  errors?: ScheduleValidationError[];
}
