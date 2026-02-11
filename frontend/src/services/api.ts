/**
 * TinlyLink API Service
 * Complete API integration matching backend response structures exactly
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import type {
  AuthResponse,
  RefreshResponse,
  LoginCredentials,
  RegisterData,
  User,
  UserWithSubscription,
  Link,
  CreateLinkData,
  UpdateLinkData,
  BulkCreateLinksResponse,
  LinkStats,
  ImportLinksResponse,
  QRCode,
  CreateQRData,
  UpdateQRData,
  QRPreviewResponse,
  Campaign,
  CreateCampaignData,
  UpdateCampaignData,
  CampaignStats,
  CustomDomain,
  AnalyticsOverview,
  ClickChartData,
  GeographyStats,
  DeviceStats,
  ReferrerStats,
  ExportRequestData,
  ExportResponse,
  APIKey,
  CreateAPIKeyData,
  APIKeyResponse,
  BillingInfo,
  CheckoutResponse,
  PortalResponse,
  UsageStats,
  UpdateProfileData,
  ChangePasswordData,
  PaginatedResponse,
  SuccessResponse,
  MessageResponse,
  // Team types
  Team,
  TeamMember,
  TeamInvite,
  CreateTeamData,
  UpdateTeamData,
  InviteMemberData,
  UpdateMemberRoleData,
  MyTeamEntry,
  InviteDetails,
  AcceptInviteResponse,
  // Rules types
  Rule,
  CreateRuleData,
  UpdateRuleData,
  RuleGroup,
  CreateRuleGroupData,
  TestRuleData,
  TestRuleResult,
  RuleStats,
  // Serialization types
  SerialBatch,
  CreateSerialBatchData,
  SerialCode,
  SerialCodeStats,
  VerificationResult,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const getAccessToken = (): string | undefined => Cookies.get(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | undefined => Cookies.get(REFRESH_TOKEN_KEY);

export const setTokens = (accessToken: string, refreshToken: string): void => {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, { expires: 1, sameSite: 'strict' });
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 7, sameSite: 'strict' });
};

export const clearTokens = (): void => {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
};

// =============================================================================
// AUTH EVENT SYSTEM - allows API layer to notify AuthContext of auth failures
// =============================================================================

type AuthEventCallback = () => void;
const authEventListeners: AuthEventCallback[] = [];

export const onAuthLogout = (callback: AuthEventCallback): (() => void) => {
  authEventListeners.push(callback);
  return () => {
    const index = authEventListeners.indexOf(callback);
    if (index > -1) authEventListeners.splice(index, 1);
  };
};

const emitAuthLogout = (): void => {
  authEventListeners.forEach(cb => cb());
};

// Team context - stored in localStorage
const TEAM_SLUG_KEY = 'current_team_slug';

export const getCurrentTeamSlug = (): string | null => localStorage.getItem(TEAM_SLUG_KEY);
export const setCurrentTeamSlug = (slug: string): void => localStorage.setItem(TEAM_SLUG_KEY, slug);
export const clearCurrentTeamSlug = (): void => localStorage.removeItem(TEAM_SLUG_KEY);

// =============================================================================
// INTERCEPTORS
// =============================================================================

// Request interceptor - add auth token and team slug header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add team context header if present
    const teamSlug = getCurrentTeamSlug();
    if (teamSlug) {
      config.headers['X-Team-Slug'] = teamSlug;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const response = await axios.post<RefreshResponse>(`${API_URL}/auth/refresh/`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          setTokens(access_token, refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          clearTokens();
          // Emit event so AuthContext can clear state before redirect
          emitAuthLogout();
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// AUTH API - Matches backend users/views/auth.py
// =============================================================================

export const authAPI = {
  /**
   * Register new user
   * POST /auth/register/
   * Returns: { user, subscription, access_token, refresh_token }
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register/', data);
    return response.data;
  },

  /**
   * Login with Google (Access Token)
   * POST /auth/google/
   * Returns: { user, subscription, access_token, refresh_token }
   */
  googleLogin: async (accessToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google/', { access_token: accessToken });
    return response.data;
  },

  /**
   * Login with email/password
   * POST /auth/login/
   * Returns: { user, subscription, access_token, refresh_token }
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', credentials);
    return response.data;
  },

  /**
   * Logout and blacklist refresh token
   * POST /auth/logout/
   * Returns: { success: true }
   */
  logout: async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout/', { refresh_token: refreshToken });
    }
    clearTokens();
  },

  /**
   * Refresh access token
   * POST /auth/refresh/
   * Returns: { access_token, refresh_token }
   */
  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const response = await api.post<RefreshResponse>('/auth/refresh/', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  /**
   * Get current user with subscription and usage
   * GET /auth/me/
   * Returns: UserWithSubscription
   */
  getMe: async (): Promise<UserWithSubscription> => {
    const response = await api.get<UserWithSubscription>('/auth/me/');
    return response.data;
  },

  /**
   * Request password reset email
   * POST /auth/forgot-password/
   * Returns: { message: string }
   */
  forgotPassword: async (email: string): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/auth/forgot-password/', { email });
    return response.data;
  },

  /**
   * Reset password with token
   * POST /auth/reset-password/
   * Returns: { success: true }
   */
  resetPassword: async (token: string, password: string): Promise<SuccessResponse> => {
    const response = await api.post<SuccessResponse>('/auth/reset-password/', { token, password });
    return response.data;
  },

  /**
   * Verify email with token
   * POST /auth/verify-email/
   * Returns: { success: true }
   */
  verifyEmail: async (token: string): Promise<SuccessResponse> => {
    const response = await api.post<SuccessResponse>('/auth/verify-email/', { token });
    return response.data;
  },

  /**
   * Resend verification email
   * POST /auth/resend-verification/
   * Returns: { message: string }
   */
  resendVerification: async (): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/auth/resend-verification/');
    return response.data;
  },
};

// =============================================================================
// ACCOUNT API - Matches backend users/views/account.py
// =============================================================================

export const accountAPI = {
  /**
   * Get user profile with subscription
   * GET /account/profile/
   * Returns: UserWithSubscription
   */
  getProfile: async (): Promise<UserWithSubscription> => {
    const response = await api.get<UserWithSubscription>('/account/profile/');
    return response.data;
  },

  /**
   * Update user profile
   * PATCH /account/profile/
   * Returns: User
   */
  updateProfile: async (data: UpdateProfileData): Promise<User> => {
    const response = await api.patch<User>('/account/profile/', data);
    return response.data;
  },

  /**
   * Change password
   * POST /account/password/
   * Returns: { success: true }
   */
  changePassword: async (data: ChangePasswordData): Promise<SuccessResponse> => {
    const response = await api.post<SuccessResponse>('/account/password/', data);
    return response.data;
  },

  /**
   * Get usage statistics
   * GET /account/usage/
   * Returns: UsageStats
   */
  getUsage: async (): Promise<UsageStats> => {
    const response = await api.get<UsageStats>('/account/usage/');
    return response.data;
  },

  /**
   * Delete account (scheduled in 30 days)
   * POST /account/delete/
   * Returns: { message: string }
   */
  deleteAccount: async (password: string): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/account/delete/', { password });
    return response.data;
  },

  // API Keys

  /**
   * List API keys
   * GET /account/api-keys/
   * Returns: APIKey[]
   */
  getAPIKeys: async (): Promise<APIKey[]> => {
    const response = await api.get<APIKey[]>('/account/api-keys/');
    return response.data;
  },

  /**
   * Create API key
   * POST /account/api-keys/
   * Returns: { api_key: APIKey, key: string }
   */
  createAPIKey: async (data: CreateAPIKeyData): Promise<APIKeyResponse> => {
    const response = await api.post<APIKeyResponse>('/account/api-keys/', data);
    return response.data;
  },

  /**
   * Delete API key
   * DELETE /account/api-keys/{id}/
   */
  deleteAPIKey: async (id: string): Promise<void> => {
    await api.delete(`/account/api-keys/${id}/`);
  },

  /**
   * Regenerate API key
   * POST /account/api-keys/{id}/regenerate/
   * Returns: { api_key: APIKey, key: string }
   */
  regenerateAPIKey: async (id: string): Promise<APIKeyResponse> => {
    const response = await api.post<APIKeyResponse>(`/account/api-keys/${id}/regenerate/`);
    return response.data;
  },

  /**
   * Export user data (GDPR compliance)
   * GET /account/export/
   * Returns: Blob (zip file)
   */
  exportUserData: async (type: 'links' | 'analytics' | 'all'): Promise<Blob> => {
    const response = await api.get('/account/export/', {
      params: { type },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Update notification settings
   * PATCH /account/notifications/
   * Returns: NotificationSettings
   */
  updateNotificationSettings: async (settings: {
    weekly_report?: boolean;
    usage_warning?: boolean;
    marketing?: boolean;
    link_alerts?: boolean;
    security_alerts?: boolean;
  }): Promise<any> => {
    const response = await api.patch('/account/notifications/', settings);
    return response.data;
  },

  /**
   * Get notification settings
   * GET /account/notifications/
   * Returns: NotificationSettings
   */
  getNotificationSettings: async (): Promise<{
    weekly_report: boolean;
    usage_warning: boolean;
    marketing: boolean;
    link_alerts: boolean;
    security_alerts: boolean;
  }> => {
    const response = await api.get('/account/notifications/');
    return response.data;
  },

  // Sessions

  /**
   * List active sessions
   * GET /account/sessions/
   * Returns: Session[]
   */
  getSessions: async (): Promise<Array<{
    id: string;
    device: string;
    browser: string;
    os: string;
    ip_address: string;
    location: string;
    last_active: string;
    created_at: string;
    is_current: boolean;
  }>> => {
    const response = await api.get('/account/sessions/');
    // Backend returns { sessions: [...] } with device_type field
    const sessions = response.data.sessions || response.data || [];
    return sessions.map((s: any) => ({
      ...s,
      device: s.device_type || s.device || 'Unknown',
      ip_address: s.ip_address || '',
    }));
  },

  /**
   * Revoke a session
   * DELETE /account/sessions/{id}/
   */
  revokeSession: async (id: string): Promise<void> => {
    await api.delete(`/account/sessions/${id}/`);
  },

  /**
   * Revoke all sessions except current
   * POST /account/sessions/revoke-all/
   */
  revokeAllSessions: async (): Promise<{ revoked: number }> => {
    const response = await api.post('/account/sessions/revoke-all/');
    return response.data;
  },

  // Integrations

  /**
   * List available integrations
   * GET /account/integrations/
   * Returns: Integration[]
   */
  getIntegrations: async (): Promise<Array<{
    provider: string;
    name: string;
    description: string;
    icon_url: string;
    is_connected: boolean;
    connected_at: string | null;
    account_name: string | null;
  }>> => {
    const response = await api.get('/account/integrations/');
    // Backend returns { integrations: [...] } with status field
    const integrations = response.data.integrations || response.data || [];
    return integrations.map((i: any) => ({
      ...i,
      icon_url: i.icon_url || '',
      is_connected: i.status === 'connected' || i.is_connected || false,
      account_name: i.account_name || null,
    }));
  },

  /**
   * Connect integration (get OAuth URL)
   * POST /account/integrations/{provider}/connect/
   * Returns: { authorization_url: string }
   */
  connectIntegration: async (provider: string): Promise<{ authorization_url: string }> => {
    const response = await api.post(`/account/integrations/${provider}/connect/`);
    return response.data;
  },

  /**
   * Disconnect integration
   * DELETE /account/integrations/{provider}/
   */
  disconnectIntegration: async (provider: string): Promise<void> => {
    await api.delete(`/account/integrations/${provider}/`);
  },
};

// =============================================================================
// LINKS API - Matches backend links/views.py
// =============================================================================

export const linksAPI = {
  /**
   * List user's links with pagination and filters
   * GET /links/
   * Returns: PaginatedResponse<Link>
   */
  getLinks: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    campaign?: string;
    ordering?: string;
  }): Promise<PaginatedResponse<Link>> => {
    const response = await api.get<PaginatedResponse<Link>>('/links/', { params });
    return response.data;
  },

  /**
   * Get single link
   * GET /links/{id}/
   * Returns: Link
   */
  getLink: async (id: string): Promise<Link> => {
    const response = await api.get<Link>(`/links/${id}/`);
    return response.data;
  },

  /**
   * Create new link
   * POST /links/
   * Returns: Link (with optional qr_code if create_qr=true)
   */
  createLink: async (data: CreateLinkData): Promise<Link & { qr_code?: QRCode }> => {
    const response = await api.post<Link & { qr_code?: QRCode }>('/links/', data);
    return response.data;
  },

  /**
   * Update link
   * PATCH /links/{id}/
   * Returns: Link
   */
  updateLink: async (id: string, data: UpdateLinkData): Promise<Link> => {
    const response = await api.patch<Link>(`/links/${id}/`, data);
    return response.data;
  },

  /**
   * Delete link
   * DELETE /links/{id}/
   */
  deleteLink: async (id: string): Promise<void> => {
    await api.delete(`/links/${id}/`);
  },

  /**
   * Get link statistics
   * GET /links/{id}/stats/
   * Returns: LinkStats
   */
  getLinkStats: async (id: string, period?: string): Promise<LinkStats> => {
    const response = await api.get<LinkStats>(`/links/${id}/stats/`, { params: { period } });
    return response.data;
  },

  /**
   * Duplicate link
   * POST /links/{id}/duplicate/
   * Returns: Link
   */
  duplicateLink: async (id: string): Promise<Link> => {
    const response = await api.post<Link>(`/links/${id}/duplicate/`);
    return response.data;
  },

  /**
   * Bulk create links
   * POST /links/bulk/
   * Returns: { links: Link[], errors: [...] }
   */
  bulkCreate: async (urls: string[], campaignId?: string): Promise<BulkCreateLinksResponse> => {
    const response = await api.post<BulkCreateLinksResponse>('/links/bulk/', {
      urls,
      campaign_id: campaignId,
    });
    return response.data;
  },

  /**
   * Export links to CSV/JSON
   * GET /links/export/
   * Returns: Blob (file download)
   */
  exportLinks: async (params?: {
    format?: 'csv' | 'json';
    campaign?: string;
  }): Promise<Blob> => {
    const response = await api.get('/links/export/', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Import links from CSV
   * POST /links/import/
   * Returns: ImportLinksResponse
   */
  importLinks: async (file: File, campaignId?: string): Promise<ImportLinksResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (campaignId) {
      formData.append('campaign_id', campaignId);
    }
    const response = await api.post<ImportLinksResponse>('/links/import/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Download import template
   * GET /links/import/template/
   * Returns: Blob (CSV file)
   */
  getImportTemplate: async (): Promise<Blob> => {
    const response = await api.get('/links/import/template/', {
      responseType: 'blob',
    });
    return response.data;
  },

  // Custom Domains

  /**
   * List custom domains
   * GET /links/domains/
   * Returns: CustomDomain[]
   */
  getDomains: async (): Promise<CustomDomain[]> => {
    const response = await api.get<CustomDomain[]>('/links/domains/');
    return response.data;
  },

  /**
   * Create custom domain
   * POST /links/domains/
   * Returns: CustomDomain
   */
  createDomain: async (domain: string): Promise<CustomDomain> => {
    const response = await api.post<CustomDomain>('/links/domains/', { domain });
    return response.data;
  },

  /**
   * Delete custom domain
   * DELETE /links/domains/{id}/
   */
  deleteDomain: async (id: string): Promise<void> => {
    await api.delete(`/links/domains/${id}/`);
  },

  /**
   * Verify domain DNS
   * POST /links/domains/{id}/verify/
   * Returns: CustomDomain (or error with dns_txt_record)
   */
  verifyDomain: async (id: string): Promise<CustomDomain> => {
    const response = await api.post<CustomDomain>(`/links/domains/${id}/verify/`);
    return response.data;
  },

  /**
   * Check if a custom slug is available
   * GET /links/check-slug/?slug=xxx&domain_id=yyy
   * Returns: { available: boolean, error?: string }
   */
  checkSlug: async (slug: string, domainId?: string): Promise<{ available: boolean; error: string | null }> => {
    const params: Record<string, string> = { slug };
    if (domainId) params.domain_id = domainId;
    const response = await api.get<{ available: boolean; error: string | null }>('/links/check-slug/', { params });
    return response.data;
  },

  // Bulk Operations

  /**
   * Bulk delete links
   * POST /links/bulk/delete/
   * Returns: { deleted: number, errors: [...] }
   */
  bulkDelete: async (linkIds: string[]): Promise<{ deleted: number; errors: Array<{ id: string; error: string }> }> => {
    const response = await api.post('/links/bulk/delete/', { link_ids: linkIds });
    return response.data;
  },

  /**
   * Bulk move links to a campaign
   * POST /links/bulk/move/
   * Returns: { moved: number, errors: [...] }
   */
  bulkMove: async (linkIds: string[], campaignId: string | null): Promise<{ moved: number; errors: Array<{ id: string; error: string }> }> => {
    const response = await api.post('/links/bulk/move/', {
      link_ids: linkIds,
      campaign_id: campaignId
    });
    return response.data;
  },

  /**
   * Bulk export specific links
   * POST /links/bulk/export/
   * Returns: Blob (file download)
   */
  bulkExport: async (linkIds: string[], format: 'csv' | 'json' = 'csv'): Promise<Blob> => {
    const response = await api.post('/links/bulk/export/',
      { link_ids: linkIds, format },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// =============================================================================
// QR CODES API - Matches backend qrcodes/views.py
// =============================================================================

export const qrCodesAPI = {
  /**
   * List QR codes with pagination, search, and filters
   * GET /qr-codes/
   * Returns: PaginatedResponse<QRCode>
   */
  getQRCodes: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    style?: string;
  }): Promise<PaginatedResponse<QRCode>> => {
    const response = await api.get<PaginatedResponse<QRCode>>('/qr-codes/', { params });
    return response.data;
  },

  /**
   * Get single QR code
   * GET /qr-codes/{id}/
   * Returns: QRCode
   */
  getQRCode: async (id: string): Promise<QRCode> => {
    const response = await api.get<QRCode>(`/qr-codes/${id}/`);
    return response.data;
  },

  /**
   * Create QR code
   * POST /qr-codes/
   * Returns: QRCode
   */
  createQRCode: async (data: CreateQRData): Promise<QRCode> => {
    const response = await api.post<QRCode>('/qr-codes/', data);
    return response.data;
  },

  /**
   * Create QR code with logo file upload
   * POST /qr-codes/
   * Accepts: FormData with logo file
   * Returns: QRCode
   */
  createQRCodeWithLogo: async (formData: FormData): Promise<QRCode> => {
    const response = await api.post<QRCode>('/qr-codes/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Update QR code
   * PATCH /qr-codes/{id}/
   * Accepts: FormData with optional logo file
   * Returns: QRCode
   */
  updateQRCode: async (id: string, data: FormData | UpdateQRData): Promise<QRCode> => {
    const isFormData = data instanceof FormData;
    const response = await api.patch<QRCode>(`/qr-codes/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data;
  },

  /**
   * Delete QR code
   * DELETE /qr-codes/{id}/
   */
  deleteQRCode: async (id: string): Promise<void> => {
    await api.delete(`/qr-codes/${id}/`);
  },

  /**
   * Download QR code in specified format
   * GET /qr-codes/{id}/download/
   * Returns: Blob (file content)
   */
  downloadQRCode: async (id: string, format: 'png' | 'svg' | 'pdf'): Promise<Blob> => {
    const response = await api.get(`/qr-codes/${id}/download/`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Preview QR code without saving
   * POST /qr-codes/preview/
   * Returns: { preview: string } (base64 data URL)
   */
  previewQRCode: async (data: {
    link_id: string;
    style?: string;
    foreground_color?: string;
    background_color?: string;
    frame?: string;
    eye_style?: string;
    eye_color?: string;
    gradient_enabled?: boolean;
    gradient_start?: string;
    gradient_end?: string;
    gradient_direction?: string;
  }): Promise<QRPreviewResponse> => {
    const response = await api.post<QRPreviewResponse>('/qr-codes/preview/', data);
    return response.data;
  },

  /**
   * Batch download multiple QR codes as ZIP
   * POST /qr-codes/batch/download/
   * Returns: Blob (ZIP file)
   */
  batchDownloadQRCodes: async (qrIds: string[], format: 'png' | 'svg'): Promise<Blob> => {
    const response = await api.post('/qr-codes/batch/download/',
      { qr_ids: qrIds, format },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// =============================================================================
// CAMPAIGNS API - Matches backend campaigns/views.py
// =============================================================================

export const campaignsAPI = {
  /**
   * List campaigns
   * GET /campaigns/
   * Returns: Campaign[]
   */
  getCampaigns: async (): Promise<Campaign[]> => {
    const response = await api.get<Campaign[]>('/campaigns/');
    return response.data;
  },

  /**
   * Get single campaign
   * GET /campaigns/{id}/
   * Returns: Campaign
   */
  getCampaign: async (id: string): Promise<Campaign> => {
    const response = await api.get<Campaign>(`/campaigns/${id}/`);
    return response.data;
  },

  /**
   * Create campaign
   * POST /campaigns/
   * Returns: Campaign
   */
  createCampaign: async (data: CreateCampaignData): Promise<Campaign> => {
    const response = await api.post<Campaign>('/campaigns/', data);
    return response.data;
  },

  /**
   * Update campaign
   * PATCH /campaigns/{id}/
   * Returns: Campaign
   */
  updateCampaign: async (id: string, data: UpdateCampaignData): Promise<Campaign> => {
    const response = await api.patch<Campaign>(`/campaigns/${id}/`, data);
    return response.data;
  },

  /**
   * Delete campaign
   * DELETE /campaigns/{id}/
   */
  deleteCampaign: async (id: string): Promise<void> => {
    await api.delete(`/campaigns/${id}/`);
  },

  /**
   * Get links in campaign
   * GET /campaigns/{id}/links/
   * Returns: PaginatedResponse<Link>
   */
  getCampaignLinks: async (id: string): Promise<PaginatedResponse<Link>> => {
    const response = await api.get<PaginatedResponse<Link>>(`/campaigns/${id}/links/`);
    return response.data;
  },

  /**
   * Get campaign statistics
   * GET /campaigns/{id}/stats/
   * Returns: CampaignStats
   */
  getCampaignStats: async (id: string): Promise<CampaignStats> => {
    const response = await api.get<CampaignStats>(`/campaigns/${id}/stats/`);
    return response.data;
  },

  /**
   * Compare multiple campaigns
   * GET /campaigns/compare/
   * Returns: Campaign comparison data
   */
  getCampaignComparison: async (campaignIds: string[], period?: string): Promise<{
    campaigns: Array<{
      id: string;
      name: string;
      total_clicks: number;
      unique_clicks: number;
      links_count: number;
      trend: number;
    }>;
    period: string;
  }> => {
    const response = await api.get('/campaigns/compare/', {
      params: { campaign_ids: campaignIds.join(','), period }
    });
    return response.data;
  },

  /**
   * Get campaign templates
   * GET /campaigns/templates/
   * Returns: Campaign templates
   */
  getCampaignTemplates: async (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
  }>> => {
    const response = await api.get('/campaigns/templates/');
    return response.data;
  },
};

// =============================================================================
// ANALYTICS API - Matches backend analytics/views.py
// =============================================================================

export const analyticsAPI = {
  /**
   * Get analytics overview
   * GET /analytics/overview/
   * Returns: AnalyticsOverview
   */
  getOverview: async (period?: string, start_date?: string, end_date?: string): Promise<AnalyticsOverview> => {
    const response = await api.get<AnalyticsOverview>('/analytics/overview/', {
      params: { period, start_date, end_date },
    });
    return response.data;
  },

  /**
   * Get click chart data
   * GET /analytics/clicks/
   * Returns: { data: ClickChartData[] }
   */
  getClicks: async (params?: {
    period?: string;
    link_id?: string;
    group_by?: 'day' | 'week' | 'month' | 'hour';
  }): Promise<{ data: ClickChartData[] }> => {
    const response = await api.get<{ data: ClickChartData[] }>('/analytics/clicks/', { params });
    return response.data;
  },

  /**
   * Get geography breakdown
   * GET /analytics/geography/
   * Returns: GeographyStats
   */
  getGeography: async (params?: {
    period?: string;
    link_id?: string;
  }): Promise<GeographyStats> => {
    const response = await api.get<GeographyStats>('/analytics/geography/', { params });
    return response.data;
  },

  /**
   * Get device breakdown
   * GET /analytics/devices/
   * Returns: DeviceStats
   */
  getDevices: async (params?: {
    period?: string;
    link_id?: string;
  }): Promise<DeviceStats> => {
    const response = await api.get<DeviceStats>('/analytics/devices/', { params });
    return response.data;
  },

  /**
   * Get referrer breakdown
   * GET /analytics/referrers/
   * Returns: ReferrerStats
   */
  getReferrers: async (params?: {
    period?: string;
    link_id?: string;
  }): Promise<ReferrerStats> => {
    const response = await api.get<ReferrerStats>('/analytics/referrers/', { params });
    return response.data;
  },

  /**
   * Export analytics (sync - returns file)
   * GET /analytics/export/
   * Returns: Blob (CSV/JSON file)
   */
  exportAnalyticsSync: async (params: {
    format: 'csv' | 'json';
    period: string;
  }): Promise<Blob> => {
    const response = await api.get('/analytics/export/', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export analytics (async - queued task)
   * POST /analytics/export/
   * Returns: { message: string, task_id: string }
   */
  exportAnalyticsAsync: async (data: ExportRequestData): Promise<ExportResponse> => {
    const response = await api.post<ExportResponse>('/analytics/export/', data);
    return response.data;
  },

  /**
   * Export analytics with format selection
   * GET/POST /analytics/export/
   */
  exportAnalytics: async (params: {
    period?: string;
    format?: 'csv' | 'json' | 'pdf';
    link_id?: string;
  }): Promise<{ download_url?: string; data?: any }> => {
    const response = await api.get('/analytics/export/', { params });
    return response.data;
  },

  /**
   * Get real-time analytics
   * GET /analytics/realtime/
   */
  getRealtime: async (): Promise<{ active_visitors: number; recent_clicks: any[] }> => {
    const response = await api.get('/analytics/realtime/');
    return response.data;
  },

  /**
   * Get top performing links
   * GET /analytics/top-links/
   */
  getTopLinks: async (params?: { period?: string; limit?: number }): Promise<{ links: any[] }> => {
    const response = await api.get('/analytics/top-links/', { params });
    return response.data;
  },

  /**
   * Compare analytics between two periods
   * GET /analytics/compare/
   * Returns: CompareAnalytics
   */
  getCompare: async (params?: {
    period?: string;
    compare_to?: string;
    link_id?: string;
  }): Promise<{
    current_period: {
      start: string;
      end: string;
      total_clicks: number;
      unique_clicks: number;
      top_links: Array<{ link_id: string; short_code: string; clicks: number }>;
    };
    previous_period: {
      start: string;
      end: string;
      total_clicks: number;
      unique_clicks: number;
      top_links: Array<{ link_id: string; short_code: string; clicks: number }>;
    };
    change: {
      clicks_percent: number;
      unique_percent: number;
    };
  }> => {
    const response = await api.get('/analytics/compare/', { params });
    return response.data;
  },
};

// =============================================================================
// BILLING API - Matches backend billing/views.py
// =============================================================================

export const billingAPI = {
  /**
   * Get billing overview
   * GET /billing/
   * Returns: BillingInfo
   */
  getBillingInfo: async (): Promise<BillingInfo> => {
    const response = await api.get<BillingInfo>('/billing/');
    return response.data;
  },

  /**
   * Create checkout session
   * POST /billing/checkout/
   * Returns: { checkout_url: string }
   */
  createCheckoutSession: async (plan: 'pro' | 'business' | 'enterprise'): Promise<CheckoutResponse> => {
    const response = await api.post<CheckoutResponse>('/billing/checkout/', { plan });
    return response.data;
  },

  /**
   * Create customer portal session
   * POST /billing/portal/
   * Returns: { portal_url: string }
   */
  createPortalSession: async (): Promise<PortalResponse> => {
    const response = await api.post<PortalResponse>('/billing/portal/');
    return response.data;
  },
};

// =============================================================================
// TEAMS API - Matches backend teams/views.py
// =============================================================================

export const teamsAPI = {
  /**
   * List teams user belongs to
   * GET /teams/
   * Returns: Team[]
   */
  list: async (): Promise<Team[]> => {
    const response = await api.get<Team[]>('/teams/');
    return response.data;
  },

  /**
   * Create a new team (Business plan required)
   * POST /teams/
   * Returns: Team
   */
  create: async (data: CreateTeamData): Promise<Team> => {
    const response = await api.post<Team>('/teams/', data);
    return response.data;
  },

  /**
   * Get team details
   * GET /teams/:id/
   * Returns: Team
   */
  get: async (teamId: string): Promise<Team> => {
    const response = await api.get<Team>(`/teams/${teamId}/`);
    return response.data;
  },

  /**
   * Update team (owner/admin only)
   * PATCH /teams/:id/
   * Returns: Team
   */
  update: async (teamId: string, data: UpdateTeamData): Promise<Team> => {
    const response = await api.patch<Team>(`/teams/${teamId}/`, data);
    return response.data;
  },

  /**
   * Delete team (owner only)
   * DELETE /teams/:id/
   */
  delete: async (teamId: string): Promise<void> => {
    await api.delete(`/teams/${teamId}/`);
  },

  /**
   * List team members
   * GET /teams/:id/members/
   * Returns: TeamMember[]
   */
  listMembers: async (teamId: string): Promise<TeamMember[]> => {
    const response = await api.get<TeamMember[]>(`/teams/${teamId}/members/`);
    return response.data;
  },

  /**
   * Update member role (owner/admin only)
   * PATCH /teams/:id/members/:memberId/
   * Returns: TeamMember
   */
  updateMemberRole: async (teamId: string, memberId: string, data: UpdateMemberRoleData): Promise<TeamMember> => {
    const response = await api.patch<TeamMember>(`/teams/${teamId}/members/${memberId}/`, data);
    return response.data;
  },

  /**
   * Remove member (or leave if self)
   * DELETE /teams/:id/members/:memberId/
   */
  removeMember: async (teamId: string, memberId: string): Promise<void> => {
    await api.delete(`/teams/${teamId}/members/${memberId}/`);
  },

  /**
   * List pending invites (admin+)
   * GET /teams/:id/invites/
   * Returns: TeamInvite[]
   */
  listInvites: async (teamId: string): Promise<TeamInvite[]> => {
    const response = await api.get<TeamInvite[]>(`/teams/${teamId}/invites/`);
    return response.data;
  },

  /**
   * Send invite (admin+)
   * POST /teams/:id/invites/
   * Returns: TeamInvite
   */
  sendInvite: async (teamId: string, data: InviteMemberData): Promise<TeamInvite> => {
    const response = await api.post<TeamInvite>(`/teams/${teamId}/invites/`, data);
    return response.data;
  },

  /**
   * Revoke invite (admin+)
   * POST /teams/:id/invites/:inviteId/revoke/
   */
  revokeInvite: async (teamId: string, inviteId: string): Promise<void> => {
    await api.post(`/teams/${teamId}/invites/${inviteId}/revoke/`);
  },

  /**
   * Get invite details by token
   * GET /teams/invites/accept/:token/
   * Returns: InviteDetails
   */
  getInviteDetails: async (token: string): Promise<InviteDetails> => {
    const response = await api.get<InviteDetails>(`/teams/invites/accept/${token}/`);
    return response.data;
  },

  /**
   * Accept invite by token
   * POST /teams/invites/accept/:token/
   * Returns: AcceptInviteResponse
   */
  acceptInvite: async (token: string): Promise<AcceptInviteResponse> => {
    const response = await api.post<AcceptInviteResponse>(`/teams/invites/accept/${token}/`);
    return response.data;
  },

  /**
   * Get lightweight list for team switcher
   * GET /teams/my-teams/
   * Returns: MyTeamEntry[]
   */
  getMyTeams: async (): Promise<MyTeamEntry[]> => {
    const response = await api.get<MyTeamEntry[]>('/teams/my-teams/');
    return response.data;
  },
};

// =============================================================================
// RULES API - Conditional redirects and smart routing
// =============================================================================

export const rulesAPI = {
  /**
   * List all rules with optional filters
   * GET /rules/
   * Returns: PaginatedResponse<Rule>
   */
  list: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    condition_type?: string;
    action_type?: string;
    link_id?: string;
    qr_code_id?: string;
  }): Promise<PaginatedResponse<Rule>> => {
    const response = await api.get<PaginatedResponse<Rule>>('/rules/', { params });
    return response.data;
  },

  /**
   * Get single rule by ID
   * GET /rules/:id/
   * Returns: Rule
   */
  get: async (id: string): Promise<Rule> => {
    const response = await api.get<Rule>(`/rules/${id}/`);
    return response.data;
  },

  /**
   * Create a new rule
   * POST /rules/
   * Returns: Rule
   */
  create: async (data: CreateRuleData): Promise<Rule> => {
    const response = await api.post<Rule>('/rules/', data);
    return response.data;
  },

  /**
   * Update a rule
   * PATCH /rules/:id/
   * Returns: Rule
   */
  update: async (id: string, data: UpdateRuleData): Promise<Rule> => {
    const response = await api.patch<Rule>(`/rules/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a rule
   * DELETE /rules/:id/
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/rules/${id}/`);
  },

  /**
   * Toggle rule active status
   * POST /rules/:id/toggle/
   * Returns: { id: string, is_active: boolean }
   */
  toggle: async (id: string): Promise<{ id: string; is_active: boolean }> => {
    const response = await api.post<{ id: string; is_active: boolean }>(`/rules/${id}/toggle/`);
    return response.data;
  },

  /**
   * Reorder rules by priority
   * POST /rules/reorder/
   * Returns: { updated: Array<{ id: string, priority: number }> }
   */
  reorder: async (rules: Array<{ id: string; priority: number }>): Promise<{ updated: Array<{ id: string; priority: number }> }> => {
    const response = await api.post<{ updated: Array<{ id: string; priority: number }> }>('/rules/reorder/', { rules });
    return response.data;
  },

  /**
   * Get rules for a specific link
   * GET /rules/link/:linkId/
   * Returns: Rule[]
   */
  getForLink: async (linkId: string): Promise<Rule[]> => {
    const response = await api.get<Rule[]>(`/rules/link/${linkId}/`);
    return response.data;
  },

  /**
   * Get rules for a specific QR code
   * GET /rules/qr-code/:qrCodeId/
   * Returns: Rule[]
   */
  getForQRCode: async (qrCodeId: string): Promise<Rule[]> => {
    const response = await api.get(`/rules/qr-code/${qrCodeId}/`);
    const data = response.data;
    // Handle paginated response from DRF ListAPIView
    if (Array.isArray(data)) return data;
    return data.results ?? [];
  },

  /**
   * Test rule evaluation with simulated context
   * POST /rules/test/
   * Returns: TestRuleResult
   */
  test: async (data: TestRuleData): Promise<TestRuleResult> => {
    const response = await api.post<TestRuleResult>('/rules/test/', data);
    return response.data;
  },

  /**
   * Get rule statistics
   * GET /rules/stats/
   * Returns: RuleStats
   */
  getStats: async (params: { link_id?: string; qr_code_id?: string }): Promise<RuleStats> => {
    const response = await api.get<RuleStats>('/rules/stats/', { params });
    return response.data;
  },

  // Rule Groups API
  groups: {
    /**
     * List rule groups
     * GET /rules/groups/
     * Returns: PaginatedResponse<RuleGroup>
     */
    list: async (params?: {
      page?: number;
      search?: string;
      is_active?: boolean;
      logic?: 'and' | 'or';
    }): Promise<PaginatedResponse<RuleGroup>> => {
      const response = await api.get<PaginatedResponse<RuleGroup>>('/rules/groups/', { params });
      return response.data;
    },

    /**
     * Get single rule group
     * GET /rules/groups/:id/
     * Returns: RuleGroup
     */
    get: async (id: string): Promise<RuleGroup> => {
      const response = await api.get<RuleGroup>(`/rules/groups/${id}/`);
      return response.data;
    },

    /**
     * Create a rule group with conditions
     * POST /rules/groups/
     * Returns: RuleGroup
     */
    create: async (data: CreateRuleGroupData): Promise<RuleGroup> => {
      const response = await api.post<RuleGroup>('/rules/groups/', data);
      return response.data;
    },

    /**
     * Delete a rule group
     * DELETE /rules/groups/:id/
     */
    delete: async (id: string): Promise<void> => {
      await api.delete(`/rules/groups/${id}/`);
    },
  },
};

// =============================================================================
// SERIALIZATION API - Batch QR code generation and verification
// =============================================================================

export const serialAPI = {
  // Serial Batches
  batches: {
    /**
     * List all serial batches
     * GET /qr-codes/serial-batches/
     * Returns: PaginatedResponse<SerialBatch>
     */
    list: async (params?: {
      page?: number;
      page_size?: number;
      status?: string;
      search?: string;
    }): Promise<PaginatedResponse<SerialBatch>> => {
      const response = await api.get<PaginatedResponse<SerialBatch>>('/qr-codes/serial-batches/', { params });
      return response.data;
    },

    /**
     * Get single batch by ID
     * GET /qr-codes/serial-batches/:id/
     * Returns: SerialBatch
     */
    get: async (id: string): Promise<SerialBatch> => {
      const response = await api.get<SerialBatch>(`/qr-codes/serial-batches/${id}/`);
      return response.data;
    },

    /**
     * Create a new serial batch
     * POST /qr-codes/serial-batches/
     * Returns: SerialBatch
     */
    create: async (data: CreateSerialBatchData): Promise<SerialBatch> => {
      const response = await api.post<SerialBatch>('/qr-codes/serial-batches/', data);
      return response.data;
    },

    /**
     * Create a new serial batch with logo file upload
     * POST /qr-codes/serial-batches/
     * Returns: SerialBatch
     */
    createWithLogo: async (formData: FormData): Promise<SerialBatch> => {
      const response = await api.post<SerialBatch>('/qr-codes/serial-batches/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },

    /**
     * Delete a batch (only if not processing)
     * DELETE /qr-codes/serial-batches/:id/
     */
    delete: async (id: string): Promise<void> => {
      await api.delete(`/qr-codes/serial-batches/${id}/`);
    },

    /**
     * Start batch generation
     * POST /qr-codes/serial-batches/:id/start/
     * Returns: { task_id: string, status: string }
     */
    generate: async (id: string): Promise<{ task_id: string; status: string }> => {
      const response = await api.post<{ task_id: string; status: string }>(`/qr-codes/serial-batches/${id}/start/`);
      return response.data;
    },

    /**
     * Cancel batch generation
     * POST /qr-codes/serial-batches/:id/cancel/
     */
    cancel: async (id: string): Promise<void> => {
      await api.post(`/qr-codes/serial-batches/${id}/cancel/`);
    },

    /**
     * Get download URL for completed batch
     * GET /qr-codes/serial-batches/:id/download/
     * Returns: { download_url: string, expires_at: string }
     */
    getDownloadUrl: async (id: string): Promise<{ download_url: string; expires_at: string }> => {
      const response = await api.get<{ download_url: string; expires_at: string }>(`/qr-codes/serial-batches/${id}/download/`);
      return response.data;
    },

    /**
     * Get batch statistics
     * GET /qr-codes/serial-batches/:id/stats/
     * Returns: SerialCodeStats
     */
    getStats: async (id: string): Promise<SerialCodeStats> => {
      const response = await api.get<SerialCodeStats>(`/qr-codes/serial-batches/${id}/stats/`);
      return response.data;
    },
  },

  // Serial Codes
  codes: {
    /**
     * List serial codes in a batch
     * GET /qr-codes/serial-batches/:batchId/codes/
     * Returns: PaginatedResponse<SerialCode>
     */
    list: async (batchId: string, params?: {
      page?: number;
      page_size?: number;
      status?: string;
      search?: string;
    }): Promise<PaginatedResponse<SerialCode>> => {
      const response = await api.get<PaginatedResponse<SerialCode>>(`/qr-codes/serial-batches/${batchId}/codes/`, { params });
      return response.data;
    },

    /**
     * Get single code by serial number
     * GET /qr-codes/serial-codes/:serial/
     * Returns: SerialCode
     */
    get: async (serial: string): Promise<SerialCode> => {
      const response = await api.get<SerialCode>(`/qr-codes/serial-codes/${serial}/`);
      return response.data;
    },

    /**
     * Block a serial code
     * PATCH /qr-codes/serial-codes/:id/status/
     */
    block: async (codeId: string, reason: string): Promise<SerialCode> => {
      const response = await api.patch<SerialCode>(`/qr-codes/serial-codes/${codeId}/status/`, { status: 'blocked', reason });
      return response.data;
    },

    /**
     * Recall a serial code
     * PATCH /qr-codes/serial-codes/:id/status/
     */
    recall: async (codeId: string, reason: string, info?: string): Promise<SerialCode> => {
      const response = await api.patch<SerialCode>(`/qr-codes/serial-codes/${codeId}/status/`, { status: 'recalled', reason, recall_info: info });
      return response.data;
    },

    /**
     * Reactivate a blocked/recalled code
     * PATCH /qr-codes/serial-codes/:id/status/
     */
    reactivate: async (codeId: string): Promise<SerialCode> => {
      const response = await api.patch<SerialCode>(`/qr-codes/serial-codes/${codeId}/status/`, { status: 'active' });
      return response.data;
    },

    /**
     * Revoke a serial code (marks as blocked)
     * PATCH /qr-codes/serial-codes/:id/status/
     */
    revoke: async (codeId: string): Promise<SerialCode> => {
      const response = await api.patch<SerialCode>(`/qr-codes/serial-codes/${codeId}/status/`, { status: 'blocked', reason: 'Revoked by user' });
      return response.data;
    },
  },
};

// =============================================================================
// PUBLIC API (No auth required)
// =============================================================================

export const publicAPI = {
  /**
   * Create link without authentication (rate limited)
   * POST /links/public/
   * Returns: Link
   */
  createLink: async (originalUrl: string): Promise<Link> => {
    const response = await api.post<Link>('/links/public/', {
      original_url: originalUrl,
    });
    return response.data;
  },

  /**
   * Verify a serial code (public endpoint)
   * POST /verify/
   * Returns: VerificationResult
   */
  verify: async (serial: string, location?: { lat: number; lng: number; city?: string; country?: string }): Promise<VerificationResult> => {
    const response = await api.post<VerificationResult>('/verify/', { serial, location });
    return response.data;
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Download file from blob
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Handle API errors
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (data?.errors) {
      const firstError = Object.values(data.errors)[0];
      if (Array.isArray(firstError)) return firstError[0];
      return String(firstError);
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
};

export default api;
