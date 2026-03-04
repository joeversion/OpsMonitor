import axios from 'axios';
import authUtils from '../utils/auth';
import router from '../router';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // Increased from 10s to 30s for slow queries
});

// Request interceptor - add Authorization header
api.interceptors.request.use(
  (config) => {
    const token = authUtils.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      authUtils.clearAuth();
      router.push({ name: 'login' });
    }
    return Promise.reject(error);
  }
);

export default api;
