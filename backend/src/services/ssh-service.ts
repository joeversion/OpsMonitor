import { Client, ConnectConfig } from 'ssh2';
import logger from '../utils/logger';
import db from '../db/database';
import SSHConnectionPool from './ssh-connection-pool';

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'private_key';
  credential: string;  // password or private key content
  passphrase?: string;  // for encrypted private keys
  proxy_host?: string;  // jump host
  proxy_port?: number;
  proxy_username?: string;
  proxy_auth_type?: 'password' | 'private_key';
  proxy_credential?: string;
  // Host-level SSH settings (override system defaults)
  max_retries?: number;
  retry_delay?: number;
  connection_timeout?: number;
  command_timeout?: number;
}

export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

// SSH configuration cache to avoid frequent database reads
interface SSHConfig {
  connectionTimeout: number;
  commandTimeout: number;
  maxRetries: number;
  retryDelay: number;
  lastUpdated: number;
}

export class SSHService {
  // Default values (will be overridden by system settings)
  private static defaultConnectionTimeout = 10000;
  private static defaultCommandTimeout = 30000;
  private static defaultMaxRetries = 3;
  private static defaultRetryDelay = 2000;
  
  // Cache for settings (refresh every 5 minutes)
  private static configCache: SSHConfig | null = null;
  private static cacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get SSH configuration from system settings (with caching)
   */
  private static getConfig(): SSHConfig {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.configCache && (now - this.configCache.lastUpdated) < this.cacheExpiry) {
      return this.configCache;
    }
    
    // Read from database
    try {
      const settings = db.prepare(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('ssh_connection_timeout', 'ssh_command_timeout', 'ssh_max_retries', 'ssh_retry_delay')
      `).all() as { key: string; value: string }[];
      
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));
      
      this.configCache = {
        connectionTimeout: parseInt(settingsMap.get('ssh_connection_timeout') || String(this.defaultConnectionTimeout), 10),
        commandTimeout: parseInt(settingsMap.get('ssh_command_timeout') || String(this.defaultCommandTimeout), 10),
        maxRetries: parseInt(settingsMap.get('ssh_max_retries') || String(this.defaultMaxRetries), 10),
        retryDelay: parseInt(settingsMap.get('ssh_retry_delay') || String(this.defaultRetryDelay), 10),
        lastUpdated: now
      };
      
      logger.ssh.debug('SSH config loaded from system settings', this.configCache);
    } catch (error) {
      // Fallback to defaults if database read fails
      logger.ssh.warn('Failed to load SSH config from database, using defaults', { error });
      this.configCache = {
        connectionTimeout: this.defaultConnectionTimeout,
        commandTimeout: this.defaultCommandTimeout,
        maxRetries: this.defaultMaxRetries,
        retryDelay: this.defaultRetryDelay,
        lastUpdated: now
      };
    }
    
    return this.configCache;
  }

  /**
   * Clear the config cache (call after settings are updated)
   */
  static clearConfigCache(): void {
    this.configCache = null;
    logger.ssh.info('SSH config cache cleared');
  }

  // Getter methods for configuration values
  private static get connectionTimeout(): number {
    return this.getConfig().connectionTimeout;
  }

  private static get commandTimeout(): number {
    return this.getConfig().commandTimeout;
  }

  private static get maxRetries(): number {
    return this.getConfig().maxRetries;
  }

  private static get retryDelay(): number {
    return this.getConfig().retryDelay;
  }

  /**
   * Execute a command on remote server via SSH
   * Bug #022: 使用连接池复用连接
   * Bug #023: 添加优先级参数
   * Bug #030: 检测并移除僵尸连接
   * @param priority 1=低优先级（host heartbeat），5=高优先级（service check），默认5
   */
  static async executeCommand(credentials: SSHCredentials, command: string, priority: number = 5): Promise<SSHCommandResult> {
    // Use host-level settings if provided, otherwise fall back to system settings
    const config = this.getConfig();
    const commandTimeout = credentials.command_timeout || config.commandTimeout;
    
    // 从连接池获取连接（传递优先级）
    const pooledConn = await SSHConnectionPool.getConnection(credentials, priority);
    const conn = pooledConn.connection;
    let connectionIsValid = true;  // Bug #030 Fix: Track connection health
    
    try {
      return await new Promise<SSHCommandResult>((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let timeoutId: NodeJS.Timeout;
        let resolved = false;
        let activeStream: any = null; // Bug #031 Fix: Track stream for timeout cleanup

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
        };

        timeoutId = setTimeout(() => {
          cleanup();
          // Bug #031 Fix: 超时时关闭 stream 防止 SSH channel 泄漏
          if (activeStream) {
            try { activeStream.close(); } catch (e) { /* ignore */ }
            try { activeStream.destroy(); } catch (e) { /* ignore */ }
            activeStream = null;
          }
          reject(new Error('SSH command timeout'));
        }, commandTimeout);

        conn.exec(command, (err, stream) => {
          if (err) {
            cleanup();
            // Bug #030 Fix: Detect zombie connection errors
            if (this.isConnectionDeadError(err)) {
              connectionIsValid = false;
            }
            return reject(err);
          }

          activeStream = stream; // Bug #031 Fix: Store stream reference

          stream.on('close', (code: number) => {
            activeStream = null;
            cleanup();
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });
    } finally {
      // Bug #030 Fix: Don't release zombie connections
      if (connectionIsValid) {
        SSHConnectionPool.releaseConnection(pooledConn);
      } else {
        logger.ssh.warn('[POOL] Connection is dead, removing from pool', {
          host: credentials.host,
          error: 'Channel operation failed'
        });
        SSHConnectionPool.removeConnection(pooledConn);
      }
    }
  }

  /**
   * Check if error indicates connection is dead (zombie)
   * Bug #030: Detect connection failure errors
   */
  private static isConnectionDeadError(error: any): boolean {
    const errorMsg = error?.message || error?.toString() || '';
    return (
      errorMsg.includes('Channel open failure') ||
      errorMsg.includes('Connection closed') ||
      errorMsg.includes('Connection reset') ||
      errorMsg.includes('ECONNRESET') ||
      errorMsg.includes('Socket closed') ||
      errorMsg.includes('Not connected')
    );
  }

  // Bug #022: connectViaProxy 方法已移至 SSHConnectionPool

  /**
   * Test SSH connection
   * Bug #023: 添加优先级参数
   * @param priority 1=低优先级（host heartbeat），5=高优先级（service check），默认5
   */
  static async testConnection(credentials: SSHCredentials, priority: number = 5): Promise<{ success: boolean; message: string; latency?: number }> {
    const startTime = Date.now();
    let lastError: any = null;
    
    // Use host-level settings if provided, otherwise fall back to system settings
    const config = this.getConfig();
    const maxRetries = credentials.max_retries || config.maxRetries;
    const retryDelay = credentials.retry_delay || config.retryDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.ssh.debug('Testing SSH connection', { 
          username: credentials.username,
          host: credentials.host,
          port: credentials.port,
          authType: credentials.auth_type,
          attempt,
          maxRetries,
          priority
        });
        const result = await this.executeCommand(credentials, 'echo "Connection successful"', priority);
        const latency = Date.now() - startTime;
        
        if (result.code === 0 && result.stdout.includes('Connection successful')) {
          logger.ssh.info('SSH connection successful', { host: credentials.host, latency, attempts: attempt });
          return { success: true, message: 'SSH connection successful', latency };
        }
        
        // Bug #030 Extended: Empty output indicates zombie connection, should retry
        if (!result.stdout && !result.stderr) {
          logger.ssh.warn('SSH empty output (zombie connection), will retry', { 
            host: credentials.host,
            attempt,
            maxRetries,
            code: result.code
          });
          
          // Treat as retryable error if we have attempts left
          if (attempt < maxRetries) {
            logger.ssh.info('Retrying SSH connection after empty output', { 
              host: credentials.host,
              nextAttempt: attempt + 1,
              delayMs: retryDelay
            });
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        // Other unexpected output (not retryable)
        logger.ssh.warn('SSH unexpected output', { 
          host: credentials.host,
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        });
        return { success: false, message: `Unexpected output: ${result.stderr || result.stdout}` };
      } catch (error: any) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);
        
        logger.ssh.warn('SSH connection attempt failed', { 
          host: credentials.host, 
          attempt, 
          maxRetries,
          error: error.message,
          isRetryable
        });
        
        // If this is a retryable error and we have attempts left, retry
        if (isRetryable && attempt < maxRetries) {
          logger.ssh.info('Retrying SSH connection', { 
            host: credentials.host,
            nextAttempt: attempt + 1,
            delayMs: retryDelay
          });
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // If it's not retryable or we're out of attempts, break the loop
        break;
      }
    }
    
    // Handle the final error after all retries
    const latency = Date.now() - startTime;
    logger.ssh.error('SSH connection failed after all retries', { 
      host: credentials.host, 
      latency, 
      attempts: maxRetries,
      error: lastError?.message 
    });
    
    // Parse common SSH errors for better user feedback
    let userMessage = lastError?.message || 'Connection failed';
    if (lastError?.message.includes('All configured authentication methods failed')) {
      userMessage = 'Authentication failed: Invalid password or key';
    } else if (lastError?.message.includes('ECONNREFUSED')) {
      userMessage = 'Connection refused: SSH service not available';
    } else if (lastError?.message.includes('ECONNRESET')) {
      userMessage = 'Connection reset: Server may be restarting or under heavy load';
    } else if (lastError?.message.includes('ETIMEDOUT') || lastError?.message.includes('timeout')) {
      userMessage = 'Connection timeout: Host unreachable or firewall blocking';
    } else if (lastError?.message.includes('ENOTFOUND')) {
      userMessage = 'Host not found: Invalid hostname or IP';
    } else if (lastError?.message.includes('Unsupported key format')) {
      userMessage = 'Invalid private key format';
    }
    
    return { success: false, message: userMessage, latency };
  }

  /**
   * Check if an error is retryable (temporary network issues)
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',      // Connection reset by peer
      'ETIMEDOUT',       // Connection timeout
      'ECONNABORTED',    // Connection aborted
      'EPIPE',           // Broken pipe
      'EAI_AGAIN',       // DNS lookup timed out
      'EHOSTUNREACH',    // Host unreachable
      'ENETUNREACH',     // Network unreachable
      'timeout'          // General timeout
    ];
    
    // Check if error message contains any retryable error codes
    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(errCode => 
      errorMessage.includes(errCode.toLowerCase())
    );
  }

  /**
   * Check file age (for backup monitoring)
   */
  static async checkFileAge(
    credentials: SSHCredentials,
    path: string,
    pattern: string,
    maxAgeSeconds: number
  ): Promise<{ status: 'healthy' | 'warning' | 'critical'; message: string; fileAge?: number }> {
    try {
      // Find most recent matching file
      const findCmd = `find "${path}" -name "${pattern}" -type f -printf '%T@ %p\\n' 2>/dev/null | sort -rn | head -1`;
      const result = await this.executeCommand(credentials, findCmd);

      if (result.code !== 0 || !result.stdout.trim()) {
        return { status: 'critical', message: `No files matching ${pattern} found in ${path}` };
      }

      const [timestamp, filePath] = result.stdout.trim().split(' ', 2);
      const fileTimestamp = parseFloat(timestamp);
      const now = Date.now() / 1000;
      const ageSeconds = now - fileTimestamp;
      
      if (ageSeconds > maxAgeSeconds) {
        return { 
          status: 'critical', 
          message: `File is ${Math.round(ageSeconds / 3600)}h old, exceeds max ${Math.round(maxAgeSeconds / 3600)}h`,
          fileAge: ageSeconds
        };
      }
      
      // Warning at 80% of max age
      const warningThreshold = maxAgeSeconds * 0.8;
      if (ageSeconds > warningThreshold) {
        return { 
          status: 'warning', 
          message: `File approaching max age: ${Math.round(ageSeconds / 3600)}h of ${Math.round(maxAgeSeconds / 3600)}h`,
          fileAge: ageSeconds
        };
      }

      return { 
        status: 'healthy', 
        message: `File ${filePath} is ${Math.round(ageSeconds / 3600)}h old`,
        fileAge: ageSeconds
      };
    } catch (error: any) {
      return { status: 'critical', message: `SSH check failed: ${error.message}` };
    }
  }

  /**
   * Check if file exists (supports regex patterns)
   */
  static async checkFileExists(
    credentials: SSHCredentials,
    filePath: string
  ): Promise<{ status: 'healthy' | 'critical'; message: string }> {
    try {
      // Check if it looks like a pattern (contains regex special chars or wildcards)
      const hasPattern = /[*?\[\]{}()|+^$\\]/.test(filePath);
      
      if (!hasPattern) {
        // Simple file path check
        const result = await this.executeCommand(credentials, `test -f "${filePath}" && echo "exists"`);
        
        if (result.stdout.includes('exists')) {
          return { status: 'healthy', message: `File ${filePath} exists` };
        }
        return { status: 'critical', message: `File ${filePath} does not exist` };
      }
      
      // Pattern-based check: split directory and pattern
      const lastSlash = filePath.lastIndexOf('/');
      if (lastSlash === -1) {
        return { status: 'critical', message: 'Invalid file path format' };
      }
      
      const dirPath = filePath.substring(0, lastSlash) || '/';
      const pattern = filePath.substring(lastSlash + 1);
      
      // Use find with glob first, then fallback to regex
      const command = `
        # Try glob matching first
        latest=$(find "${dirPath}" -maxdepth 1 -type f -name "${pattern}" -printf '%T@|%p\\n' 2>/dev/null | sort -nr | head -n1)
        
        # If no match with glob, try regex matching
        if [ -z "$latest" ]; then
          latest=$(find "${dirPath}" -maxdepth 1 -type f -printf '%T@|%p\\n' 2>/dev/null | grep -E "/${pattern}$" | sort -nr | head -n1)
        fi
        
        if [ -n "$latest" ]; then
          filepath=$(echo "$latest" | cut -d'|' -f2)
          echo "exists:$filepath"
        else
          echo "not_found"
        fi
      `;
      
      const result = await this.executeCommand(credentials, command);
      
      if (result.stdout.includes('exists:')) {
        const matchedFile = result.stdout.split('exists:')[1].trim();
        return { status: 'healthy', message: `Matched file: ${matchedFile}` };
      }
      return { status: 'critical', message: `No file matching pattern ${pattern} in ${dirPath}` };
    } catch (error: any) {
      return { status: 'critical', message: `SSH check failed: ${error.message}` };
    }
  }

  /**
   * Check if Docker container is running
   */
  static async checkDockerRunning(
    credentials: SSHCredentials,
    containerName: string
  ): Promise<{ status: 'healthy' | 'critical'; message: string; containerId?: string }> {
    try {
      const result = await this.executeCommand(
        credentials, 
        `docker ps -q -f name=^${containerName}$`
      );

      if (result.code !== 0) {
        return { status: 'critical', message: `Docker command failed: ${result.stderr}` };
      }

      const containerId = result.stdout.trim();
      if (containerId) {
        return { status: 'healthy', message: `Container ${containerName} is running`, containerId };
      }
      return { status: 'critical', message: `Container ${containerName} is not running` };
    } catch (error: any) {
      return { status: 'critical', message: `SSH check failed: ${error.message}` };
    }
  }

  /**
   * Check Docker container health status
   */
  static async checkDockerHealth(
    credentials: SSHCredentials,
    containerName: string
  ): Promise<{ status: 'healthy' | 'warning' | 'critical'; message: string; healthStatus?: string }> {
    try {
      // First check if container is running
      const runningCheck = await this.checkDockerRunning(credentials, containerName);
      if (runningCheck.status === 'critical') {
        return runningCheck;
      }

      // Check health status
      const result = await this.executeCommand(
        credentials,
        `docker inspect --format='{{.State.Health.Status}}' ${containerName} 2>/dev/null || echo "no-healthcheck"`
      );

      const healthStatus = result.stdout.trim();

      if (healthStatus === 'no-healthcheck' || healthStatus === '') {
        return { status: 'healthy', message: `Container ${containerName} running (no healthcheck configured)`, healthStatus: 'none' };
      }

      switch (healthStatus) {
        case 'healthy':
          return { status: 'healthy', message: `Container ${containerName} is healthy`, healthStatus };
        case 'starting':
          return { status: 'warning', message: `Container ${containerName} health check starting`, healthStatus };
        case 'unhealthy':
          return { status: 'critical', message: `Container ${containerName} is unhealthy`, healthStatus };
        default:
          return { status: 'warning', message: `Container ${containerName} health: ${healthStatus}`, healthStatus };
      }
    } catch (error: any) {
      return { status: 'critical', message: `SSH check failed: ${error.message}` };
    }
  }

  /**
   * Execute custom command and check result
   */
  static async checkCommand(
    credentials: SSHCredentials,
    command: string,
    successPattern?: string
  ): Promise<{ status: 'healthy' | 'critical'; message: string; output: string }> {
    try {
      const result = await this.executeCommand(credentials, command);

      if (result.code !== 0) {
        return { 
          status: 'critical', 
          message: `Command failed with exit code ${result.code}: ${result.stderr}`,
          output: result.stdout + result.stderr
        };
      }

      if (successPattern) {
        const regex = new RegExp(successPattern);
        if (!regex.test(result.stdout)) {
          return { 
            status: 'critical', 
            message: `Output does not match expected pattern`,
            output: result.stdout
          };
        }
      }

      return { 
        status: 'healthy', 
        message: 'Command executed successfully',
        output: result.stdout
      };
    } catch (error: any) {
      return { 
        status: 'critical', 
        message: `SSH check failed: ${error.message}`,
        output: ''
      };
    }
  }

  /**
   * Check HTTP/HTTPS service via SSH (internal server access)
   * This bypasses firewall restrictions by checking from inside the server
   */
  static async checkHttpViaSSH(
    credentials: SSHCredentials,
    protocol: 'http' | 'https',
    port: number,
    path: string = '/',
    expectedStatus: number = 200,
    timeout: number = 15
  ): Promise<{ status: 'healthy' | 'warning' | 'critical'; message: string; responseTime: number; httpStatus?: number }> {
    try {
      const startTime = Date.now();
      
      // Use curl to check HTTP service from inside the server
      // -s: silent mode
      // -o /dev/null: discard output body
      // -w: write out specific format
      // --max-time: timeout in seconds
      // -k: allow insecure SSL (for self-signed certificates)
      // -L: follow redirects
      const curlCommand = `curl -s -o /dev/null -w '%{http_code}|%{time_total}' --max-time ${timeout} ${protocol === 'https' ? '-k ' : ''}${protocol}://localhost:${port}${path}`;
      
      const result = await this.executeCommand(credentials, curlCommand);
      // Bug #023 Fix: 使用 curl 报告的 time_total 作为 responseTime，而不是包含 SSH 连接池开销的 Date.now()-startTime

      if (result.code !== 0) {
        // curl 失败时使用 fallback 时间（但这种情况下时间不太重要）
        const fallbackTime = Date.now() - startTime;
        
        // Check if curl command exists
        if (result.stderr.includes('command not found') || result.stderr.includes('not recognized')) {
          return {
            status: 'critical',
            message: 'curl command not available on server',
            responseTime: fallbackTime
          };
        }
        
        return {
          status: 'critical',
          message: `HTTP check failed: ${result.stderr || 'Connection error'}`,
          responseTime: fallbackTime
        };
      }

      // Parse curl output: "200|0.123"
      const output = result.stdout.trim();
      const [httpStatusStr, timeTotalStr] = output.split('|');
      const httpStatus = parseInt(httpStatusStr, 10);
      const timeTotal = parseFloat(timeTotalStr) * 1000; // Convert to ms

      if (isNaN(httpStatus)) {
        const fallbackTime = Date.now() - startTime;
        return {
          status: 'critical',
          message: `Invalid response from curl: ${output}`,
          responseTime: fallbackTime
        };
      }

      if (httpStatus === expectedStatus) {
        return {
          status: 'healthy',
          message: `HTTP ${httpStatus} - Response time: ${timeTotal.toFixed(0)}ms`,
          responseTime: Math.round(timeTotal),
          httpStatus
        };
      } else {
        return {
          status: 'critical',
          message: `Unexpected HTTP status: ${httpStatus} (expected: ${expectedStatus})`,
          responseTime: Math.round(timeTotal),
          httpStatus
        };
      }
    } catch (error: any) {
      return {
        status: 'critical',
        message: `SSH HTTP check failed: ${error.message}`,
        responseTime: 0
      };
    }
  }

  /**
   * Check TCP port via SSH connection
   * Uses netcat (nc) or timeout+bash to check if a TCP port is open from inside the server
   */
  static async checkTcpViaSSH(
    credentials: SSHCredentials,
    host: string,
    port: number,
    timeout: number = 5
  ): Promise<{ status: 'healthy' | 'warning' | 'critical'; message: string; responseTime: number }> {
    try {
      // Bug #023 Fix: 使用远程 shell 内置计时，避免把 SSH 连接池等待时间算入 responseTime
      // 输出格式: "OK|elapsed_ms" 或 "FAIL|RC|elapsed_ms"
      // 注意：必须用 ';' 而非 '&&' 串联，否则 nc 失败（exit!=0）时链条断裂，后续命令不执行
      const timedCommand = [
        `START=$(date +%s%N 2>/dev/null || echo 0)`,
        `nc -zv -w ${timeout} ${host} ${port} >/dev/null 2>&1; RC=$?`,
        `if [ $RC -eq 127 ]; then timeout ${timeout} bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; RC=$?; fi`,
        `END=$(date +%s%N 2>/dev/null || echo 0)`,
        `if [ "$START" = "0" ] || [ "$END" = "0" ]; then ELAPSED=0; else ELAPSED=$(( (END - START) / 1000000 )); fi`,
        `if [ $RC -eq 0 ]; then echo "OK|$ELAPSED"; else echo "FAIL|$RC|$ELAPSED"; fi`
      ].join('; ');
      
      const result = await this.executeCommand(credentials, timedCommand);
      const output = result.stdout.trim();
      const parts = output.split('|');
      
      if (parts[0] === 'OK') {
        const elapsed = parseInt(parts[1], 10) || 0;
        return {
          status: 'healthy',
          message: `TCP port ${port} is open - Response time: ${elapsed}ms`,
          responseTime: elapsed
        };
      } else {
        const exitCode = parseInt(parts[1], 10) || 1;
        const elapsed = parseInt(parts[2], 10) || 0;
        
        if (exitCode === 124) {
          return {
            status: 'critical',
            message: `Connection timeout after ${timeout}s`,
            responseTime: elapsed
          };
        } else {
          return {
            status: 'critical',
            message: `TCP port ${port} is closed or unreachable`,
            responseTime: elapsed
          };
        }
      }
    } catch (error: any) {
      return {
        status: 'critical',
        message: `SSH TCP check failed: ${error.message}`,
        responseTime: 0
      };
    }
  }
}

export default SSHService;
