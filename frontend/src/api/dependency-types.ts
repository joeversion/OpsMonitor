import api from './index';

export interface DependencyType {
  id: string;
  name: string;
  label: string;
  icon: string;
  description?: string;
  color: string;
  line_style: 'solid' | 'dashed' | 'dotted' | 'long-dash';
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDependencyTypeDto {
  name: string;
  label: string;
  icon?: string;
  description?: string;
  color?: string;
  line_style?: 'solid' | 'dashed' | 'dotted' | 'long-dash';
}

export interface UpdateDependencyTypeDto {
  name?: string;
  label?: string;
  icon?: string;
  description?: string;
  color?: string;
  line_style?: 'solid' | 'dashed' | 'dotted' | 'long-dash';
  sort_order?: number;
}

// 获取所有依赖类型
export async function getDependencyTypes(): Promise<DependencyType[]> {
  const res = await api.get('/dependency-types');
  return res.data;
}

// 获取单个依赖类型
export async function getDependencyType(id: string): Promise<DependencyType> {
  const res = await api.get(`/dependency-types/${id}`);
  return res.data;
}

// 创建自定义依赖类型
export async function createDependencyType(data: CreateDependencyTypeDto): Promise<DependencyType> {
  const res = await api.post('/dependency-types', data);
  return res.data;
}

// 更新依赖类型
export async function updateDependencyType(id: string, data: UpdateDependencyTypeDto): Promise<DependencyType> {
  const res = await api.put(`/dependency-types/${id}`, data);
  return res.data;
}

// 删除自定义依赖类型
export async function deleteDependencyType(id: string): Promise<void> {
  await api.delete(`/dependency-types/${id}`);
}
