import api from './index';

export interface ServiceDependency {
  id: string;
  source_service_id: string;
  target_service_id?: string;
  target_resource_id?: string;
  dependency_type: 'depends' | 'uses' | 'sync' | 'backup';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  link_direction?: 'normal' | 'reverse';  // 连线方向
  description?: string;
  impact_description?: string;
  custom_alert_template?: string;
  created_at: string;
  // Joined fields
  source_service_name?: string;
  source_project_id?: string;
  source_project_name?: string;
  target_service_name?: string;
  target_project_id?: string;
  target_project_name?: string;
  target_resource_name?: string;
  target_resource_type?: string;
}

export interface CrossProjectGraphData {
  nodes: {
    id: string;
    data: {
      nodeType: 'project' | 'resource';
      name: string;
      serviceCount?: number;
      iconColor?: string;
      resourceType?: string;
      dependentCount?: number;
    };
  }[];
  edges: {
    source: string;
    target: string;
    data: {
      count: number;
      types: string[];
      riskLevels: string[];
      maxRisk: string;
    };
  }[];
}

// 获取所有依赖关系
export async function getDependencies(): Promise<ServiceDependency[]> {
  const res = await api.get('/dependencies');
  return res.data;
}

// 获取跨项目依赖
export async function getCrossProjectDependencies(): Promise<ServiceDependency[]> {
  const res = await api.get('/dependencies/cross-project');
  return res.data;
}

// 获取某个服务的依赖关系
export async function getServiceDependencies(serviceId: string): Promise<{
  dependsOn: ServiceDependency[];
  dependedBy: ServiceDependency[];
}> {
  const res = await api.get(`/dependencies/service/${serviceId}`);
  return res.data;
}

// 获取某个项目的外部依赖
export async function getProjectExternalDependencies(projectId: string): Promise<{
  externalDependencies: ServiceDependency[];
  externalDependents: ServiceDependency[];
}> {
  const res = await api.get(`/dependencies/project/${projectId}/external`);
  return res.data;
}

// 获取跨项目依赖图数据
export async function getCrossProjectGraph(): Promise<CrossProjectGraphData> {
  const res = await api.get('/dependencies/graph/cross-project');
  return res.data;
}

// 创建依赖关系
export async function createDependency(data: {
  source_service_id: string;
  target_service_id?: string;
  target_resource_id?: string;
  dependency_type: string;
  risk_level?: string;
  link_direction?: string;  // 连线方向
  description?: string;
  impact_description?: string;
  custom_alert_template?: string;
}): Promise<ServiceDependency> {
  const res = await api.post('/dependencies', data);
  return res.data;
}

// 更新依赖关系
export async function updateDependency(id: string, data: {
  dependency_type?: string;
  risk_level?: string;
  link_direction?: string;  // 连线方向
  description?: string;
  impact_description?: string;
  custom_alert_template?: string;
}): Promise<ServiceDependency> {
  const res = await api.put(`/dependencies/${id}`, data);
  return res.data;
}

// 删除依赖关系
export async function deleteDependency(id: string): Promise<void> {
  await api.delete(`/dependencies/${id}`);
}

// 迁移旧依赖关系
export async function migrateDependencies(): Promise<{ migrated: number; skipped: number }> {
  const res = await api.post('/dependencies/migrate');
  return res.data;
}
