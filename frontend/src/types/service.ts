export interface Service {
  id: string;
  name: string;
  project_id?: string;
  host_id?: string;  // Spec 013: Reference to hosts table
  description?: string;
  host: string;
  port: number;
  check_type: 'tcp' | 'http' | 'https' | 'script' | 'file-age' | 'file-exists' | 'docker-running' | 'docker-health' | 'command';
  check_config?: string | {
    // For file checks
    path?: string;
    pattern?: string;
    max_age_seconds?: number;
    // For docker checks
    container_name?: string;
    // For command checks
    command?: string;
    success_pattern?: string;
    // For HTTP checks
    protocol?: string;
    expected_status?: number;
    timeout?: number;
  };
  http_config?: string | {  // Deprecated, use check_config
    protocol?: string;
    path?: string;
    expected_status?: number;
    timeout?: number;
  };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  layer?: 'frontend' | 'backend' | 'database' | 'external';
  check_interval: number;
  warning_threshold: number;
  error_threshold: number;
  enabled: boolean;
  alert_enabled: boolean;
  failure_threshold?: number;  // 连续失败多少次后触发告警
  dependencies?: string[];
  // Service-level alert customization
  impact_description?: string;
  custom_alert_template?: string;
  // Custom icon for topology view
  icon?: string;
  // Schedule configuration (Spec 019-025)
  schedule_type?: 'fixed' | 'timeRange';
  schedule_config?: string | {
    type?: 'fixed' | 'timeRange';
    defaultInterval?: number;
    timeRanges?: Array<{
      name: string;
      start: string;
      end: string;
      interval: number;
      enabled: boolean;
      weekdays?: number[];
    }>;
  };
  // SSH monitoring fields (deprecated, moved to hosts)
  service_type?: 'http' | 'ssh';
  ssh_config_id?: string;
  ssh_check_type?: 'file-age' | 'file-exists' | 'docker-running' | 'docker-health' | 'command';
  ssh_check_config?: string | {
    path?: string;
    pattern?: string;
    max_age_seconds?: number;
    container_name?: string;
    command?: string;
    success_pattern?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateServiceDto extends Omit<Service, 'id' | 'created_at' | 'updated_at'> {}

export interface UpdateServiceDto extends Partial<CreateServiceDto> {}
