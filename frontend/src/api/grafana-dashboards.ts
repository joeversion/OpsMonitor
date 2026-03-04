import api from './index';

export interface EmbedOptions {
  theme?: 'dark' | 'light';
  from?: string;
  to?: string;
  refresh?: string;
  kiosk?: boolean;
  vars?: Record<string, string>;
}

export interface GrafanaDashboard {
  id: string;
  name: string;
  description?: string;
  project_id?: string;
  project_ids?: string[];
  service_id?: string;
  project_name?: string;
  project_names?: string[];
  service_name?: string;
  grafana_url: string;
  dashboard_uid: string;
  panel_id?: number;
  embed_options: EmbedOptions;
  embed_url: string;
  display_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGrafanaDashboardDto {
  name: string;
  description?: string;
  project_id?: string;
  project_ids?: string[];
  service_id?: string;
  grafana_url: string;
  dashboard_uid: string;
  panel_id?: number;
  embed_options?: EmbedOptions;
  display_order?: number;
  enabled?: boolean;
}

export interface UpdateGrafanaDashboardDto extends Partial<CreateGrafanaDashboardDto> {}

// Get all dashboards
export const getGrafanaDashboards = async (): Promise<GrafanaDashboard[]> => {
  const response = await api.get<GrafanaDashboard[]>('/grafana-dashboards');
  return response.data;
};

// Get single dashboard
export const getGrafanaDashboard = async (id: string): Promise<GrafanaDashboard> => {
  const response = await api.get<GrafanaDashboard>(`/grafana-dashboards/${id}`);
  return response.data;
};

// Get dashboards by project
export const getGrafanaDashboardsByProject = async (projectId: string): Promise<GrafanaDashboard[]> => {
  const response = await api.get<GrafanaDashboard[]>(`/grafana-dashboards/by-project/${projectId}`);
  return response.data;
};

// Get dashboards by service
export const getGrafanaDashboardsByService = async (serviceId: string): Promise<GrafanaDashboard[]> => {
  const response = await api.get<GrafanaDashboard[]>(`/grafana-dashboards/by-service/${serviceId}`);
  return response.data;
};

// Create dashboard
export const createGrafanaDashboard = async (data: CreateGrafanaDashboardDto): Promise<{ id: string }> => {
  const response = await api.post<{ id: string }>('/grafana-dashboards', data);
  return response.data;
};

// Update dashboard
export const updateGrafanaDashboard = async (id: string, data: UpdateGrafanaDashboardDto): Promise<void> => {
  await api.put(`/grafana-dashboards/${id}`, data);
};

// Delete dashboard
export const deleteGrafanaDashboard = async (id: string): Promise<void> => {
  await api.delete(`/grafana-dashboards/${id}`);
};

// Toggle enabled status
export const toggleGrafanaDashboard = async (id: string): Promise<{ enabled: boolean }> => {
  const response = await api.patch<{ enabled: boolean }>(`/grafana-dashboards/${id}/toggle`);
  return response.data;
};

// Reorder dashboards
export const reorderGrafanaDashboards = async (orders: { id: string; display_order: number }[]): Promise<void> => {
  await api.post('/grafana-dashboards/reorder', { orders });
};

// Test Grafana connection and get available dashboards
export interface GrafanaRemoteDashboard {
  uid: string;
  title: string;
  url: string;
  type: string;
  tags: string[];
  folderTitle: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  dashboards?: GrafanaRemoteDashboard[];
}

export const testGrafanaConnection = async (grafana_url: string, api_key?: string): Promise<TestConnectionResult> => {
  const response = await api.post<TestConnectionResult>('/grafana-dashboards/test-connection', { grafana_url, api_key });
  return response.data;
};

// Fetch dashboard details including panels
export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
}

export interface FetchDashboardResult {
  success: boolean;
  error?: string;
  dashboard?: {
    uid: string;
    title: string;
    description?: string;
    tags: string[];
  };
  panels?: GrafanaPanel[];
}

export const fetchGrafanaDashboard = async (
  grafana_url: string, 
  dashboard_uid: string, 
  api_key?: string
): Promise<FetchDashboardResult> => {
  const response = await api.post<FetchDashboardResult>('/grafana-dashboards/fetch-dashboard', { 
    grafana_url, 
    dashboard_uid, 
    api_key 
  });
  return response.data;
};
