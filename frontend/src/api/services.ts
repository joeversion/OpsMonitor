import api from './index';
import type { Service, CreateServiceDto, UpdateServiceDto } from '../types/service';
export type { Service };

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
