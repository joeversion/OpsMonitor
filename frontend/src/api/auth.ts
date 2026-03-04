import apiClient from './index';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: 'admin' | 'viewer';
  };
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: 'admin' | 'viewer';
  };
}

export interface CurrentUser {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'viewer';
  last_login_at: string | null;
}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<CurrentUser> => {
    const response = await apiClient.put('/auth/profile', data);
    return response.data;
  },

  updatePassword: async (data: UpdatePasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.put('/auth/password', data);
    return response.data;
  },
};

export default authApi;
