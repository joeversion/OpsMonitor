// Spec 013: Host-centric architecture types

export interface SSHConfig {
  id: string;
  name: string;
  ssh_host: string;
  ssh_port: number;
  ssh_username: string;
  ssh_auth_type: 'password' | 'private_key';
  ssh_proxy_host?: string;
  ssh_proxy_port?: number;
}

export interface Host {
  id: string;
  name: string;
  ip: string;
  project_id?: string;
  project_name?: string;
  connection_type?: 'ssh' | 'local';  // 移除 null，默认为 local
  enabled?: number;  // Spec 027: 0=disabled, 1=enabled
  // Direct SSH configuration fields
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_auth_type?: 'password' | 'private_key';
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_passphrase?: string;
  ssh_proxy_host?: string;
  ssh_proxy_port?: number;
  // SSH connection settings (per-host)
  ssh_max_retries?: number;
  ssh_retry_delay?: number;
  ssh_connection_timeout?: number;
  ssh_command_timeout?: number;
  // Host check interval (seconds)
  check_interval?: number;
  description?: string;
  tags?: string[];
  status?: 'healthy' | 'warning' | 'error' | 'unhealthy';
  last_test_status?: 'success' | 'failed';
  last_test_at?: string;
  last_test_message?: string;
  last_test_latency?: number;
  service_count?: number;
  health_stats?: {
    total_services: number;
    up_count: number;
    warning_count: number;
    down_count: number;
  };
  services?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateHostDto {
  name: string;
  ip: string;
  project_id?: string;
  connection_type?: 'ssh' | 'local';  // 移除 null，默认为 local
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_auth_type?: 'password' | 'private_key';
  ssh_password?: string;
  ssh_private_key?: string;
  ssh_passphrase?: string;
  ssh_proxy_host?: string;
  ssh_proxy_port?: number;
  // SSH connection settings (per-host)
  ssh_max_retries?: number;
  ssh_retry_delay?: number;
  ssh_connection_timeout?: number;
  ssh_command_timeout?: number;
  // Host check interval (seconds)
  check_interval?: number;
  description?: string;
  tags?: string[];
}

export interface UpdateHostDto extends Partial<CreateHostDto> {}

export interface HostTestResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}
