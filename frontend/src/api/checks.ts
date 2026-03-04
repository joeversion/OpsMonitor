import api from './index';

export interface CheckResult {
  id: string;
  service_id: string;
  status: 'up' | 'down' | 'warning' | 'unknown';
  response_time: number;
  error_message?: string;
  output?: string;
  stdout?: string;
  stderr?: string;
  details?: any;
  checked_at: string;
}

export interface SystemStats {
  up: number;
  down: number;
  warning: number;
  unknown: number;
  total: number;
}

export const getLatestCheck = async (serviceId: string): Promise<CheckResult> => {
  const response = await api.get<CheckResult>(`/checks/${serviceId}/latest`);
  return response.data;
};

export const getCheckHistory = async (serviceId: string, limit = 50): Promise<CheckResult[]> => {
  const response = await api.get<CheckResult[]>(`/checks/${serviceId}/history`, { params: { limit } });
  return response.data;
};

export const runCheck = async (serviceId: string): Promise<CheckResult> => {
  const response = await api.post<CheckResult>(`/checks/${serviceId}/run`);
  return response.data;
};

export const getSystemStats = async (projectId?: number | null): Promise<SystemStats> => {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.get<SystemStats>('/checks/stats/summary', { params });
  return response.data;
};
