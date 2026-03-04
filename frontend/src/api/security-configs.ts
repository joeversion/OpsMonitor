import api from './index';

export interface SecurityConfig {
  id: string;
  name: string;
  type: 'accesskey' | 'ftp' | 'ssl';
  affected_services: string[];
  validity_days?: number;
  last_reset_at?: string;
  expiry_date: string;
  reminder_days: number[];
  last_reminded_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  days_remaining: number;
  status: 'normal' | 'warning' | 'critical' | 'expired';
}

export interface SecurityConfigStats {
  total: number;
  normal: number;
  warning: number;
  critical: number;
  expired: number;
}

export interface CreateSecurityConfigDto {
  name: string;
  type: 'accesskey' | 'ftp' | 'ssl';
  affected_services?: string[];
  validity_days?: number;
  last_reset_at?: string;
  expiry_date?: string;
  reminder_days?: number[];
  notes?: string;
}

export interface UpdateSecurityConfigDto extends CreateSecurityConfigDto {}

export const getSecurityConfigs = async (): Promise<SecurityConfig[]> => {
  const response = await api.get<SecurityConfig[]>('/security-configs');
  return response.data;
};

export const getSecurityConfigStats = async (): Promise<SecurityConfigStats> => {
  const response = await api.get<SecurityConfigStats>('/security-configs/stats');
  return response.data;
};

export const getSecurityConfig = async (id: string): Promise<SecurityConfig> => {
  const response = await api.get<SecurityConfig>(`/security-configs/${id}`);
  return response.data;
};

export const createSecurityConfig = async (data: CreateSecurityConfigDto): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>('/security-configs', data);
  return response.data;
};

export const updateSecurityConfig = async (id: string, data: UpdateSecurityConfigDto): Promise<void> => {
  await api.put(`/security-configs/${id}`, data);
};

export const extendSecurityConfig = async (id: string, extend_days?: number): Promise<{ 
  message: string; 
  new_expiry_date: string; 
  days_remaining: number 
}> => {
  const response = await api.post(`/security-configs/${id}/extend`, { extend_days });
  return response.data;
};

export const deleteSecurityConfig = async (id: string): Promise<void> => {
  await api.delete(`/security-configs/${id}`);
};

export const getExpiringConfigs = async (): Promise<SecurityConfig[]> => {
  const response = await api.get<SecurityConfig[]>('/security-configs/check/expiring');
  return response.data;
};
