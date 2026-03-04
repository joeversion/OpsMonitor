import api from './index';

export interface Project {
  id: string;
  name: string;
  description?: string;
  icon_color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  service_count: number;
  healthy_count: number;
  warning_count: number;
  down_count: number;
}

export interface ProjectGraphData {
  nodes: {
    id: string;
    name: string;
    status: 'up' | 'down' | 'warning' | 'unknown';
    responseTime?: number;
    host: string;
    port: number;
    riskLevel: string;
  }[];
  edges: {
    source: string;
    target: string;
    status: 'up' | 'down' | 'warning' | 'unknown';
  }[];
}

export async function getProjects(): Promise<ProjectWithStats[]> {
  const res = await api.get('/projects');
  return res.data;
}

export async function getProject(id: string): Promise<Project> {
  const res = await api.get(`/projects/${id}`);
  return res.data;
}

export async function createProject(data: Partial<Project>): Promise<Project> {
  const res = await api.post('/projects', data);
  return res.data;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const res = await api.put(`/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function getProjectGraph(id: string): Promise<ProjectGraphData> {
  const res = await api.get(`/projects/${id}/graph`);
  return res.data;
}
