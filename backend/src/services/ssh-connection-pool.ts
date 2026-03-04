import { Client, ConnectConfig } from 'ssh2';
import logger from '../utils/logger';

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'private_key';
  credential: string;
  passphrase?: string;
  proxy_host?: string;
  proxy_port?: number;
  proxy_username?: string;
  proxy_auth_type?: 'password' | 'private_key';
  proxy_credential?: string;
  connection_timeout?: number;
  command_timeout?: number;
}

interface PooledConnection {
  connection: Client;
  credentials: SSHCredentials;
  proxyConnection?: Client;  // Bug #029 Fix: Store proxy connection for explicit cleanup
  lastUsed: number;
  inUse: boolean;
  connectTime: number;
}

interface ConnectionQueue {
  resolve: (conn: PooledConnection) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: number; // 优先级：1=低（host heartbeat），5=高（service check）
}

interface HostConnectionPool {
  connections: PooledConnection[];
  queue: ConnectionQueue[];
  maxConnections: number;
}

/**
 * SSH 连接池
 * 为每个 SSH 主机维护连接池，实现连接复用
 * Bug #022: 解决 SSH 连接数过多问题
 */
export class SSHConnectionPool {
  private static pools: Map<string, HostConnectionPool> = new Map();
  
  // 配置参数
  private static maxConnectionsPerHost = 3;           // 每个主机最多3个连接
  private static idleTimeout = 1 * 60 * 1000;         // 空闲1分钟后关闭（优化：从2分钟缩短）
  private static connectionTimeout = 30 * 1000;       // 连接超时30秒（优化：从10秒增加）
  private static queueTimeout = 30 * 1000;            // 队列等待超时30秒
  
  // 空闲连接清理定时器
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static cleanupIntervalMs = 30 * 1000;       // 每30秒检查一次
  
  // 并发控制锁（防止race condition）
  private static creationLocks: Map<string, Promise<PooledConnection>> = new Map();
  
  /**
   * 初始化连接池（启动清理定时器）
   */
  static init(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupIdleConnections();
      }, this.cleanupIntervalMs);
      
      logger.ssh.info('SSH connection pool initialized', {
        maxConnectionsPerHost: this.maxConnectionsPerHost,
        idleTimeout: `${this.idleTimeout / 1000}s`,
        cleanupInterval: `${this.cleanupIntervalMs / 1000}s`
      });
    }
  }
  
  /**
   * 获取连接池的唯一标识
   * 格式: host:port[@proxy_host:proxy_port]
   */
  private static getPoolKey(credentials: SSHCredentials): string {
    const baseKey = `${credentials.host}:${credentials.port}@${credentials.username}`;
    if (credentials.proxy_host) {
      return `${baseKey}@proxy:${credentials.proxy_host}:${credentials.proxy_port || 22}`;
    }
    return baseKey;
  }
  
  /**
   * 获取或创建主机连接池
   */
  private static getOrCreatePool(key: string): HostConnectionPool {
    if (!this.pools.has(key)) {
      this.pools.set(key, {
        connections: [],
        queue: [],
        maxConnections: this.maxConnectionsPerHost
      });
      logger.ssh.debug('Created new connection pool', { poolKey: key });
    }
    return this.pools.get(key)!;
  }
  
  /**
   * 获取可用的连接
   * @param credentials SSH凭证
   * @param priority 优先级 1=低（host heartbeat）5=高（service check）默认5
   */
  static async getConnection(credentials: SSHCredentials, priority: number = 5): Promise<PooledConnection> {
    const poolKey = this.getPoolKey(credentials);
    const pool = this.getOrCreatePool(poolKey);
    
    logger.ssh.debug('[POOL] getConnection called', {
      poolKey,
      poolSize: pool.connections.length,
      activeConns: pool.connections.filter(c => c.inUse).length,
      queueLength: pool.queue.length,
      priority,
      hasLock: this.creationLocks.has(poolKey)
    });
    
    // 1. 查找空闲的可用连接，并验证连接健康
    // Bug #023 Fix: 先标记 inUse=true 再做 async 健康检查，防止多个并发请求抢到同一个空闲连接
    while (true) {
      const idleConnection = pool.connections.find(c => !c.inUse);
      if (!idleConnection) break;
      
      // 立即标记为使用中，防止 race condition（isConnectionAlive 是异步的）
      idleConnection.inUse = true;
      
      if (await this.isConnectionAlive(idleConnection)) {
        idleConnection.lastUsed = Date.now();
        
        logger.ssh.debug('Reusing idle connection', { 
          poolKey,
          activeConnections: pool.connections.filter(c => c.inUse).length,
          idleConnections: pool.connections.filter(c => !c.inUse).length
        });
        
        return idleConnection;
      } else {
        // 连接已失效，取消标记并移除
        idleConnection.inUse = false;
        logger.ssh.warn('[POOL] Idle connection is dead, removing', {
          poolKey,
          remainingBeforeRemove: pool.connections.length
        });
        this.closeConnection(idleConnection);
        pool.connections = pool.connections.filter(c => c !== idleConnection);
        // 继续循环尝试下一个空闲连接
      }
    }
    
    // 2. 如果未达到最大连接数，创建新连接（使用锁防止并发创建）
    if (pool.connections.length < pool.maxConnections) {
      // 检查是否已经有正在创建的连接
      const existingLock = this.creationLocks.get(poolKey);
      if (existingLock) {
        logger.ssh.debug('[POOL] Waiting for existing connection creation', { poolKey });
        try {
          // Bug #028 Fix: 不要直接返回正在创建的连接（它已经inUse=true）
          // 而是等待创建完成后，再次尝试获取idle连接或进入队列
          await existingLock;
          logger.ssh.debug('[POOL] Existing connection created, re-checking pool', { poolKey });
          // 递归调用，重新评估连接池状态
          return await this.getConnection(credentials, priority);
        } catch (error) {
          // 如果正在创建的连接失败，继续尝试创建新连接
          logger.ssh.debug('[POOL] Existing connection creation failed, trying again', { poolKey });
        }
      }
      
      // 再次检查连接数（可能在等待期间已创建）
      if (pool.connections.length >= pool.maxConnections) {
        logger.ssh.debug('[POOL] Pool filled while waiting, searching for idle connection', { poolKey });
        const idleConn = pool.connections.find(c => !c.inUse);
        if (idleConn) {
          idleConn.inUse = true;
          idleConn.lastUsed = Date.now();
          return idleConn;
        }
        // 如果仍无空闲连接，继续到队列逻辑
      } else {
        // 创建新连接，使用锁
        const creationPromise = this.createConnection(credentials, poolKey)
          .then(newConnection => {
            pool.connections.push(newConnection);
            this.creationLocks.delete(poolKey);
            
            logger.ssh.info('[POOL] Created new pooled connection', {
              poolKey,
              totalConnections: pool.connections.length,
              maxConnections: pool.maxConnections,
              allPools: this.pools.size,
              totalSystemConns: Array.from(this.pools.values()).reduce((sum, p) => sum + p.connections.length, 0)
            });
            
            return newConnection;
          })
          .catch(error => {
            this.creationLocks.delete(poolKey);
            logger.ssh.error('Failed to create new connection', { 
              poolKey, 
              error: error.message,
              errorType: error.name
            });
            throw error;
          });
        
        this.creationLocks.set(poolKey, creationPromise);
        return await creationPromise;
      }
    }
    
    // 3. 已达最大连接数，加入等待队列
    logger.ssh.debug('Connection pool full, queuing request', {
      poolKey,
      queueLength: pool.queue.length,
      activeConnections: pool.connections.filter(c => c.inUse).length
    });
    
    return new Promise((resolve, reject) => {
      const queueEntry: ConnectionQueue = {
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      };
      
      // 插入队列并按优先级排序（优先级高的在前）
      pool.queue.push(queueEntry);
      pool.queue.sort((a, b) => b.priority - a.priority);
      
      // 设置队列超时
      setTimeout(() => {
        const index = pool.queue.indexOf(queueEntry);
        if (index !== -1) {
          pool.queue.splice(index, 1);
          reject(new Error(`Connection queue timeout after ${this.queueTimeout}ms`));
        }
      }, this.queueTimeout);
    });
  }
  
  /**
   * 创建新的SSH连接
   */
  private static async createConnection(
    credentials: SSHCredentials,
    poolKey: string
  ): Promise<PooledConnection> {
    const startTime = Date.now();
    const conn = new Client();
    let resolved = false;
    let errorHandled = false;
    let proxyConnRef: Client | undefined; // Bug #029 Fix: Store proxy connection reference
    
    return new Promise((resolve, reject) => {
      conn.setMaxListeners(20);
      
      const cleanup = (removeFromPool: boolean = false) => {
        if (resolved) return;
        resolved = true;
        
        // Bug #031 Fix: 清理代理连接（如果已创建但还未赋值到 pooledConn）
        if (proxyConnRef) {
          try {
            proxyConnRef.removeAllListeners();
            proxyConnRef.end();
            proxyConnRef.destroy();
            logger.ssh.debug('[POOL] Cleaned up proxy connection during creation cleanup', { poolKey });
          } catch (e) { /* ignore */ }
        }
        
        conn.removeAllListeners();
        conn.end();
        conn.destroy();
        
        if (removeFromPool) {
          const pool = this.pools.get(poolKey);
          if (pool) {
            pool.connections = pool.connections.filter(c => c.connection !== conn);
          }
        }
      };
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          logger.ssh.warn('SSH connection creation timeout', {
            poolKey,
            timeout: credentials.connection_timeout || this.connectionTimeout
          });
          cleanup(true);
          reject(new Error('Connection timeout'));
        }
      }, credentials.connection_timeout || this.connectionTimeout);
      
      conn.on('error', (err) => {
        if (!errorHandled) {
          errorHandled = true;
          logger.ssh.error('SSH connection error during creation', {
            poolKey,
            error: err.message,
            errorType: err.name
          });
          clearTimeout(timeoutId);
          cleanup(true);
          reject(err);
        } else {
          logger.ssh.debug('SSH connection error (already handled)', {
            poolKey,
            error: err.message
          });
        }
      });
      
      conn.on('ready', () => {
        clearTimeout(timeoutId);
        
        const pooledConn: PooledConnection = {
          connection: conn,
          credentials,
          proxyConnection: proxyConnRef, // Bug #029 Fix: Store proxy reference
          lastUsed: Date.now(),
          inUse: true,
          connectTime: Date.now() - startTime
        };
        
        resolve(pooledConn);
      });
      
      // 处理意外关闭
      conn.on('close', () => {
        if (!resolved && !errorHandled) {
          errorHandled = true;
          clearTimeout(timeoutId);
          cleanup(true);
          reject(new Error('Connection closed unexpectedly'));
        }
      });
      
      // 构建连接配置
      const connConfig: ConnectConfig = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
        readyTimeout: credentials.connection_timeout || this.connectionTimeout,
      };
      
      if (credentials.auth_type === 'password') {
        connConfig.password = credentials.credential;
      } else {
        connConfig.privateKey = credentials.credential;
        if (credentials.passphrase) {
          connConfig.passphrase = credentials.passphrase;
        }
      }
      
      // 处理代理连接
      process.nextTick(() => {
        try {
          if (credentials.proxy_host) {
            // Bug #029 Fix: 获取并存储 proxy connection 引用
            this.connectViaProxy(credentials, connConfig, conn)
              .then((proxyConn) => {
                // Store proxy reference for cleanup
                proxyConnRef = proxyConn;
              })
              .catch((err) => {
                if (!errorHandled) {
                  errorHandled = true;
                  clearTimeout(timeoutId);
                  cleanup(true);
                  reject(err);
                }
              });
          } else {
            conn.connect(connConfig);
          }
        } catch (err) {
          if (!errorHandled) {
            errorHandled = true;
            clearTimeout(timeoutId);
            cleanup(true);
            reject(err);
          }
        }
      });
    });
  }
  
  /**
   * 通过代理连接
   * Bug #029 Fix: 返回 proxy connection 引用以便后续清理
   */
  private static async connectViaProxy(
    credentials: SSHCredentials,
    targetConfig: ConnectConfig,
    targetConn: Client
  ): Promise<Client> {
    return new Promise((resolve, reject) => {
      const proxyConn = new Client();
      let proxyCleanedUp = false;
      let proxyErrorHandled = false;
      
      proxyConn.setMaxListeners(20);
      
      const cleanupProxy = () => {
        if (proxyCleanedUp) return;
        proxyCleanedUp = true;
        proxyConn.removeAllListeners();
        proxyConn.end();
        proxyConn.destroy();
      };
      
      proxyConn.on('error', (err) => {
        if (!proxyErrorHandled) {
          proxyErrorHandled = true;
          cleanupProxy();
          targetConn.removeAllListeners();
          targetConn.end();
          targetConn.destroy();
          reject(err);
        }
      });
      
      proxyConn.on('ready', () => {
        proxyConn.forwardOut(
          '127.0.0.1',
          0,
          credentials.host,
          credentials.port || 22,
          (err, stream) => {
            if (err) {
              cleanupProxy();
              return reject(err);
            }
            
            targetConfig.sock = stream;
            targetConn.connect(targetConfig);
            
            targetConn.once('close', () => cleanupProxy());
            targetConn.once('error', () => cleanupProxy());
            
            // Bug #029 Fix: 返回 proxyConn 引用
            resolve(proxyConn);
          }
        );
      });
      
      const proxyConfig: ConnectConfig = {
        host: credentials.proxy_host!,
        port: credentials.proxy_port || 22,
        username: credentials.proxy_username || credentials.username,
        readyTimeout: credentials.connection_timeout || this.connectionTimeout,
      };
      
      if (credentials.proxy_auth_type === 'password' ||
          (!credentials.proxy_auth_type && credentials.auth_type === 'password')) {
        proxyConfig.password = credentials.proxy_credential || credentials.credential;
      } else {
        proxyConfig.privateKey = credentials.proxy_credential || credentials.credential;
        if (credentials.passphrase) {
          proxyConfig.passphrase = credentials.passphrase;
        }
      }
      
      process.nextTick(() => {
        try {
          proxyConn.connect(proxyConfig);
        } catch (err) {
          if (!proxyErrorHandled) {
            proxyErrorHandled = true;
            cleanupProxy();
            targetConn.removeAllListeners();
            targetConn.end();
            targetConn.destroy();
            reject(err);
          }
        }
      });
    });
  }
  
  /**
   * 释放连接（归还到池中）
   */
  static releaseConnection(pooledConn: PooledConnection): void {
    pooledConn.inUse = false;
    pooledConn.lastUsed = Date.now();
    
    const poolKey = this.getPoolKey(pooledConn.credentials);
    const pool = this.pools.get(poolKey);
    
    if (!pool) {
      // 池已被清理，关闭连接
      logger.ssh.warn('[POOL] Pool not found when releasing, closing connection', { poolKey });
      this.closeConnection(pooledConn);
      return;
    }
    
    logger.ssh.debug('[POOL] Released connection back to pool', {
      poolKey,
      activeConnections: pool.connections.filter(c => c.inUse).length,
      idleConnections: pool.connections.filter(c => !c.inUse).length,
      queueLength: pool.queue.length,
      totalSystemConns: Array.from(this.pools.values()).reduce((sum, p) => sum + p.connections.length, 0)
    });
    
    // 检查是否有等待的请求（队列已按优先级排序）
    if (pool.queue.length > 0) {
      const queueEntry = pool.queue.shift()!;
      pooledConn.inUse = true;
      pooledConn.lastUsed = Date.now();
      
      logger.ssh.debug('Assigned pooled connection to queued request', {
        poolKey,
        remainingQueue: pool.queue.length,
        requestPriority: queueEntry.priority
      });
      
      queueEntry.resolve(pooledConn);
    }
  }
  
  /**
   * 移除并关闭一个失效的连接（不归还到池中）
   * Bug #030 Fix: Remove zombie connections
   * Bug #023 Fix: 移除后尝试为队列中的请求创建新连接
   */
  static removeConnection(pooledConn: PooledConnection): void {
    const poolKey = this.getPoolKey(pooledConn.credentials);
    const pool = this.pools.get(poolKey);
    
    if (pool) {
      // Remove from pool
      const beforeCount = pool.connections.length;
      pool.connections = pool.connections.filter(c => c !== pooledConn);
      
      if (pool.connections.length < beforeCount) {
        logger.ssh.info('[POOL] Removed dead connection from pool', {
          poolKey,
          remainingConnections: pool.connections.length,
          activeConnections: pool.connections.filter(c => c.inUse).length,
          queueLength: pool.queue.length,
          totalSystemConns: Array.from(this.pools.values()).reduce((sum, p) => sum + p.connections.length, 0)
        });
        
        // 如果有队列等待且池未满，异步创建新连接来服务队列
        if (pool.queue.length > 0 && pool.connections.length < pool.maxConnections) {
          this.replenishPoolForQueue(pooledConn.credentials, poolKey, pool);
        }
      }
    }
    
    // Close the connection
    this.closeConnection(pooledConn);
  }
  
  /**
   * 为队列中等待的请求创建新连接
   * 防止所有连接死亡后队列请求全部超时
   */
  private static async replenishPoolForQueue(
    credentials: SSHCredentials,
    poolKey: string,
    pool: HostConnectionPool
  ): Promise<void> {
    // 如果已有正在创建的连接，不重复创建
    if (this.creationLocks.has(poolKey)) return;
    
    try {
      logger.ssh.debug('[POOL] Replenishing connection for queued requests', {
        poolKey,
        queueLength: pool.queue.length
      });
      
      const creationPromise = this.createConnection(credentials, poolKey)
        .then(newConnection => {
          pool.connections.push(newConnection);
          this.creationLocks.delete(poolKey);
          
          logger.ssh.info('[POOL] Replenished connection for queue', {
            poolKey,
            totalConnections: pool.connections.length
          });
          
          // 把新连接分配给队列中的第一个请求
          if (pool.queue.length > 0) {
            const queueEntry = pool.queue.shift()!;
            newConnection.inUse = true;
            newConnection.lastUsed = Date.now();
            queueEntry.resolve(newConnection);
          } else {
            // 没有等待的请求了，标记为空闲
            newConnection.inUse = false;
          }
          
          return newConnection;
        })
        .catch(error => {
          this.creationLocks.delete(poolKey);
          logger.ssh.warn('[POOL] Failed to replenish connection', {
            poolKey,
            error: error.message
          });
          // 不抛出错误 - 队列请求会在超时后自行reject
        });
      
      this.creationLocks.set(poolKey, creationPromise as Promise<PooledConnection>);
    } catch (error) {
      // 忽略 - replenish 是尽力而为
    }
  }
  
  /**
   * 验证连接是否仍然可用
   * Bug #031 Fix: 防止超时后 stream 泄漏
   */
  private static async isConnectionAlive(pooledConn: PooledConnection): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      };
      
      const timeout = setTimeout(() => {
        settle(false);
        // stream 会在 exec 回调中检查 settled 状态并关闭
      }, 2000); // 2秒超时
      
      try {
        // 通过执行一个简单的命令来验证连接
        pooledConn.connection.exec('echo alive', (err, stream) => {
          if (err) {
            settle(false);
            return;
          }
          
          // Bug #031 Fix: 如果已超时，立即关闭 stream 防止泄漏
          if (settled) {
            try { stream.close(); } catch (e) { /* ignore */ }
            try { stream.destroy(); } catch (e) { /* ignore */ }
            return;
          }
          
          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });
          
          stream.on('close', () => {
            settle(output.includes('alive'));
          });
          
          stream.on('error', () => {
            settle(false);
          });
        });
      } catch (error) {
        settle(false);
      }
    });
  }
  
  /**
   * 关闭单个连接
   * Bug #029 Fix: 显式清理 proxy connection
   */
  private static closeConnection(pooledConn: PooledConnection): void {
    try {
      const poolKey = this.getPoolKey(pooledConn.credentials);
      
      // Bug #029 Fix: 先清理 proxy connection（如果存在）
      if (pooledConn.proxyConnection) {
        try {
          pooledConn.proxyConnection.removeAllListeners();
          pooledConn.proxyConnection.end();
          pooledConn.proxyConnection.destroy();
          logger.ssh.debug('[POOL] Closed proxy connection', { poolKey });
        } catch (proxyError) {
          logger.ssh.warn('[POOL] Error closing proxy connection', { poolKey, error: proxyError });
        }
        pooledConn.proxyConnection = undefined;
      }
      
      // 再清理 target connection
      pooledConn.connection.removeAllListeners();
      pooledConn.connection.end();
      pooledConn.connection.destroy();
      
      logger.ssh.debug('[POOL] Closed pooled connection', {
        poolKey,
        hadProxy: !!pooledConn.credentials.proxy_host,
        idleTime: `${((Date.now() - pooledConn.lastUsed) / 1000).toFixed(1)}s`,
        totalSystemConns: Array.from(this.pools.values()).reduce((sum, p) => sum + p.connections.length, 0)
      });
    } catch (error) {
      logger.ssh.warn('[POOL] Error closing pooled connection', { error });
    }
  }
  
  /**
   * 清理空闲连接
   */
  private static cleanupIdleConnections(): void {
    const now = Date.now();
    let totalClosed = 0;
    
    for (const [poolKey, pool] of this.pools.entries()) {
      const idleConnections = pool.connections.filter(
        c => !c.inUse && (now - c.lastUsed) > this.idleTimeout
      );
      
      for (const conn of idleConnections) {
        this.closeConnection(conn);
        pool.connections = pool.connections.filter(c => c !== conn);
        totalClosed++;
      }
      
      // 如果池为空且没有队列，删除池
      if (pool.connections.length === 0 && pool.queue.length === 0) {
        this.pools.delete(poolKey);
        logger.ssh.debug('Removed empty connection pool', { poolKey });
      }
    }
    
    if (totalClosed > 0) {
      logger.ssh.info('Cleaned up idle connections', {
        closedConnections: totalClosed,
        activePools: this.pools.size
      });
    }
  }
  
  /**
   * 关闭指定主机的连接池
   */
  static closePool(credentials: SSHCredentials): void {
    const poolKey = this.getPoolKey(credentials);
    const pool = this.pools.get(poolKey);
    
    if (!pool) return;
    
    // 关闭所有连接
    for (const conn of pool.connections) {
      this.closeConnection(conn);
    }
    
    // 拒绝所有等待中的请求
    for (const queueEntry of pool.queue) {
      queueEntry.reject(new Error('Connection pool closed'));
    }
    
    this.pools.delete(poolKey);
    
    logger.ssh.info('Closed connection pool', {
      poolKey,
      closedConnections: pool.connections.length,
      rejectedRequests: pool.queue.length
    });
  }
  
  /**
   * 关闭所有连接池
   */
  static closeAllPools(): void {
    logger.ssh.info('Closing all connection pools', { poolCount: this.pools.size });
    
    for (const [poolKey, pool] of this.pools.entries()) {
      for (const conn of pool.connections) {
        this.closeConnection(conn);
      }
      
      for (const queueEntry of pool.queue) {
        queueEntry.reject(new Error('All connection pools closed'));
      }
    }
    
    this.pools.clear();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.ssh.info('All connection pools closed');
  }
  
  /**
   * 获取连接池状态（用于监控）
   */
  static getPoolStats(): {
    totalPools: number;
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    totalQueuedRequests: number;
    pools: Array<{
      poolKey: string;
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      queueLength: number;
    }>;
  } {
    const pools: Array<{
      poolKey: string;
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      queueLength: number;
    }> = [];
    
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    let totalQueuedRequests = 0;
    
    for (const [poolKey, pool] of this.pools.entries()) {
      const active = pool.connections.filter(c => c.inUse).length;
      const idle = pool.connections.filter(c => !c.inUse).length;
      
      pools.push({
        poolKey,
        totalConnections: pool.connections.length,
        activeConnections: active,
        idleConnections: idle,
        queueLength: pool.queue.length
      });
      
      totalConnections += pool.connections.length;
      activeConnections += active;
      idleConnections += idle;
      totalQueuedRequests += pool.queue.length;
    }
    
    return {
      totalPools: this.pools.size,
      totalConnections,
      activeConnections,
      idleConnections,
      totalQueuedRequests,
      pools
    };
  }
}

export default SSHConnectionPool;
