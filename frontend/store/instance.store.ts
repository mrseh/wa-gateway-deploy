/**
 * Instance Store
 * Manages WhatsApp instances state
 */

import { create } from 'zustand';
import { Instance } from '@/types';
import { instanceService } from '@/services/instance.service';

interface InstanceState {
  instances: Instance[];
  currentInstance: Instance | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchInstances: () => Promise<void>;
  fetchInstance: (id: string) => Promise<void>;
  createInstance: (name: string, settings?: any) => Promise<Instance>;
  updateInstance: (id: string, data: any) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  connectInstance: (id: string) => Promise<{ qr_code?: string }>;
  disconnectInstance: (id: string) => Promise<void>;
  restartInstance: (id: string) => Promise<void>;
  setCurrentInstance: (instance: Instance | null) => void;
  updateInstanceStatus: (id: string, status: string, connectionState?: string) => void;
  clearError: () => void;
}

export const useInstanceStore = create<InstanceState>((set, get) => ({
  instances: [],
  currentInstance: null,
  isLoading: false,
  error: null,
  
  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await instanceService.getInstances();
      
      if (response.success && response.data) {
        set({ instances: response.data.instances });
      }
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to fetch instances' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await instanceService.getInstance(id);
      
      if (response.success && response.data) {
        set({ currentInstance: response.data.instance });
        
        // Update in instances list
        const instances = get().instances;
        const index = instances.findIndex(i => i.id === id);
        
        if (index !== -1) {
          const newInstances = [...instances];
          newInstances[index] = response.data.instance;
          set({ instances: newInstances });
        }
      }
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to fetch instance' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  createInstance: async (name, settings) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await instanceService.createInstance({ name, settings });
      
      if (response.success && response.data) {
        const newInstance = response.data.instance;
        set({ instances: [...get().instances, newInstance] });
        return newInstance;
      }
      
      throw new Error('Failed to create instance');
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to create instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  updateInstance: async (id, data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await instanceService.updateInstance(id, data);
      
      if (response.success && response.data) {
        const updatedInstance = response.data.instance;
        
        // Update in instances list
        set({
          instances: get().instances.map(i =>
            i.id === id ? updatedInstance : i
          ),
        });
        
        // Update current instance if it's the same
        if (get().currentInstance?.id === id) {
          set({ currentInstance: updatedInstance });
        }
      }
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to update instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  deleteInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      await instanceService.deleteInstance(id);
      
      // Remove from instances list
      set({
        instances: get().instances.filter(i => i.id !== id),
      });
      
      // Clear current instance if it's the same
      if (get().currentInstance?.id === id) {
        set({ currentInstance: null });
      }
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to delete instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  connectInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await instanceService.connectInstance(id);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error('Failed to connect instance');
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to connect instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  disconnectInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      await instanceService.disconnectInstance(id);
      
      // Update status
      get().updateInstanceStatus(id, 'disconnected');
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to disconnect instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  restartInstance: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      await instanceService.restartInstance(id);
      
      // Update status
      get().updateInstanceStatus(id, 'creating');
    } catch (error: any) {
      set({ error: error.error?.message || 'Failed to restart instance' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  setCurrentInstance: (instance) => {
    set({ currentInstance: instance });
  },
  
  updateInstanceStatus: (id, status, connectionState) => {
    set({
      instances: get().instances.map(i =>
        i.id === id
          ? { ...i, status: status as any, connection_state: connectionState }
          : i
      ),
    });
    
    // Update current instance if it's the same
    if (get().currentInstance?.id === id) {
      set({
        currentInstance: {
          ...get().currentInstance!,
          status: status as any,
          connection_state: connectionState,
        },
      });
    }
  },
  
  clearError: () => {
    set({ error: null });
  },
}));
