import apiClient from './index';

export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'viewer';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  role: 'admin' | 'viewer';
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: 'admin' | 'viewer';
  status?: 'active' | 'inactive';
}

export interface UpdatePasswordRequest {
  password: string;
}

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get('/users');
    return response.data;
  },

  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  update: async (id: number, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  updatePassword: async (id: number, data: UpdatePasswordRequest): Promise<void> => {
    await apiClient.put(`/users/${id}/password`, data);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};

export default usersApi;
