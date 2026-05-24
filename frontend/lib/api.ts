import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// İstek öncesi JWT Access Token ekleme Interceptor'ı
api.interceptors.request.use(
  (config) => {
    // Zustand'dan veya doğrudan localStorage'dan güncel tokenı çek
    let token = useAuthStore.getState().accessToken;
    
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('trend_access_token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Hata durumunda 401 yetkisiz erişim ise otomatik Refresh Token tetikleme Interceptor'ı
let isRefreshing = false;
let failedRequestsQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedRequestsQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedRequestsQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Eğer hata 401 ise ve daha önce yenileme denenmemişse
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('trend_refresh_token') : null;
        
        if (!refreshToken) {
          throw new Error('Yenileme tokenı bulunamadı.');
        }

        // Token yenileme endpointine doğrudan istek atıyoruz (döngü engellemek için doğrudan axios)
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;

        // Zustand ve localStorage güncelle
        const userStr = localStorage.getItem('trend_user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (user) {
          useAuthStore.getState().setAuth(user, newAccessToken, newRefreshToken);
        }

        processQueue(null, newAccessToken);
        
        // Orijinal isteği yeni token ile tekrar dene
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Yenileme başarısız ise kullanıcıyı çıkış yaptır
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/giris';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
