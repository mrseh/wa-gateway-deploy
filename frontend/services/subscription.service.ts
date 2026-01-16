/**
 * Subscription Service
 * Handles subscription and payment API calls
 */

import { apiClient } from '@/lib/api-client';
import { Package, Subscription, Transaction } from '@/types';

interface SubscribeRequest {
  package_id: string;
  duration_months?: number;
  discount_code?: string;
}

interface SubscribeResponse {
  transaction_id: string;
  invoice_number: string;
  amount: number;
  snap_token: string;
  redirect_url: string;
}

interface QuotaData {
  quota: {
    max_instances: number;
    max_messages_per_day: number;
    max_messages_per_month: number;
    max_olts: number;
    has_api_access: boolean;
    has_webhook: boolean;
    has_bulk_messaging: boolean;
    has_analytics: boolean;
    has_olt_monitoring: boolean;
  };
  usage: {
    instances: number;
    messages_today: number;
    messages_this_month: number;
    olts: number;
  };
  remaining: {
    instances: number;
    messages_today: number;
    messages_this_month: number;
    olts: number;
  };
  percentage: {
    instances: number;
    messages_today: number;
    messages_this_month: number;
  };
}

interface CalculatePriceRequest {
  duration_months?: number;
  discount_code?: string;
}

interface CalculatePriceResponse {
  package_id: string;
  package_name: string;
  duration_months: number;
  base_price: number;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
  formatted_price: string;
}

class SubscriptionService {
  /**
   * Get all packages
   */
  async getPackages() {
    return apiClient.get<Package[]>('/packages');
  }

  /**
   * Get single package
   */
  async getPackage(packageId: string) {
    return apiClient.get<Package>(`/packages/${packageId}`);
  }

  /**
   * Calculate package price with discount
   */
  async calculatePrice(packageId: string, data: CalculatePriceRequest) {
    return apiClient.post<CalculatePriceResponse>(
      `/packages/${packageId}/calculate-price`,
      data
    );
  }

  /**
   * Subscribe to a package
   */
  async subscribe(data: SubscribeRequest) {
    return apiClient.post<SubscribeResponse>('/subscriptions/subscribe', data);
  }

  /**
   * Get current user subscription
   */
  async getMySubscription() {
    return apiClient.get<Subscription | null>('/subscriptions/my-subscription');
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    return apiClient.get<Subscription>(`/subscriptions/${subscriptionId}`);
  }

  /**
   * Renew subscription
   */
  async renewSubscription(subscriptionId: string, durationMonths?: number) {
    return apiClient.post<SubscribeResponse>(
      `/subscriptions/${subscriptionId}/renew`,
      { duration_months: durationMonths }
    );
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, reason?: string) {
    return apiClient.post(`/subscriptions/${subscriptionId}/cancel`, {
      reason,
    });
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(subscriptionId: string, packageId: string) {
    return apiClient.post(`/subscriptions/${subscriptionId}/upgrade`, {
      package_id: packageId,
    });
  }

  /**
   * Get quota usage
   */
  async getQuota() {
    return apiClient.get<QuotaData>('/subscriptions/quota');
  }

  /**
   * Get user invoices
   */
  async getInvoices(limit = 10, offset = 0) {
    return apiClient.get<{
      transactions: Transaction[];
      pagination: {
        total: number;
        limit: number;
        offset: number;
        has_more: boolean;
      };
    }>('/subscriptions/invoices', {
      params: { limit, offset },
    });
  }

  /**
   * Get subscription history
   */
  async getHistory() {
    return apiClient.get<Subscription[]>('/subscriptions/history');
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods() {
    return apiClient.get('/payments/methods');
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string) {
    return apiClient.get<Transaction>(`/payments/${transactionId}/status`);
  }

  /**
   * Cancel payment
   */
  async cancelPayment(transactionId: string) {
    return apiClient.post(`/payments/${transactionId}/cancel`);
  }

  /**
   * Retry failed payment
   */
  async retryPayment(transactionId: string) {
    return apiClient.post<SubscribeResponse>(
      `/payments/${transactionId}/retry`
    );
  }

  /**
   * Get transaction by invoice
   */
  async getByInvoice(invoiceNumber: string) {
    return apiClient.get<Transaction>(`/payments/invoice/${invoiceNumber}`);
  }
}

export const subscriptionService = new SubscriptionService();
