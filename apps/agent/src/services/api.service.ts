import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const API_BASE = process.env.REACT_NATIVE_API_URL ?? 'https://api.yourcompany.ma';

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30_000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const refresh = await AsyncStorage.getItem('@refresh_token');
      if (!refresh) throw err;

      try {
        const resp = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken: refresh });
        const { accessToken } = resp.data.data;
        await AsyncStorage.setItem('@access_token', accessToken);
        err.config.headers.Authorization = `Bearer ${accessToken}`;
        return api(err.config);
      } catch {
        await AsyncStorage.multiRemove(['@access_token', '@refresh_token']);
        throw err;
      }
    }
    return Promise.reject(err);
  },
);

export async function login(phone: string, password: string) {
  const { data } = await api.post('/auth/login', { phone, password });
  if (data.success) {
    await AsyncStorage.setItem('@access_token', data.data.accessToken);
    await AsyncStorage.setItem('@refresh_token', data.data.refreshToken);
  }
  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove(['@access_token', '@refresh_token']);
}
