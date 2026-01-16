/**
 * TypeScript Types and Interfaces
 * Complete type definitions for WhatsApp Gateway
 */

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  company_address?: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended';
  email_verified: boolean;
  timezone?: string;
  language?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  company_name?: string;
}

// ============================================================================
// INSTANCE TYPES
// ============================================================================

export type InstanceStatus = 
  | 'creating'
  | 'waiting_qr'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'suspended';

export interface Instance {
  id: string;
  user_id: string;
  name: string;
  instance_name: string;
  phone_number?: string;
  status: InstanceStatus;
  qr_code?: string;
  qr_code_expires_at?: string;
  webhook_url?: string;
  connected_at?: string;
  disconnected_at?: string;
  last_seen?: string;
  connection_state?: string;
  profile_name?: string;
  profile_picture?: string;
  profile_status?: string;
  settings: InstanceSettings;
  statistics: InstanceStatistics;
  quota: InstanceQuota;
  last_error?: string;
  last_error_at?: string;
  error_count: number;
  auto_reconnect: boolean;
  reconnect_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface InstanceSettings {
  auto_reply: boolean;
  read_messages: boolean;
  reject_calls: boolean;
  always_online: boolean;
  message_delay: number;
  [key: string]: any;
}

export interface InstanceStatistics {
  messages_sent: number;
  messages_received: number;
  messages_failed: number;
  last_message_at?: string;
  uptime_percentage: number;
  connection_drops: number;
}

export interface InstanceQuota {
  daily_messages: number;
  daily_limit: number;
  monthly_messages: number;
  last_reset?: string;
}

export interface CreateInstanceData {
  name: string;
  settings?: Partial<InstanceSettings>;
}

export interface UpdateInstanceData {
  name?: string;
  settings?: Partial<InstanceSettings>;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageType = 
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'template';

export type MessageStatus = 
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'deleted';

export type MessageDirection = 'inbound' | 'outbound';

export interface MessageLog {
  id: string;
  user_id: string;
  instance_id: string;
  message_id?: string;
  direction: MessageDirection;
  from_number?: string;
  to_number?: string;
  message_type: MessageType;
  message_content?: string;
  media_url?: string;
  media_mime_type?: string;
  media_size?: number;
  caption?: string;
  quoted_message_id?: string;
  is_group: boolean;
  group_id?: string;
  group_name?: string;
  status: MessageStatus;
  error_code?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  retry_count: number;
  is_bulk: boolean;
  bulk_id?: string;
  cost: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SendMessageData {
  instance_id: string;
  to: string;
  message: string;
  quoted_message_id?: string;
}

export interface SendMediaMessageData {
  instance_id: string;
  to: string;
  media_url: string;
  caption?: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
}

export interface SendGroupMessageData {
  instance_id: string;
  group_id: string;
  message: string;
}

export interface MessageFilters {
  instance_id?: string;
  direction?: MessageDirection;
  status?: MessageStatus;
  message_type?: MessageType;
  is_group?: boolean;
  search?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface MessageStatistics {
  total_messages: number;
  messages_sent: number;
  messages_received: number;
  delivered: number;
  read: number;
  failed: number;
  group_messages: number;
  active_instances: number;
  last_message_at?: string;
}

export interface DailyMessageStats {
  date: string;
  total: number;
  sent: number;
  received: number;
  failed: number;
}

// ============================================================================
// QUOTA TYPES
// ============================================================================

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

export interface InstanceQuotaInfo {
  instance_id: string;
  instance_name: string;
  quota: QuotaInfo;
}

export interface TotalQuotaInfo {
  total: QuotaInfo;
  instances: InstanceQuotaInfo[];
}

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  features: PackageFeatures;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PackageFeatures {
  max_instances: number;
  max_messages_per_day: number;
  max_messages_per_month: number;
  has_api_access: boolean;
  has_webhook: boolean;
  has_bulk_messaging: boolean;
  has_analytics: boolean;
  has_priority_support: boolean;
  [key: string]: any;
}

export interface Subscription {
  id: string;
  user_id: string;
  package_id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  start_date?: string;
  end_date?: string;
  auto_renew: boolean;
  grace_period_until?: string;
  created_at: string;
  updated_at: string;
  package?: Package;
}

// ============================================================================
// GROUP TYPES
// ============================================================================

export interface WhatsAppGroup {
  id: string;
  name: string;
  subject: string;
  description?: string;
  owner?: string;
  participants: GroupParticipant[];
  created_at?: string;
}

export interface GroupParticipant {
  id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  pages: number;
  data: T[];
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardStats {
  instances: {
    total: number;
    connected: number;
    disconnected: number;
  };
  messages: {
    today: number;
    this_week: number;
    this_month: number;
    success_rate: number;
  };
  quota: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'message' | 'instance' | 'connection';
  title: string;
  description: string;
  timestamp: string;
  icon?: string;
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: string;
}

export interface InstanceStatusUpdate {
  instance_id: string;
  status: InstanceStatus;
  connection_state?: string;
}

export interface NewMessageNotification {
  instance_id: string;
  message: Partial<MessageLog>;
}

export interface QRCodeUpdate {
  instance_id: string;
  qr_code: string;
  expires_at: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: FormError[];
  isSubmitting: boolean;
  isValid: boolean;
}

// ============================================================================
// CHART TYPES
// ============================================================================

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface MessageChartData {
  date: string;
  sent: number;
  received: number;
  failed: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncReturnType<T extends (...args: any) => Promise<any>> = 
  T extends (...args: any) => Promise<infer R> ? R : any;

// ============================================================================
// SUBSCRIPTION & PAYMENT TYPES
// ============================================================================

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  formatted_price: string;
  duration_days: number;
  features: {
    max_instances: number;
    max_messages_per_day: number;
    max_messages_per_month: number;
    max_olts: number;
    has_api_access: boolean;
    has_webhook: boolean;
    has_bulk_messaging: boolean;
    has_analytics: boolean;
    has_olt_monitoring: boolean;
    has_priority_support: boolean;
    has_custom_domain: boolean;
  };
  is_active: boolean;
  is_trial: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended';

export interface Subscription {
  id: string;
  user_id: string;
  package_id: string;
  status: SubscriptionStatus;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  grace_period_until: string | null;
  days_remaining: number;
  is_active: boolean;
  is_expired: boolean;
  is_in_grace_period: boolean;
  package: Package | null;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'expired';

export interface Transaction {
  id: string;
  user_id: string;
  package_id: string;
  invoice_number: string;
  amount: number;
  formatted_amount: string;
  currency: string;
  status: TransactionStatus;
  payment_method: string | null;
  payment_channel: string | null;
  midtrans_payment_url: string | null;
  midtrans_token: string | null;
  paid_at: string | null;
  expires_at: string | null;
  duration_months: number;
  discount_amount: number;
  discount_code: string | null;
  is_paid: boolean;
  is_pending: boolean;
  is_expired: boolean;
  package: Package | null;
  created_at: string;
  updated_at: string;
}
