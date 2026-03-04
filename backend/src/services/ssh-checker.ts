import db from '../db/database';
import SSHService, { SSHCredentials } from './ssh-service';

export interface SSHCheckConfig {
  // file-age
  path?: string;
  pattern?: string;
  max_age_seconds?: number;
  // file-exists
  file_path?: string;
  // docker-running, docker-health
  container_name?: string;
  // command
  command?: string;
  success_pattern?: string;
}

export interface SSHCheckResult {
  status: 'up' | 'down' | 'warning';
  message: string;
  response_time: number;
  details?: any;
}

export class SSHChecker {
  /**
   * Get SSH credentials from security_configs by id
   */
  static getSSHCredentials(sshConfigId: string): SSHCredentials | null {
    const stmt = db.prepare(`
      SELECT * FROM security_configs WHERE id = ? AND type = 'ssh'
    `);
    const config = stmt.get(sshConfigId) as any;
    
    if (!config) {
      return null;
    }

    return {
      host: config.ssh_host,
      port: config.ssh_port || 22,
      username: config.ssh_username,
      auth_type: config.ssh_auth_type,
      credential: config.ssh_credential,
      passphrase: config.ssh_passphrase,
      proxy_host: config.ssh_proxy_host,
      proxy_port: config.ssh_proxy_port,
      proxy_username: config.ssh_proxy_username,
      proxy_auth_type: config.ssh_proxy_auth_type,
      proxy_credential: config.ssh_proxy_credential
    };
  }

  /**
   * Run SSH health check for a service
   */
  static async checkService(service: any): Promise<SSHCheckResult> {
    const startTime = Date.now();

    // Get SSH credentials
    if (!service.ssh_config_id) {
      return {
        status: 'down',
        message: 'No SSH configuration specified',
        response_time: Date.now() - startTime
      };
    }

    const credentials = this.getSSHCredentials(service.ssh_config_id);
    if (!credentials) {
      return {
        status: 'down',
        message: 'SSH credentials not found',
        response_time: Date.now() - startTime
      };
    }

    const checkConfig: SSHCheckConfig = service.ssh_check_config 
      ? (typeof service.ssh_check_config === 'string' 
          ? JSON.parse(service.ssh_check_config) 
          : service.ssh_check_config)
      : {};

    try {
      let result;

      switch (service.ssh_check_type) {
        case 'file-age':
          result = await this.checkFileAge(credentials, checkConfig);
          break;
        case 'file-exists':
          result = await this.checkFileExists(credentials, checkConfig);
          break;
        case 'docker-running':
          result = await this.checkDockerRunning(credentials, checkConfig);
          break;
        case 'docker-health':
          result = await this.checkDockerHealth(credentials, checkConfig);
          break;
        case 'command':
          result = await this.checkCommand(credentials, checkConfig);
          break;
        default:
          result = await SSHService.testConnection(credentials);
          return {
            status: result.success ? 'up' : 'down',
            message: result.message,
            response_time: result.latency || (Date.now() - startTime)
          };
      }

      return {
        status: this.mapStatus(result.status),
        message: result.message,
        response_time: Date.now() - startTime,
        details: result
      };
    } catch (error: any) {
      return {
        status: 'down',
        message: `SSH check failed: ${error.message}`,
        response_time: Date.now() - startTime
      };
    }
  }

  private static mapStatus(status: 'healthy' | 'warning' | 'critical'): 'up' | 'down' | 'warning' {
    switch (status) {
      case 'healthy': return 'up';
      case 'warning': return 'warning';
      case 'critical': return 'down';
      default: return 'down';
    }
  }

  private static async checkFileAge(credentials: SSHCredentials, config: SSHCheckConfig) {
    if (!config.path || !config.pattern || !config.max_age_seconds) {
      throw new Error('file-age check requires path, pattern, and max_age_seconds');
    }
    return SSHService.checkFileAge(
      credentials,
      config.path,
      config.pattern,
      config.max_age_seconds
    );
  }

  private static async checkFileExists(credentials: SSHCredentials, config: SSHCheckConfig) {
    if (!config.file_path) {
      throw new Error('file-exists check requires file_path');
    }
    return SSHService.checkFileExists(credentials, config.file_path);
  }

  private static async checkDockerRunning(credentials: SSHCredentials, config: SSHCheckConfig) {
    if (!config.container_name) {
      throw new Error('docker-running check requires container_name');
    }
    return SSHService.checkDockerRunning(credentials, config.container_name);
  }

  private static async checkDockerHealth(credentials: SSHCredentials, config: SSHCheckConfig) {
    if (!config.container_name) {
      throw new Error('docker-health check requires container_name');
    }
    return SSHService.checkDockerHealth(credentials, config.container_name);
  }

  private static async checkCommand(credentials: SSHCredentials, config: SSHCheckConfig) {
    if (!config.command) {
      throw new Error('command check requires command');
    }
    return SSHService.checkCommand(
      credentials,
      config.command,
      config.success_pattern
    );
  }
}

export default SSHChecker;
