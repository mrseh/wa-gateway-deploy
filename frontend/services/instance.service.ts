/**
 * Instance Service
 * Handles WhatsApp instance operations
 */

import { apiRequest } from '@/lib/api-client';
import {
  Instance,
  CreateInstanceData,
  UpdateInstanceData,
  WhatsAppGroup,
  ApiResponse,
} from '@/types';

export const instanceService = {
  /**
   * Get all instances
   */
  async getInstances(params?: {
    status?: string;
    search?: string;
  }): Promise<ApiResponse<{ instances: Instance[]; total: number }>> {
    return apiRequest('get', '/instances', undefined, { params });
  },
  
  /**
   * Get single instance
   */
  async getInstance(id: string): Promise<ApiResponse<{
    instance: Instance;
    statistics: any;
  }>> {
    return apiRequest('get', `/instances/${id}`);
  },
  
  /**
   * Create new instance
   */
  async createInstance(data: CreateInstanceData): Promise<ApiResponse<{
    instance: Instance;
    qr_code?: string;
  }>> {
    return apiRequest('post', '/instances', data);
  },
  
  /**
   * Update instance
   */
  async updateInstance(
    id: string,
    data: UpdateInstanceData
  ): Promise<ApiResponse<{ instance: Instance }>> {
    return apiRequest('put', `/instances/${id}`, data);
  },
  
  /**
   * Delete instance
   */
  async deleteInstance(id: string): Promise<ApiResponse> {
    return apiRequest('delete', `/instances/${id}`);
  },
  
  /**
   * Connect instance (get QR code)
   */
  async connectInstance(id: string): Promise<ApiResponse<{
    qr_code?: string;
    pairing_code?: string;
    expires_at?: string;
  }>> {
    return apiRequest('post', `/instances/${id}/connect`);
  },
  
  /**
   * Disconnect instance
   */
  async disconnectInstance(id: string): Promise<ApiResponse> {
    return apiRequest('post', `/instances/${id}/disconnect`);
  },
  
  /**
   * Restart instance
   */
  async restartInstance(id: string): Promise<ApiResponse> {
    return apiRequest('post', `/instances/${id}/restart`);
  },
  
  /**
   * Get instance status
   */
  async getInstanceStatus(id: string): Promise<ApiResponse<{
    status: string;
    connection_state?: string;
    last_seen?: string;
    connected_at?: string;
  }>> {
    return apiRequest('get', `/instances/${id}/status`);
  },
  
  /**
   * Get instance profile
   */
  async getInstanceProfile(id: string): Promise<ApiResponse<{
    profile: {
      name?: string;
      picture?: string;
      status?: string;
      phone?: string;
    };
  }>> {
    return apiRequest('get', `/instances/${id}/profile`);
  },
  
  /**
   * Get instance groups
   */
  async getInstanceGroups(id: string): Promise<ApiResponse<{
    groups: WhatsAppGroup[];
    total: number;
  }>> {
    return apiRequest('get', `/instances/${id}/groups`);
  },
  
  /**
   * Get instance logs
   */
  async getInstanceLogs(
    id: string,
    params?: {
      limit?: number;
      offset?: number;
      direction?: string;
      status?: string;
    }
  ): Promise<ApiResponse<any>> {
    return apiRequest('get', `/instances/${id}/logs`, undefined, { params });
  },
};
