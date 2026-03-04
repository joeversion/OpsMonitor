/**
 * 依赖图共享工具函数和配置
 * 可被 DependencyGraphView 和 CrossProjectDepsView 共同使用
 */

// 服务层级类型
export type ServiceLayer = 'frontend' | 'backend' | 'database' | 'external';

// 区域类型 (用于跨项目视图)
export type ZoneType = 'project' | 'shared';

// 层级配置
export interface LayerConfig {
  id: ServiceLayer;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  height?: number; // percentage
}

// 区域配置
export interface ZoneConfig {
  id: string;
  label: string;
  type: ZoneType;
  width?: number; // percentage
  bgColor?: string;
}

// 层级边框颜色
export const layerColors: Record<ServiceLayer, string> = {
  frontend: '#3b82f6',
  backend: '#10b981',
  database: '#f59e0b',
  external: '#8b5cf6'
};

// 层级顺序 - 决定从上到下的排列
export const layerOrder: ServiceLayer[] = ['frontend', 'backend', 'database', 'external'];

// 根据服务名称判断所属层级
export const getServiceLayer = (name: string, explicitLayer?: string): ServiceLayer => {
  // 如果有明确指定的层级，直接返回
  if (explicitLayer && ['frontend', 'backend', 'database', 'external'].includes(explicitLayer)) {
    return explicitLayer as ServiceLayer;
  }

  const lowerName = name.toLowerCase();
  
  // 数据库/缓存层 - 优先匹配，避免被其他规则覆盖
  if (lowerName.includes('mysql') || lowerName.includes('db') || lowerName.includes('database') ||
      lowerName.includes('postgres') || lowerName.includes('redis') || lowerName.includes('cache') ||
      lowerName.includes('mongo') || lowerName.includes('elastic') || lowerName.includes('mq') ||
      lowerName.includes('kafka') || lowerName.includes('rabbit') || lowerName.includes('timescale') ||
      lowerName.includes('rds') || lowerName.includes('storage')) {
    return 'database';
  }
  
  // 前端/网关层 - 包含 front, gateway, web, ui 等
  if (lowerName.includes('front') || lowerName.includes('web') || lowerName.includes('ui') ||
      lowerName.includes('gateway') || lowerName.includes('nginx') || lowerName.includes('api-gateway') ||
      lowerName.includes('app') || lowerName.includes('client') || lowerName.includes('portal')) {
    return 'frontend';
  }
  
  // 外部服务
  if (lowerName.includes('external') || lowerName.includes('stripe') || lowerName.includes('twilio') ||
      lowerName.includes('sendgrid') || lowerName.includes('aws') || lowerName.includes('azure') ||
      lowerName.includes('ssl') || lowerName.includes('cert') || lowerName.includes('ftp') ||
      lowerName.includes('accesskey') || lowerName.includes('shared')) {
    return 'external';
  }
  
  // 后端服务（默认）
  return 'backend';
};

// 获取服务所属区域
export const getServiceZone = (serviceId: string, projectId?: string): string => {
  // 如果明确指定了项目ID，直接返回
  if (projectId) return projectId.toLowerCase();
  
  const lowerId = serviceId.toLowerCase();
  
  // 共享资源
  if (lowerId.includes('accesskey') || lowerId.includes('ftp') || lowerId.includes('ssl') || lowerId.includes('shared')) {
    return 'shared';
  }
  
  // 根据ID前缀或包含的关键词判断
  if (lowerId.includes('nova')) return 'nova';
  if (lowerId.includes('orbit')) return 'orbit';
  if (lowerId.includes('hydra')) return 'hydra';
  
  // 默认归类到 Nova (主系统)
  return 'nova';
};

// 状态颜色映射
export const statusColors: Record<string, { fill: string; stroke: string }> = {
  up: { fill: '#d1fadf', stroke: '#12b76a' },
  warning: { fill: '#fef0c7', stroke: '#f79009' },
  down: { fill: '#fee4e2', stroke: '#f04438' },
  unknown: { fill: '#f2f4f7', stroke: '#98a2b3' }
};

// 服务类型图标映射
export const getServiceIcon = (name: string): string => {
  const lowerName = name.toLowerCase();
  
  // 前端/网关
  if (lowerName.includes('front') || lowerName.includes('web') || lowerName.includes('ui') || lowerName.includes('app')) return '🌐';
  if (lowerName.includes('gateway') || lowerName.includes('nginx')) return '🚪';
  
  // 用户/认证
  if (lowerName.includes('user') || lowerName.includes('auth')) return '👤';
  if (lowerName.includes('accesskey') || lowerName.includes('key')) return '🔑';
  
  // 业务服务
  if (lowerName.includes('order') || lowerName.includes('cart')) return '📦';
  if (lowerName.includes('payment') || lowerName.includes('pay')) return '💳';
  if (lowerName.includes('report')) return '📊';
  if (lowerName.includes('data')) return '📈';
  
  // 数据库
  if (lowerName.includes('mysql') || lowerName.includes('db') || lowerName.includes('database') || lowerName.includes('postgres')) return '🗄️';
  if (lowerName.includes('redis') || lowerName.includes('cache')) return '⚡';
  if (lowerName.includes('timescale')) return '📊';
  
  // 消息队列
  if (lowerName.includes('mq') || lowerName.includes('queue') || lowerName.includes('kafka') || lowerName.includes('rabbit')) return '📨';
  
  // 通知
  if (lowerName.includes('mail') || lowerName.includes('email') || lowerName.includes('notification')) return '📧';
  
  // 任务
  if (lowerName.includes('task') || lowerName.includes('job') || lowerName.includes('scheduler')) return '⏰';
  
  // 存储
  if (lowerName.includes('ftp') || lowerName.includes('storage') || lowerName.includes('file')) return '📁';
  
  // 安全
  if (lowerName.includes('ssl') || lowerName.includes('cert') || lowerName.includes('security')) return '🔐';
  
  // 配置
  if (lowerName.includes('plan') || lowerName.includes('config')) return '📋';
  
  return '🔧';
};

// 格式化响应时间
export const formatResponseTime = (time?: number): string => {
  if (!time) return 'N/A';
  if (time < 1000) return `${time}ms`;
  return `${(time / 1000).toFixed(2)}s`;
};

// 判断是否慢响应
export const isSlowResponse = (time?: number, threshold = 500): boolean => {
  return time !== undefined && time > threshold;
};

// 格式化上次检查时间
export const formatLastCheck = (lastCheck?: string): string => {
  if (!lastCheck) return 'N/A';
  const date = new Date(lastCheck);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diff < 60) return `${diff} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return date.toLocaleString();
};

// 获取状态类型（用于 Element Plus Tag）
export const getStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    up: 'success',
    warning: 'warning',
    down: 'danger',
    unknown: 'info'
  };
  return map[status] || 'info';
};

// 获取风险类型（用于 Element Plus Tag）
export const getRiskType = (risk: string): 'success' | 'warning' | 'danger' => {
  const map: Record<string, 'success' | 'warning' | 'danger'> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger'
  };
  return map[risk] || 'warning';
};

// G6 图表配置生成器
export interface ServiceNode {
  id: string;
  name: string;
  host?: string;
  port?: number;
  status: 'up' | 'down' | 'warning' | 'unknown';
  responseTime?: number;
  riskLevel?: string;
  dependencies?: string[];
  errorMessage?: string;
  lastCheck?: string;
  layer?: ServiceLayer;
  projectId?: string;
  projectName?: string;
}

// 生成 G6 节点样式配置
export const createNodeStyleConfig = () => ({
  type: 'rect',
  style: {
    size: [220, 60],
    radius: 8,
    fill: (d: any) => {
      const status = d.data?.status || 'unknown';
      if (status === 'down') return '#fef3f2';
      return '#ffffff';
    },
    stroke: (d: any) => {
      const name = d.data?.name || d.id;
      const layer = getServiceLayer(name);
      return layerColors[layer];
    },
    lineWidth: (d: any) => {
      const status = d.data?.status || 'unknown';
      return status === 'down' ? 3 : 2;
    },
    labelText: (d: any) => {
      const name = d.data?.name || d.id;
      const icon = getServiceIcon(name);
      const responseTime = d.data?.responseTime;
      const port = d.data?.port;
      const rtText = responseTime ? `${responseTime}ms avg` : '';
      return `${icon}  ${name}\n:${port || ''}  ${rtText}`;
    },
    labelFill: '#101828',
    labelFontSize: 12,
    labelFontWeight: 500,
    labelPlacement: 'center',
    cursor: 'pointer',
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowBlur: 8,
    shadowOffsetY: 2,
  },
});

// 生成 G6 边样式配置
export const createEdgeStyleConfig = (allServices: ServiceNode[]) => ({
  style: {
    stroke: (d: any) => {
      const targetNode = allServices.find(s => s.id === d.target);
      const sourceNode = allServices.find(s => s.id === d.source);
      const status = targetNode?.status || 'unknown';
      if (status === 'down') return '#f04438';
      if (status === 'warning') return '#f79009';
      if (sourceNode?.status === 'down') return '#98a2b3';
      return statusColors[status]?.stroke || '#12b76a';
    },
    lineWidth: 2,
    lineDash: (d: any) => {
      const targetNode = allServices.find(s => s.id === d.target);
      if (targetNode?.status === 'down') return [6, 4];
      if (targetNode?.status === 'warning') return [4, 2];
      return undefined;
    },
    endArrow: {
      fill: '#667085',
      path: 'M 0,0 L 8,4 L 8,-4 Z',
    },
  },
});

// 生成分层布局配置
export const createLayeredLayoutConfig = () => ({
  type: 'dagre',
  rankdir: 'TB',
  nodesep: 80,
  ranksep: 150,
  nodeOrder: (node: any) => {
    const name = node.data?.name || node.id;
    const layer = getServiceLayer(name);
    return layerOrder.indexOf(layer);
  }
});
