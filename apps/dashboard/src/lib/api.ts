import axios from 'axios';
import type { ApiResponse } from '@field-ops/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
  timeout: 30_000,
});

let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        if (!refresh) throw err;

        const resp = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken: refresh });
        const { accessToken: newToken } = resp.data.data;
        setAccessToken(newToken);
        err.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(err.config);
      } catch {
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  },
);

export async function fetchDashboard() {
  const { data } = await apiClient.get<ApiResponse>('/dashboard/overview');
  return data.data;
}

export async function fetchActivityFeed(limit = 20) {
  const { data } = await apiClient.get<ApiResponse>(`/dashboard/activity-feed?limit=${limit}`);
  return data.data;
}

export async function fetchEmployees(params?: Record<string, string>) {
  const { data } = await apiClient.get<ApiResponse>('/employees', { params });
  return data;
}

export async function fetchAlerts(params?: Record<string, string>) {
  const { data } = await apiClient.get<ApiResponse>('/alerts', { params });
  return data;
}

export async function fetchLiveGps() {
  const { data } = await apiClient.get<ApiResponse>('/gps/live');
  return data.data;
}

export async function fetchSalesSummary(days = 30) {
  const { data } = await apiClient.get<ApiResponse>(`/sales/summary?days=${days}`);
  return data.data;
}
