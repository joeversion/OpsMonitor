import api from './index';
import type { Service, CreateServiceDto, UpdateServiceDto } from '../types/service';
import type { CheckResult } from './checks';
import type { ServiceDependency } from './dependencies';
export type { Service };

export interface ServiceDetails {
  service: Omit<Service, 'check_type' | 'enabled' | 'alert_enabled'> & {
    check_type: string;
    enabled: boolean | number;
    alert_enabled: boolean | number;
    project_name?: string;
    host_name?: string;
    host_connection_type?: string;
    host_enabled?: number | null;
    current_failure_count?: number;
  };
  configuration: Record<string, Record<string, unknown>>;
  latest: CheckResult | null;
  history: CheckResult[];
  dependencies: {
    dependsOn: (ServiceDependency & { resource_expiry_date?: string; resource_check_error?: string })[];
    dependedBy: ServiceDependency[];
  };
  output_available: boolean;
  fetched_at: string;
}

export const getServiceDetails = async (id: string, signal?: AbortSignal): Promise<ServiceDetails> => {
  const response = await api.get<ServiceDetails>(`/services/${encodeURIComponent(id)}/details`, { signal });
  return response.data;
};

export const getServices = async (projectId?: number | null, hostId?: string | null): Promise<Service[]> => {
  const params: any = {};
  if (projectId) params.project_id = projectId;
  if (hostId) params.host_id = hostId;
  const response = await api.get<Service[]>('/services', { params });
  return response.data;
};

// Get all services across all projects (for dependency selection)
export const getAllServices = async (): Promise<Service[]> => {
  const response = await api.get<Service[]>('/services');
  return response.data;
};

export const getService = async (id: string): Promise<Service> => {
  const response = await api.get<Service>(`/services/${id}`);
  return response.data;
};

export const createService = async (data: CreateServiceDto): Promise<Service> => {
  const response = await api.post<Service>('/services', data);
  return response.data;
};

export const updateService = async (id: string, data: UpdateServiceDto): Promise<Service> => {
  const response = await api.put<Service>(`/services/${id}`, data);
  return response.data;
};

export const deleteService = async (id: string): Promise<void> => {
  await api.delete(`/services/${id}`);
};
