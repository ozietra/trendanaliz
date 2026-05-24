import { create } from 'zustand';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  emailVerified: boolean;
}

interface AuthState {
  user: UserSession | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (user: UserSession, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trend_access_token', accessToken);
      localStorage.setItem('trend_refresh_token', refreshToken);
      localStorage.setItem('trend_user', JSON.stringify(user));
    }
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trend_access_token');
      localStorage.removeItem('trend_refresh_token');
      localStorage.removeItem('trend_user');
    }
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  setHydrated: () => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('trend_access_token');
      const refreshToken = localStorage.getItem('trend_refresh_token');
      const userStr = localStorage.getItem('trend_user');

      if (accessToken && refreshToken && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, accessToken, refreshToken, isAuthenticated: true, isHydrated: true });
          return;
        } catch (e) {
          localStorage.removeItem('trend_access_token');
          localStorage.removeItem('trend_refresh_token');
          localStorage.removeItem('trend_user');
        }
      }
    }
    set({ isHydrated: true });
  },
}));
