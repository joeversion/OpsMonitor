const TOKEN_KEY = 'opsmonitor_token';
const USER_KEY = 'opsmonitor_user';

export interface StoredUser {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'viewer';
}

export const authUtils = {
  // Token management
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  // User management
  getUser(): StoredUser | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: StoredUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  // Auth state
  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  },

  // Clear all auth data
  clearAuth(): void {
    this.removeToken();
    this.removeUser();
  },

  // Save auth data
  saveAuth(token: string, user: StoredUser): void {
    this.setToken(token);
    this.setUser(user);
  },
};

export default authUtils;
