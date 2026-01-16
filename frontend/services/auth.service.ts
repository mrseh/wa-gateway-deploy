/**
 * Authentication Service
 * Handles user authentication and session management
 */

import { apiRequest } from '@/lib/api-client';
import {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  ApiResponse,
} from '@/types';

export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await apiRequest<{ user: User; tokens: AuthTokens }>(
      'post',
      '/auth/login',
      credentials
    );
    
    // Save tokens to localStorage
    if (response.success && response.data) {
      localStorage.setItem('access_token', response.data.tokens.access_token);
      localStorage.setItem('refresh_token', response.data.tokens.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response;
  },
  
  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<ApiResponse<{ user: User }>> {
    return apiRequest<{ user: User }>('post', '/auth/register', data);
  },
  
  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse> {
    try {
      await apiRequest('post', '/auth/logout');
    } catch (error) {
      // Continue with local logout even if API fails
      console.error('Logout API error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    
    return { success: true };
  },
  
  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return apiRequest<{ user: User }>('get', '/auth/me');
  },
  
  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    const response = await apiRequest<{ user: User }>('put', '/auth/profile', data);
    
    // Update user in localStorage
    if (response.success && response.data) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response;
  },
  
  /**
   * Change password
   */
  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse> {
    return apiRequest('post', '/auth/change-password', data);
  },
  
  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<ApiResponse> {
    return apiRequest('post', '/auth/forgot-password', { email });
  },
  
  /**
   * Reset password with token
   */
  async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<ApiResponse> {
    return apiRequest('post', '/auth/reset-password', data);
  },
  
  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<ApiResponse> {
    return apiRequest('post', '/auth/verify-email', { token });
  },
  
  /**
   * Resend verification email
   */
  async resendVerification(): Promise<ApiResponse> {
    return apiRequest('post', '/auth/resend-verification');
  },
  
  /**
   * Refresh access token
   */
  async refreshToken(): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await apiRequest<{ tokens: AuthTokens }>(
      'post',
      '/auth/refresh-token',
      { refresh_token: refreshToken }
    );
    
    // Save new tokens
    if (response.success && response.data) {
      localStorage.setItem('access_token', response.data.tokens.access_token);
      localStorage.setItem('refresh_token', response.data.tokens.refresh_token);
    }
    
    return response;
  },
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('access_token');
  },
  
  /**
   * Get stored user
   */
  getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      return null;
    }
  },
  
  /**
   * Get access token
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },
};
