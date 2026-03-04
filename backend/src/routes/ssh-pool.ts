import express from 'express';
import SSHConnectionPool from '../services/ssh-connection-pool';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Get SSH connection pool statistics
 * Bug #022: 监控 SSH 连接池状态
 */
router.get('/pool-stats', (req, res) => {
  try {
    const stats = SSHConnectionPool.getPoolStats();
    
    logger.ssh.debug('SSH connection pool stats requested', stats);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.ssh.error('Failed to get pool stats', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
