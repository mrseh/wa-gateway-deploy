/**
 * Message Service
 * Handles message sending and retrieval operations
 */

import { apiRequest } from '@/lib/api-client';
import {
  MessageLog,
  SendMessageData,
  SendMediaMessageData,
  SendGroupMessageData,
  MessageFilters,
  MessageStatistics,
  DailyMessageStats,
  TotalQuotaInfo,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

export const messageService = {
  /**
   * Get messages with filters
   */
  async getMessages(
    filters?: MessageFilters
  ): Promise<ApiResponse<PaginatedResponse<MessageLog>>> {
    return apiRequest('get', '/messages', undefined, { params: filters });
  },
  
  /**
   * Get single message
   */
  async getMessage(id: string): Promise<ApiResponse<{ message: MessageLog }>> {
    return apiRequest('get', `/messages/${id}`);
  },
  
  /**
   * Send text message
   */
  async sendMessage(data: SendMessageData): Promise<ApiResponse<{
    message_id: string;
    log_id: string;
    quota: any;
  }>> {
    return apiRequest('post', '/messages/send', data);
  },
  
  /**
   * Send media message
   */
  async sendMediaMessage(data: SendMediaMessageData): Promise<ApiResponse<{
    message_id: string;
    log_id: string;
  }>> {
    return apiRequest('post', '/messages/send-media', data);
  },
  
  /**
   * Send group message
   */
  async sendGroupMessage(data: SendGroupMessageData): Promise<ApiResponse<{
    message_id: string;
    log_id: string;
  }>> {
    return apiRequest('post', '/messages/send-group', data);
  },
  
  /**
   * Retry failed message
   */
  async retryMessage(id: string): Promise<ApiResponse<{
    message_id: string;
    retry_count: number;
  }>> {
    return apiRequest('post', `/messages/${id}/retry`);
  },
  
  /**
   * Delete message
   */
  async deleteMessage(id: string): Promise<ApiResponse> {
    return apiRequest('delete', `/messages/${id}`);
  },
  
  /**
   * Get message statistics
   */
  async getStatistics(params?: {
    start_date?: string;
    end_date?: string;
    days?: number;
  }): Promise<ApiResponse<{
    statistics: MessageStatistics;
    daily_stats: DailyMessageStats[];
    time_range: { start: string; end: string };
  }>> {
    return apiRequest('get', '/messages/statistics', undefined, { params });
  },
  
  /**
   * Get message quota
   */
  async getQuota(instanceId?: string): Promise<ApiResponse<TotalQuotaInfo>> {
    return apiRequest('get', '/messages/quota', undefined, {
      params: instanceId ? { instance_id: instanceId } : undefined,
    });
  },
};
