import apiClient from './index';
import type { Host, CreateHostDto, UpdateHostDto, HostTestResult } from '../types/host';

// Deprecated interface for backward compatibility
export interface LegacyHost {
  id: string | number;
  name: string;
  ip: string;
  project: string;
  projectId?: number | string;
  status: 'healthy' | 'warning' | 'error';
  serviceCount: number;
}

export const hostsApi = {
  // 获取所有主机
  getAll: async (projectId?: string): Promise<Host[]> => {
    const params = projectId ? { project_id: projectId } : {};
    const response = await apiClient.get('/hosts', { params });
    return response.data;
  },

  // 获取单个主机详情
  get: async (id: string): Promise<Host> => {
    const response = await apiClient.get(`/hosts/${id}`);
    return response.data;
  },

  // 创建主机
  create: async (data: CreateHostDto): Promise<Host> => {
    const response = await apiClient.post('/hosts', data);
    return response.data;
  },

  // 更新主机
  update: async (id: string, data: UpdateHostDto): Promise<Host> => {
    const response = await apiClient.put(`/hosts/${id}`, data);
    return response.data;
  },

  // 删除主机
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/hosts/${id}`);
  },

  // 测试主机连接
  testConnection: async (id: string): Promise<HostTestResult> => {
    const response = await apiClient.post(`/hosts/${id}/test`);
    return response.data;
  }
};

// 导出便捷函数以兼容不同导入方式
export const getHosts = hostsApi.getAll;

export default hostsApi;
