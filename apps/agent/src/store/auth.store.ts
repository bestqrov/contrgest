import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout } from '../services/api.service';

interface AuthState {
  isAuthenticated: boolean;
  employee: { id: string; role: string; firstName: string; lastName: string } | null;
  isLoading: boolean;
  error: string | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  employee: null,
  isLoading: false,
  error: null,

  login: async (phone, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiLogin(phone, password);
      if (data.success) {
        await AsyncStorage.setItem('@employee', JSON.stringify(data.data.employee));
        set({ isAuthenticated: true, employee: data.data.employee, isLoading: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentification échouée';
      set({ error: msg, isLoading: false });
    }
  },

  logout: async () => {
    await apiLogout();
    await AsyncStorage.removeItem('@employee');
    set({ isAuthenticated: false, employee: null });
  },

  hydrate: async () => {
    const token = await AsyncStorage.getItem('@access_token');
    const empStr = await AsyncStorage.getItem('@employee');
    if (token && empStr) {
      set({ isAuthenticated: true, employee: JSON.parse(empStr) });
    }
  },
}));
