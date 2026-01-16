/**
 * Authentication Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },
      
      login: async (email, password) => {
        set({ isLoading: true });
        
        try {
          const response = await authService.login({ email, password });
          
          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
            });
          }
        } catch (error) {
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      
      logout: async () => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
      
      refreshUser: async () => {
        try {
          const response = await authService.getProfile();
          
          if (response.success && response.data) {
            set({ user: response.data.user });
          }
        } catch (error) {
          // If refresh fails, logout
          get().logout();
        }
      },
      
      updateUser: async (data) => {
        set({ isLoading: true });
        
        try {
          const response = await authService.updateProfile(data);
          
          if (response.success && response.data) {
            set({ user: response.data.user });
          }
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
