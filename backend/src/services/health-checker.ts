import axios from 'axios';
import * as net from 'net';
import db from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { SSHService, SSHCredentials } from './ssh-service';
import logger from '../utils/logger';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkEventBus } from './check-event-bus';

const execAsync = promisify(exec);

interface Service {
  id: string;
  host: string;
  port: number;
  check_type: 'tcp' | 'http' | 'https' | 'script' | 'file' | 'log';
  http_config?: string; // JSON string
  warning_threshold: number;
  error_threshold: number;
  script_config?: string; // JSON string
  file_config?: string; // JSON string
  // SSH fields
  service_type?: 'http' | 'ssh';
  ssh_config_id?: string;
  ssh_check_type?: 'file-age' | 'file-exists' | 'docker-running' | 'docker-health' | 'command';
  ssh_check_config?: string; // JSON string
  // Host fields (for SSH-based HTTP checks)
  host_id?: string;
  host_connection_type?: 'ssh' | 'local';
  host_ssh_host?: string;
  host_ssh_port?: number;
  host_ssh_username?: string;
  host_ssh_auth_type?: 'password' | 'private_key';
  host_ssh_password?: string;
  host_ssh_private_key?: string;
  host_ssh_passphrase?: string;
  host_ssh_proxy_host?: string;
  host_ssh_proxy_port?: number;
}

interface CheckResult {
  status: 'up' | 'down' | 'warning' | 'unknown';
  responseTime: number;
  errorMessage?: string;
  sslExpiry?: string;
  sslDaysRemaining?: number;
  output?: string;      // short summary for UI
  stdout?: string;      // captured stdout
  stderr?: string;      // captured stderr
  details?: any;        // structured JSON (file info, etc.)
}

interface ScriptConfig {
  script_type?: 'bash' | 'python' | 'powershell' | 'nodejs';
  script_content?: string;
  expected_exit_code?: number;
  timeout?: number; // seconds
  working_dir?: string;
}

interface FileCheckConfig {
  mode?: 'single' | 'folder';
  file_path?: string;               // for single file
  directory_path?: string;          // for folder mode
  filename_pattern?: string;        // glob or regex pattern (auto-detected)
  use_latest?: boolean;             // pick newest by mtime
  freshness_days?: number;          // fail if newest older than this (days)
  max_age_minutes?: number;         // fail/warn if mtime older than this (minutes)
  check_type?: 'exists' | 'size' | 'modified' | 'content';
  expected_size_delta?: number;     // minimal size in KB
  content_pattern?: string;         // regex to match content
  timeout_seconds?: number;
}

export class HealthChecker {
  static async check(service: Service): Promise<CheckResult> {
    const startTime = Date.now();
    
    // Check if host is offline before performing service check
    // Bug Fix: Don't short-circuit based on cached host status
    // Instead, log warning and continue with actual service check
    if (service.host_id) {
      const hostStatus = this.checkHostStatus(service.host_id);
      if (hostStatus) {
        // Only log warning, don't return immediately
        // This allows service to verify its actual state independently
        logger.healthCheck.warn(`Host may be offline, but attempting service check`, {
          service: (service as any).name || service.id,
          hostStatus
        });
        // Continue to perform actual service check below
      }
    }
    
    // DEBUG: Log SSH host info
    if (service.host_connection_type === 'ssh') {
      logger.healthCheck.debug('SSH Mode Detected', {
        service: (service as any).name || service.id,
        host_connection_type: service.host_connection_type,
        host_ssh_host: service.host_ssh_host,
        check_type: service.check_type
      });
    }
    
    try {
      let result: CheckResult;
      
      // Check if it's an SSH type service
      if (service.service_type === 'ssh' && service.ssh_check_type) {
        result = await this.checkSSH(service);
      } else if (service.check_type === 'http' || service.check_type === 'https') {
        result = await this.checkHttp(service);
      } else if (service.check_type === 'tcp') {
        result = await this.checkTcp(service);
      } else if (service.check_type === 'script') {
        result = await this.checkScript(service);
      } else if (service.check_type === 'file' || service.check_type === 'log') {
        result = await this.checkFile(service);
      } else {
        result = { status: 'unknown', responseTime: 0, errorMessage: `Check type not implemented: ${service.check_type}` };
      }
      
      const responseTime = Date.now() - startTime;
      // Override response time with actual measurement if not provided by check
      if (result.responseTime === 0) result.responseTime = responseTime;

      // Determine status based on thresholds if it's UP
      if (result.status === 'up') {
        // Thresholds are stored in SECONDS in the database, convert to ms for comparison
        const warningThresholdMs = service.warning_threshold * 1000;
        const errorThresholdMs = service.error_threshold * 1000;
        
        if (result.responseTime >= errorThresholdMs) {
          result.status = 'down';
          result.errorMessage = `Response time ${result.responseTime}ms exceeds error threshold ${service.error_threshold}s`;
        } else if (result.responseTime >= warningThresholdMs) {
          result.status = 'warning';
        }
      }

      return result;
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Check if host is offline. Returns error message if offline, null if online.
   */
  private static checkHostStatus(hostId: string): string | null {
    try {
      const host = db.prepare(`
        SELECT name, last_test_status, last_test_message 
        FROM hosts WHERE id = ?
      `).get(hostId) as { name: string; last_test_status: string | null; last_test_message: string | null } | undefined;
      
      if (!host) {
        return 'Host not found';
      }
      
      if (host.last_test_status === 'failed') {
        return `Host ${host.name} is offline: ${host.last_test_message || 'Connection failed'}`;
      }
      
      return null; // Host is online
    } catch (error) {
      logger.healthCheck.error('Error checking host status', { hostId, error });
      return null; // On error, proceed with check
    }
  }

  private static async getSslInfo(host: string, port: number): Promise<{ expiry: string, days: number } | null> {
    return new Promise((resolve) => {
      const tls = require('tls');
      const options = {
        host: host,
        port: port,
        rejectUnauthorized: false,
        servername: host,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const diffTime = validTo.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          resolve({
            expiry: validTo.toISOString(),
            days: diffDays
          });
        } else {
          resolve(null);
        }
        socket.end();
      });

      socket.on('error', () => {
        resolve(null);
      });
      
      socket.setTimeout(10000, () => { // Increased from 5000ms to 10000ms for production network latency
        socket.destroy();
        resolve(null);
      });
    });
  }

  private static async checkHttp(service: Service): Promise<CheckResult> {
    // Check if this service should be checked via SSH (internal network)
    if (service.host_connection_type === 'ssh' && service.host_ssh_host) {
      return await this.checkHttpViaSSH(service);
    }

    // Standard external HTTP check
    const fs = require('fs');
    const logPath = require('path').join(__dirname, '../../health-check-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] RAW http_config: ${service.http_config}\n`);
    
    const config = service.http_config ? JSON.parse(service.http_config) : {};
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] PARSED config: ${JSON.stringify(config)}\n`);
    
    const protocol = config.protocol || 'http';
    const path = config.path || '/';
    const url = `${protocol}://${service.host}:${service.port}${path}`;
    const timeout = config.timeout || 15000; // Increased from 5000ms to 15000ms for production network latency
    const expectedStatus = config.expected_status || 200;

    const start = Date.now();
    try {
      console.log(`[DEBUG] Checking HTTP: ${url}, expectedStatus: ${expectedStatus}`);
      const response = await axios.get(url, { 
        timeout, 
        validateStatus: () => true,
        // 添加标准 headers，避免某些服务器拒绝请求
        headers: {
          'User-Agent': 'ServiceMonitor/1.0',
          'Accept': '*/*',
        },
        // 对于 HTTPS，禁用证书验证（内网环境常用）
        httpsAgent: protocol === 'https' ? new (require('https').Agent)({
          rejectUnauthorized: false
        }) : undefined,
      });
      const duration = Date.now() - start;
      const fs = require('fs');
      const logPath = require('path').join(__dirname, '../../health-check-debug.log');
      const logMsg = `[${new Date().toISOString()}] URL: ${url}, Status: ${response.status} (type: ${typeof response.status}), Expected: ${expectedStatus} (type: ${typeof expectedStatus}), Duration: ${duration}ms\n`;
      fs.appendFileSync(logPath, logMsg);
      console.log(`[DEBUG] Response status: ${response.status}, expected: ${expectedStatus}, duration: ${duration}ms`);
      
      let sslInfo;
      if (protocol === 'https') {
        sslInfo = await this.getSslInfo(service.host, service.port);
      }

      if (response.status === expectedStatus) {
        return { 
          status: 'up', 
          responseTime: duration,
          sslExpiry: sslInfo?.expiry,
          sslDaysRemaining: sslInfo?.days
        };
      } else {
        return { 
          status: 'down', 
          responseTime: duration, 
          errorMessage: `Unexpected status code: ${response.status}`,
          sslExpiry: sslInfo?.expiry,
          sslDaysRemaining: sslInfo?.days
        };
      }
    } catch (error: any) {
      return { 
        status: 'down', 
        responseTime: Date.now() - start, 
        errorMessage: error.message 
      };
    }
  }

  private static buildSSHCredentials(service: Service): SSHCredentials {
    if (service.host_connection_type !== 'ssh') {
      throw new Error('Host is not configured for SSH connection');
    }

    const host = service.host_ssh_host || service.host;
    const username = service.host_ssh_username;
    const authType = service.host_ssh_auth_type;
    if (!host || !username || !authType) {
      throw new Error('SSH credentials are incomplete');
    }

    const credential = authType === 'password' ? service.host_ssh_password : service.host_ssh_private_key;
    if (!credential) {
      throw new Error('SSH credential is missing');
    }

    return {
      host,
      port: service.host_ssh_port || 22,
      username,
      auth_type: authType,
      credential,
      passphrase: service.host_ssh_passphrase || undefined,
      proxy_host: service.host_ssh_proxy_host || undefined,
      proxy_port: service.host_ssh_proxy_port || undefined
    };
  }

  private static async checkScript(service: Service): Promise<CheckResult> {
    const start = Date.now();
    try {
      const cfg: ScriptConfig = service.script_config ? JSON.parse(service.script_config) : {};
      const scriptContent = (cfg.script_content || '').trim();
      if (!scriptContent) {
        return { status: 'down', responseTime: Date.now() - start, errorMessage: 'Script content is empty' };
      }

      const expectedExit = cfg.expected_exit_code ?? 0;
      const timeoutSec = cfg.timeout ?? 30;
      const type = cfg.script_type || 'bash';

      // Check if this should run locally or via SSH
      if (service.host_connection_type === 'ssh') {
        return await this.checkScriptViaSSH(service, cfg, scriptContent, expectedExit, timeoutSec, type, start);
      } else {
        return await this.checkScriptLocally(service, cfg, scriptContent, expectedExit, timeoutSec, type, start);
      }
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        errorMessage: error.message || 'Script check failed'
      };
    }
  }

  private static async checkScriptLocally(
    service: Service,
    cfg: ScriptConfig,
    scriptContent: string,
    expectedExit: number,
    timeoutSec: number,
    type: string,
    start: number
  ): Promise<CheckResult> {
    const isWindows = os.platform() === 'win32';
    const runtimeMap: Record<string, string> = {
      bash: isWindows ? 'bash' : 'bash',  // Requires WSL or Git Bash on Windows
      python: isWindows ? 'python' : 'python3',
      powershell: isWindows ? 'powershell.exe' : 'pwsh',
      nodejs: 'node'
    };
    const extMap: Record<string, string> = {
      bash: 'sh',
      python: 'py',
      powershell: 'ps1',
      nodejs: 'js'
    };

    const runtime = runtimeMap[type] || (isWindows ? 'powershell.exe' : 'bash');
    const ext = extMap[type] || (isWindows ? 'ps1' : 'sh');
    const tmpDir = os.tmpdir();
    const tmpName = `sm-script-${uuidv4()}.${ext}`;
    const tmpPath = path.join(tmpDir, tmpName);

    try {
      // Write script to temp file
      fs.writeFileSync(tmpPath, scriptContent, 'utf-8');
      
      // Build command
      let command: string;
      const workdir = cfg.working_dir || '';
      const cdCommand = workdir ? (isWindows ? `cd "${workdir}" && ` : `cd ${workdir} && `) : '';
      
      if (type === 'powershell') {
        command = `${cdCommand}${runtime} -ExecutionPolicy Bypass -File "${tmpPath}"`;
      } else {
        if (!isWindows) {
          fs.chmodSync(tmpPath, 0o755);
        }
        command = `${cdCommand}${runtime} "${tmpPath}"`;
      }

      // Execute with timeout
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeoutSec * 1000,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        windowsHide: true
      });

      const status: 'up' | 'down' = 'up'; // Exit code 0 (execAsync succeeds)
      const message = `Exit 0 (expected ${expectedExit})`;

      return {
        status: expectedExit === 0 ? 'up' : 'down',
        responseTime: Date.now() - start,
        errorMessage: expectedExit === 0 ? undefined : message,
        output: message,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
    } catch (error: any) {
      // execAsync throws on non-zero exit code
      const exitCode = error.code ?? 1;
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      const status: 'up' | 'down' = exitCode === expectedExit ? 'up' : 'down';
      const message = `Exit ${exitCode} (expected ${expectedExit})`;

      return {
        status,
        responseTime: Date.now() - start,
        errorMessage: status === 'up' ? undefined : message,
        output: message,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private static async checkScriptViaSSH(
    service: Service,
    cfg: ScriptConfig,
    scriptContent: string,
    expectedExit: number,
    timeoutSec: number,
    type: string,
    start: number
  ): Promise<CheckResult> {
    const creds = this.buildSSHCredentials(service);

    const runtimeMap: Record<string, string> = {
      bash: 'bash',
      python: 'python3',
      powershell: 'pwsh',
      nodejs: 'node'
    };
    const extMap: Record<string, string> = {
      bash: 'sh',
      python: 'py',
      powershell: 'ps1',
      nodejs: 'js'
    };

    const runtime = runtimeMap[type] || 'bash';
    const ext = extMap[type] || 'sh';
    const base64Script = Buffer.from(scriptContent, 'utf-8').toString('base64');
    const workdir = cfg.working_dir ? `cd ${cfg.working_dir} && ` : '';
    const tmpName = `sm-script-${uuidv4()}.${ext}`;

    const remoteCommand = [
      `tmp=/tmp/${tmpName}`,
      `echo '${base64Script}' | base64 -d > "$tmp"`,
      'chmod +x "$tmp"',
      `${workdir}timeout ${timeoutSec}s ${runtime} "$tmp"`,
      'code=$?',
      'rm -f "$tmp"',
      'exit $code'
    ].join(' && ');

    const execResult = await SSHService.executeCommand(creds, remoteCommand);
    const status: 'up' | 'down' = execResult.code === expectedExit ? 'up' : 'down';
    const message = status === 'up'
      ? `Exit ${execResult.code} (expected ${expectedExit})`
      : `Exit ${execResult.code} (expected ${expectedExit})`;

    return {
      status,
      responseTime: Date.now() - start,
      errorMessage: status === 'up' ? undefined : message,
      output: message,
      stdout: execResult.stdout,
      stderr: execResult.stderr
    };
  }

  private static async checkFile(service: Service): Promise<CheckResult> {
    const start = Date.now();
    try {
      const cfg: FileCheckConfig = service.file_config ? JSON.parse(service.file_config) : {};
      const mode = cfg.mode || 'single';
      const directory = cfg.directory_path || '';
      const filePath = cfg.file_path || '';
      const pattern = cfg.filename_pattern || '*';
      // Note: pattern_type removed - will auto-detect in shell script
      const useLatest = cfg.use_latest !== false; // default true
      const freshnessDays = cfg.freshness_days ?? 0;
      const maxAgeMinutes = cfg.max_age_minutes ?? 0;
      const checkType = cfg.check_type || 'exists';
      const contentPattern = cfg.content_pattern || '';
      const expectedSizeKB = cfg.expected_size_delta ?? 0;
      const timeoutSec = cfg.timeout_seconds ?? 20;

      const creds = this.buildSSHCredentials(service);

      const shellScript = `#!/usr/bin/env bash
MODE="${mode}"
FILE_PATH="${filePath}"
DIR_PATH="${directory}"
PATTERN="${pattern}"
USE_LATEST=${useLatest ? 1 : 0}
FRESH_DAYS=${freshnessDays}
MAX_AGE_MIN=${maxAgeMinutes}
CHECK_TYPE="${checkType}"
CONTENT_PATTERN="${contentPattern}"
EXPECTED_KB=${expectedSizeKB}
NOW=$(date +%s)

json_output() {
  local status="$1"; shift
  local message="$1"; shift
  local path="$1"; shift
  local mtime="$1"; shift
  local size="$1"; shift
  local age="$1"; shift
  local match="$1"; shift
  printf '{"status":"%s","message":"%s","path":"%s","mtime":%s,"size":%s,"age_seconds":%s,"content_match":%s}\n' "$status" "$message" "$path" "$mtime" "$size" "$age" "$match"
}

pick_target() {
  if [ "$MODE" = "single" ]; then
    if [ -z "$FILE_PATH" ]; then
      json_output "down" "File path missing" "" 0 0 0 false
      return 1
    fi
    if [ ! -f "$FILE_PATH" ]; then
      json_output "down" "File not found: $FILE_PATH" "$FILE_PATH" 0 0 0 false
      return 1
    fi
    echo "$FILE_PATH"
    return 0
  fi

  if [ -z "$DIR_PATH" ]; then
    json_output "down" "Directory path missing" "" 0 0 0 false
    return 1
  fi

  local latest
  # Try glob matching first
  latest=$(find "$DIR_PATH" -maxdepth 1 -type f -name "$PATTERN" -printf '%T@|%s|%p\\n' 2>/dev/null | sort -nr | head -n1)
  
  # If no match with glob, try regex matching
  if [ -z "$latest" ]; then
    latest=$(find "$DIR_PATH" -maxdepth 1 -type f -printf '%T@|%s|%p\\n' 2>/dev/null | \
      grep -E "$PATTERN" | sort -nr | head -n1)
  fi
  
  if [ -z "$latest" ]; then
    json_output "down" "No matched file" "" 0 0 0 false
    return 1
  fi
  IFS='|' read -r mtime size path <<<"$latest"
  echo "$path"
  return 0
}

TARGET=$(pick_target)
PICK_EC=$?
if [ $PICK_EC -ne 0 ]; then
  # pick_target already printed the error JSON to stdout (captured in $TARGET)
  echo "$TARGET"
  exit 0
fi

MTIME=$(stat -c %Y "$TARGET" 2>/dev/null)
SIZE=$(stat -c %s "$TARGET" 2>/dev/null)
AGE=$((NOW - MTIME))

STATUS="up"
MESSAGE="OK"
MATCH_RESULT=false

if [ $FRESH_DAYS -gt 0 ]; then
  FRESH_LIMIT=$((FRESH_DAYS * 86400))
  if [ $AGE -gt $FRESH_LIMIT ]; then
    STATUS="down"
    MESSAGE="File older than freshness window"
  fi
fi

if [ $MAX_AGE_MIN -gt 0 ]; then
  MAX_AGE_SEC=$((MAX_AGE_MIN * 60))
  if [ $AGE -gt $MAX_AGE_SEC ]; then
    STATUS="down"
    MESSAGE="File older than max age"
  fi
fi

if [ "$CHECK_TYPE" = "size" ] && [ $EXPECTED_KB -gt 0 ]; then
  MIN_BYTES=$((EXPECTED_KB * 1024))
  if [ $SIZE -lt $MIN_BYTES ]; then
    STATUS="down"
    MESSAGE="File smaller than expected"
  fi
fi

if [ "$CHECK_TYPE" = "content" ] && [ -n "$CONTENT_PATTERN" ]; then
  if grep -Eq "$CONTENT_PATTERN" "$TARGET"; then
    MATCH_RESULT=true
  else
    STATUS="down"
    MESSAGE="Content pattern not found"
    MATCH_RESULT=false
  fi
fi

json_output "$STATUS" "$MESSAGE" "$TARGET" "$MTIME" "$SIZE" "$AGE" "$MATCH_RESULT"
exit 0
`;

      const base64Script = Buffer.from(shellScript, 'utf-8').toString('base64');
      const remoteCommand = `echo '${base64Script}' | base64 -d | timeout ${timeoutSec}s bash`;
      const execResult = await SSHService.executeCommand(creds, remoteCommand);

      let parsed: any;
      try {
        // 用正则从 stdout 中提取第一个完整 JSON 对象，对 SSH banner 或多余输出免疫
        const jsonMatch = (execResult.stdout || '').match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error('no JSON found');
        parsed = JSON.parse(jsonMatch[0]);
      } catch (err: any) {
        return {
          status: 'down',
          responseTime: Date.now() - start,
          errorMessage: 'Failed to parse file check output',
          stdout: execResult.stdout,
          stderr: execResult.stderr
        };
      }

      const statusMap: Record<string, 'up' | 'down' | 'warning'> = {
        up: 'up',
        down: 'down',
        warning: 'warning'
      };
      const status = statusMap[parsed.status] || 'down';
      const output = parsed.message || `File check ${status}`;

      return {
        status,
        responseTime: Date.now() - start,
        errorMessage: status === 'up' ? undefined : output,
        output,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        details: parsed
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        errorMessage: error.message || 'File check failed'
      };
    }
  }

  private static async checkTcp(service: Service): Promise<CheckResult> {
    // Check if this service should be checked via SSH (internal network)
    if (service.host_connection_type === 'ssh' && service.host_ssh_host) {
      return await this.checkTcpViaSSH(service);
    }

    // Standard external TCP check
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      
      socket.setTimeout(10000); // Increased from 5000ms to 10000ms for production network latency

      socket.on('connect', () => {
        const duration = Date.now() - start;
        socket.destroy();
        resolve({ status: 'up', responseTime: duration });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'down', responseTime: Date.now() - start, errorMessage: 'Connection timed out' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'down', responseTime: Date.now() - start, errorMessage: err.message });
      });

      socket.connect(service.port, service.host);
    });
  }

  /**
   * Check HTTP/HTTPS service via SSH (internal server access)
   * Used when host connection_type is 'ssh' to bypass firewall restrictions
   */
  private static async checkHttpViaSSH(service: Service): Promise<CheckResult> {
    const startTime = Date.now();

    if (!service.host_ssh_host || !service.host_ssh_username) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: 'SSH host configuration missing'
      };
    }

    const config = service.http_config ? JSON.parse(service.http_config) : {};
    const protocol = service.check_type; // 'http' or 'https'
    const path = config.path || '/';
    const expectedStatus = config.expected_status || 200;
    const timeout = config.timeout || 15;

    try {
      // Build SSH credentials
      const credentials: SSHCredentials = {
        host: service.host_ssh_host,
        port: service.host_ssh_port || 22,
        username: service.host_ssh_username,
        auth_type: service.host_ssh_auth_type || 'password',
        credential: service.host_ssh_auth_type === 'password' 
          ? service.host_ssh_password || ''
          : service.host_ssh_private_key || '',
        passphrase: service.host_ssh_passphrase,
        proxy_host: service.host_ssh_proxy_host,
        proxy_port: service.host_ssh_proxy_port
      };

      console.log(`[HTTP via SSH] Checking ${protocol}://localhost:${service.port}${path} on ${service.host_ssh_host}`);

      const result = await SSHService.checkHttpViaSSH(
        credentials,
        protocol as 'http' | 'https',
        service.port,
        path,
        expectedStatus,
        timeout
      );

      // Map SSH check result to CheckResult
      const statusMap: Record<string, 'up' | 'down' | 'warning'> = {
        'healthy': 'up',
        'warning': 'warning',
        'critical': 'down'
      };

      return {
        status: statusMap[result.status] || 'down',
        responseTime: result.responseTime,
        errorMessage: result.status !== 'healthy' ? result.message : undefined
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: `SSH HTTP check failed: ${error.message}`
      };
    }
  }

  /**
   * Check TCP service via SSH (internal server access)
   * Used when host connection_type is 'ssh' to bypass firewall restrictions
   */
  private static async checkTcpViaSSH(service: Service): Promise<CheckResult> {
    const startTime = Date.now();

    if (!service.host_ssh_host || !service.host_ssh_username) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: 'SSH host configuration missing'
      };
    }

    const timeout = 5; // TCP connection timeout in seconds

    try {
      // Build SSH credentials
      const credentials: SSHCredentials = {
        host: service.host_ssh_host,
        port: service.host_ssh_port || 22,
        username: service.host_ssh_username,
        auth_type: service.host_ssh_auth_type || 'password',
        credential: service.host_ssh_auth_type === 'password' 
          ? service.host_ssh_password || ''
          : service.host_ssh_private_key || '',
        passphrase: service.host_ssh_passphrase,
        proxy_host: service.host_ssh_proxy_host,
        proxy_port: service.host_ssh_proxy_port
      };

      // Check TCP port via SSH
      // Use 'localhost' if service.host matches ssh_host (checking local service)
      const targetHost = service.host === service.host_ssh_host ? 'localhost' : service.host;
      
      const result = await SSHService.checkTcpViaSSH(
        credentials,
        targetHost,
        service.port,
        timeout
      );

      if (result.status === 'healthy') {
        return {
          status: 'up',
          responseTime: result.responseTime
        };
      } else {
        return {
          status: 'down',
          responseTime: result.responseTime,
          errorMessage: result.message
        };
      }
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: `SSH TCP check failed: ${error.message}`
      };
    }
  }

  /**
   * Check SSH type service
   */
  private static async checkSSH(service: Service): Promise<CheckResult> {
    const startTime = Date.now();
    
    if (!service.ssh_config_id) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: 'SSH config not configured'
      };
    }

    // Get SSH credentials from security_configs
    const sshConfig = db.prepare(`
      SELECT ssh_host, ssh_port, ssh_username, ssh_auth_type, 
             ssh_credential, ssh_passphrase, ssh_proxy_host, ssh_proxy_port,
             ssh_proxy_username, ssh_proxy_auth_type, ssh_proxy_credential
      FROM security_configs 
      WHERE id = ? AND type = 'ssh'
    `).get(service.ssh_config_id) as any;

    if (!sshConfig) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: `SSH config not found: ${service.ssh_config_id}`
      };
    }

    const credentials: SSHCredentials = {
      host: sshConfig.ssh_host,
      port: sshConfig.ssh_port || 22,
      username: sshConfig.ssh_username,
      auth_type: sshConfig.ssh_auth_type,
      credential: sshConfig.ssh_credential,
      passphrase: sshConfig.ssh_passphrase,
      proxy_host: sshConfig.ssh_proxy_host,
      proxy_port: sshConfig.ssh_proxy_port,
      proxy_username: sshConfig.ssh_proxy_username,
      proxy_auth_type: sshConfig.ssh_proxy_auth_type,
      proxy_credential: sshConfig.ssh_proxy_credential
    };

    const checkConfig = service.ssh_check_config ? JSON.parse(service.ssh_check_config) : {};

    try {
      let checkResult;
      
      switch (service.ssh_check_type) {
        case 'file-age':
          checkResult = await SSHService.checkFileAge(
            credentials,
            checkConfig.path || '',
            checkConfig.pattern || '*',
            checkConfig.max_age_seconds || 604800
          );
          break;
          
        case 'file-exists':
          checkResult = await SSHService.checkFileExists(
            credentials,
            checkConfig.path || ''
          );
          break;
          
        case 'docker-running':
          checkResult = await SSHService.checkDockerRunning(
            credentials,
            checkConfig.container_name || ''
          );
          break;
          
        case 'docker-health':
          checkResult = await SSHService.checkDockerHealth(
            credentials,
            checkConfig.container_name || ''
          );
          break;
          
        case 'command':
          checkResult = await SSHService.checkCommand(
            credentials,
            checkConfig.command || 'echo ok',
            checkConfig.success_pattern
          );
          break;
          
        default:
          return {
            status: 'down',
            responseTime: Date.now() - startTime,
            errorMessage: `Unknown SSH check type: ${service.ssh_check_type}`
          };
      }

      // Map SSH check result to CheckResult
      const statusMap: Record<string, 'up' | 'down' | 'warning'> = {
        'healthy': 'up',
        'warning': 'warning',
        'critical': 'down'
      };

      return {
        status: statusMap[checkResult.status] || 'down',
        responseTime: Date.now() - startTime,
        errorMessage: checkResult.status !== 'healthy' ? checkResult.message : undefined
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        errorMessage: error.message || 'SSH check failed'
      };
    }
  }

  static async saveResult(serviceId: string, result: CheckResult) {
    const checkedAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO check_records (id, service_id, status, response_time, error_message, output, stdout, stderr, details, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      uuidv4(),
      serviceId,
      result.status,
      result.responseTime,
      result.errorMessage || null,
      result.output || null,
      result.stdout || null,
      result.stderr || null,
      result.details ? JSON.stringify(result.details) : null,
      checkedAt
    );
    // Broadcast to SSE clients
    checkEventBus.broadcast({
      serviceId,
      status: result.status,
      responseTime: result.responseTime ?? null,
      errorMessage: result.errorMessage || null,
      checkedAt,
    });
  }
}
