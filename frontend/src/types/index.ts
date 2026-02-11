// =============================================================================
// USER & AUTH TYPES - Matches backend users/serializers.py
// =============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  company: string;
  avatar_url: string;
  email_verified: boolean;
  created_at: string;
  initials: string;
  display_name: string;
}

export interface PlanLimits {
  links_per_month: number;
  qr_codes_per_month: number;
  api_calls_per_month: number;
  custom_domains: number;
  analytics_retention_days: number;
  custom_slugs: boolean;
  password_protection: boolean;
  show_ads: boolean;
  team_members: number;
}

export interface Subscription {
  plan: 'free' | 'pro' | 'business' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_paid: boolean;
  limits: PlanLimits;
}

export interface Usage {
  period_start: string;
  period_end: string;
  links_created: number;
  qr_codes_created: number;
  api_calls: number;
}

export interface UserWithSubscription extends User {
  subscription: Subscription;
  usage: Usage;
}

// Auth request/response types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// Backend returns: { user, subscription, access_token, refresh_token }
export interface AuthResponse extends AuthTokens {
  user: User;
  subscription: Subscription | null;
}

// Backend returns only tokens on refresh
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// =============================================================================
// LINK TYPES - Matches backend links/serializers.py
// =============================================================================

export interface Link {
  id: string;
  short_code: string;
  short_url: string;
  original_url: string;
  destination_url: string;
  title: string;
  domain: string | null;
  domain_name: string | null;
  campaign: string | null;
  campaign_name: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  is_password_protected: boolean;
  expires_at: string | null;
  is_expired: boolean;
  is_active: boolean;
  total_clicks: number;
  unique_clicks: number;
  qr_code: QRCode | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkData {
  original_url: string;
  custom_slug?: string;
  title?: string;
  domain_id?: string;
  campaign_id?: string;
  password?: string;
  expires_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  create_qr?: boolean;
  qr_style?: 'square' | 'dots' | 'rounded';
  qr_frame?: string;
  qr_foreground_color?: string;
  qr_background_color?: string;
}

export interface UpdateLinkData {
  original_url?: string;
  title?: string;
  campaign_id?: string | null;
  password?: string;
  expires_at?: string | null;
  is_active?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// Bulk create response from backend
export interface BulkCreateLinksResponse {
  links: Link[];
  errors: Array<{ url: string; error: string }>;
}

// Link stats from analytics service
export interface ClicksByDay {
  date: string;
  clicks: number;
  unique: number;
}

export interface TopCountry {
  code: string;
  name: string;
  clicks: number;
}

export interface TopCity {
  city: string;
  country: string;
  clicks: number;
}

export interface LinkStats {
  total_clicks: number;
  unique_clicks: number;
  clicks_by_day: ClicksByDay[];
  top_countries: TopCountry[];
  top_cities: TopCity[];
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  browsers: Array<{ browser: string; clicks: number }>;
  referrers: Array<{ referer: string; clicks: number }>;
}

// Import/Export types
export interface ImportLinksResponse {
  imported: number;
  errors: Array<{ row: number; url?: string; error: string }>;
  total_errors: number;
  links: Link[];
}

// =============================================================================
// CUSTOM DOMAIN TYPES - Matches backend links/serializers.py
// =============================================================================

export interface CustomDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  verified_at: string | null;
  dns_txt_record: string;
  ssl_status: 'pending' | 'active' | 'failed';
  created_at: string;
}

export interface DomainVerifyError {
  error: string;
  dns_txt_record: string;
}

// =============================================================================
// QR CODE TYPES - Matches backend qrcodes/serializers.py
// =============================================================================

export type QRStyle = 'square' | 'dots' | 'rounded';
export type QRFrame = 'none' | 'simple' | 'scan_me' | 'balloon' | 'badge' | 'phone' | 'polaroid' | 'laptop' | 'ticket' | 'card' | 'tag' | 'certificate';
export type QREyeStyle = 'square' | 'circle' | 'rounded' | 'leaf' | 'diamond';
export type QRGradientDirection = 'vertical' | 'horizontal' | 'diagonal' | 'radial';

// QR code types available - matches backend TYPE_CHOICES
export type QRType =
  | 'link' | 'vcard' | 'wifi' | 'email' | 'sms' | 'phone' | 'text' | 'calendar' | 'location'  // Basic
  | 'upi' | 'pix'  // Payment
  | 'product' | 'menu'  // Business
  | 'document' | 'pdf'  // Document
  | 'multi_url' | 'app_store' | 'social'  // Multi-destination
  | 'serial';  // Enterprise

// Type-specific content data structures
export interface VCardData {
  name: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface WiFiData {
  ssid: string;
  password?: string;
  auth: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export interface EmailData {
  email: string;
  subject?: string;
  body?: string;
}

export interface SMSData {
  phone: string;
  message?: string;
}

export interface PhoneData {
  phone: string;
}

export interface TextData {
  text: string;
}

export interface CalendarData {
  title: string;
  start: string; // ISO date
  end?: string;
  location?: string;
  description?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
}

// Union type for all content data
export type QRContentData = VCardData | WiFiData | EmailData | SMSData | PhoneData | TextData | CalendarData | LocationData | Record<string, unknown>;

export interface QRDownloadUrls {
  png: string;
  svg: string;
  pdf: string;
}

export interface QRCode {
  id: string;
  qr_type: QRType;
  title: string;
  link: string | null;
  link_short_code: string | null;
  link_original_url: string | null;
  short_url: string;
  content_data: QRContentData;
  qr_content: string;
  is_dynamic: boolean;
  short_code: string | null;
  destination_url: string;
  style: QRStyle;
  frame: QRFrame;
  frame_text: string;
  foreground_color: string;
  background_color: string;
  logo_url: string;
  // Eye styling
  eye_style: QREyeStyle;
  eye_color: string;
  // Gradient styling
  gradient_enabled: boolean;
  gradient_start: string;
  gradient_end: string;
  gradient_direction: QRGradientDirection;
  // File paths
  png_path: string;
  svg_path: string;
  pdf_path: string;
  download_urls: QRDownloadUrls;
  total_scans: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateQRData {
  qr_type?: QRType;
  title?: string;
  link_id?: string;
  content_data?: QRContentData;
  is_dynamic?: boolean;
  style?: QRStyle;
  frame?: QRFrame;
  frame_text?: string;
  foreground_color?: string;
  background_color?: string;
  logo_url?: string;
  // Eye styling
  eye_style?: QREyeStyle;
  eye_color?: string;
  // Gradient styling
  gradient_enabled?: boolean;
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: QRGradientDirection;
}

export interface UpdateQRData {
  title?: string;
  destination_url?: string;
  content_data?: QRContentData;
  style?: QRStyle;
  frame?: QRFrame;
  frame_text?: string;
  foreground_color?: string;
  background_color?: string;
  logo_url?: string;
  eye_style?: QREyeStyle;
  eye_color?: string;
  gradient_enabled?: boolean;
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: QRGradientDirection;
}

export interface QRPreviewResponse {
  preview: string; // base64 data URL
}

// =============================================================================
// CAMPAIGN TYPES - Matches backend campaigns/serializers.py
// =============================================================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  default_utm_source: string;
  default_utm_medium: string;
  default_utm_campaign: string;
  total_links: number;
  total_clicks: number;
  links_count: number;
  is_active: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignData {
  name: string;
  description?: string;
  default_utm_source?: string;
  default_utm_medium?: string;
  default_utm_campaign?: string;
}

export interface UpdateCampaignData {
  name?: string;
  description?: string;
  default_utm_source?: string;
  default_utm_medium?: string;
  default_utm_campaign?: string;
  is_active?: boolean;
}

export interface CampaignStats {
  total_clicks: number;
  clicks_by_day: ClicksByDay[];
  top_links: Array<{ link: Link; clicks: number }>;
}

// =============================================================================
// ANALYTICS TYPES - Matches backend analytics/serializers.py & services.py
// =============================================================================

export interface ClicksTrend {
  current: number;
  previous: number;
  change_percent: number;
}

export interface AnalyticsOverview {
  total_clicks: number;
  total_links: number;
  total_qr_scans: number;
  unique_visitors: number;
  countries: number;
  clicks_trend: ClicksTrend;
}

export interface ClickChartData {
  date: string;
  clicks: number;
  unique_clicks: number;
}

export interface CountryStat {
  code: string;
  name: string;
  clicks: number;
  percentage: number;
}

export interface GeographyStats {
  countries: CountryStat[];
  total: number;
}

export interface DeviceStatWithPercent {
  clicks: number;
  percentage: number;
}

export interface DeviceStats {
  devices: {
    mobile: DeviceStatWithPercent;
    desktop: DeviceStatWithPercent;
    tablet: DeviceStatWithPercent;
  };
  browsers: Array<{ browser: string; clicks: number }>;
  operating_systems: Array<{ os: string; clicks: number }>;
  total: number;
}

export interface ReferrerStatWithPercent {
  domain: string;
  clicks: number;
  percentage: number;
}

export interface ReferrerStats {
  referrers: ReferrerStatWithPercent[];
  direct: number;
  total: number;
}

export interface ExportRequestData {
  period: '7d' | '30d' | '90d' | 'all';
  format: 'csv' | 'json';
  link_ids?: string[];
}

export interface ExportResponse {
  message: string;
  task_id: string;
}

// =============================================================================
// API KEY TYPES - Matches backend users/serializers.py
// =============================================================================

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  total_requests: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface CreateAPIKeyData {
  name: string;
  scopes?: string[];
}

export interface APIKeyResponse {
  api_key: APIKey;
  key: string; // Only shown once!
}

// =============================================================================
// BILLING TYPES - Matches backend billing/views.py
// =============================================================================

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  pdf_url: string;
}

export interface PaymentMethod {
  type: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
}

export interface BillingInfo {
  subscription: {
    plan: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  invoices: Invoice[];
  payment_method: PaymentMethod | null;
}

export interface CheckoutResponse {
  checkout_url: string;
}

export interface PortalResponse {
  portal_url: string;
}

// =============================================================================
// ACCOUNT TYPES - Matches backend users/views/account.py
// =============================================================================

export interface UsageStats {
  period: {
    start: string;
    end: string;
  };
  links: {
    used: number;
    limit: number;
  };
  qr_codes: {
    used: number;
    limit: number;
  };
  api_calls: {
    used: number;
    limit: number;
  };
}

export interface UpdateProfileData {
  full_name?: string;
  company?: string;
  avatar_url?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

// =============================================================================
// COMMON API TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface APIError {
  error?: string;
  errors?: Record<string, string[]>;
  detail?: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface MessageResponse {
  message: string;
}

// =============================================================================
// SESSION TYPES - Matches backend users/views/account.py
// =============================================================================

export interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  last_active: string;
  created_at: string;
  is_current: boolean;
}

// =============================================================================
// INTEGRATION TYPES - Matches backend users/views/account.py
// =============================================================================

export interface Integration {
  provider: string;
  name: string;
  description: string;
  icon_url: string;
  is_connected: boolean;
  connected_at: string | null;
  account_name: string | null;
}

export interface IntegrationConnectResponse {
  authorization_url: string;
}

// =============================================================================
// EXTENDED ANALYTICS TYPES
// =============================================================================

export interface RealtimeAnalytics {
  active_visitors: number;
  recent_clicks: Array<{
    id: string;
    link_short_code: string;
    country: string;
    city: string;
    device: string;
    timestamp: string;
  }>;
}

export interface CompareAnalytics {
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
}

export interface TopLinkStats {
  links: Array<{
    id: string;
    short_code: string;
    short_url: string;
    original_url: string;
    title: string;
    total_clicks: number;
    unique_clicks: number;
    trend: number;
  }>;
}

// =============================================================================
// BULK OPERATION TYPES
// =============================================================================

export interface BulkDeleteResponse {
  deleted: number;
  errors: Array<{ id: string; error: string }>;
}

export interface BulkMoveResponse {
  moved: number;
  errors: Array<{ id: string; error: string }>;
}

// =============================================================================
// NOTIFICATION SETTINGS
// =============================================================================

export interface NotificationSettings {
  weekly_report: boolean;
  usage_warning: boolean;
  marketing: boolean;
  link_alerts: boolean;
  security_alerts: boolean;
}

// =============================================================================
// TEAM COLLABORATION TYPES
// =============================================================================

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  owner: string;
  owner_email: string;
  member_count: number;
  my_role: TeamRole | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    initials: string;
  };
  role: TeamRole;
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  invited_by_name: string;
  is_expired: boolean;
  expires_at: string;
  created_at: string;
}

export interface CreateTeamData {
  name: string;
  description?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  logo_url?: string;
}

export interface InviteMemberData {
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface UpdateMemberRoleData {
  role: 'admin' | 'editor' | 'viewer';
}

export interface MyTeamEntry {
  team_id: string;
  team_name: string;
  team_slug: string;
  role: TeamRole;
}

export interface InviteDetails {
  team_name: string;
  team_slug: string;
  role: TeamRole;
  invited_by: string;
  expires_at: string;
  email: string;
}

export interface AcceptInviteResponse {
  message: string;
  team: Team;
}

// =============================================================================
// RULES ENGINE TYPES - Matches backend rules/serializers.py
// =============================================================================

export type RuleConditionType =
  | 'country'
  | 'city'
  | 'region'
  | 'device'
  | 'os'
  | 'browser'
  | 'language'
  | 'referrer'
  | 'time'
  | 'date'
  | 'day_of_week'
  | 'scan_count'
  | 'is_first_scan'
  | 'query_param';

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'regex';

export type RuleActionType =
  | 'redirect'
  | 'show_content'
  | 'block'
  | 'add_utm'
  | 'set_header';

export interface Rule {
  id: string;
  name: string;
  description: string;
  link: string | null;
  link_title: string | null;
  qr_code: string | null;
  qr_code_title: string | null;
  campaign: string | null;
  campaign_name: string | null;
  serial_batch: string | null;
  serial_batch_name: string | null;
  priority: number;
  condition_type: RuleConditionType;
  condition_operator: RuleOperator;
  condition_value: unknown;
  condition_key: string;
  action_type: RuleActionType;
  action_value: Record<string, unknown>;
  is_active: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  times_matched: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleData {
  name: string;
  description?: string;
  priority?: number;
  link_id?: string;
  qr_code_id?: string;
  campaign_id?: string;
  serial_batch_id?: string;
  condition_type: RuleConditionType;
  condition_operator: RuleOperator;
  condition_value: unknown;
  condition_key?: string;
  action_type: RuleActionType;
  action_value: Record<string, unknown>;
  is_active?: boolean;
  schedule_start?: string;
  schedule_end?: string;
}

export interface UpdateRuleData {
  name?: string;
  description?: string;
  priority?: number;
  condition_type?: RuleConditionType;
  condition_operator?: RuleOperator;
  condition_value?: unknown;
  condition_key?: string;
  action_type?: RuleActionType;
  action_value?: Record<string, unknown>;
  is_active?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
}

export interface RuleCondition {
  id: string;
  condition_type: RuleConditionType;
  condition_operator: RuleOperator;
  condition_value: unknown;
  condition_key: string;
}

export interface RuleGroup {
  id: string;
  name: string;
  description: string;
  link: string | null;
  link_title: string | null;
  qr_code: string | null;
  qr_code_title: string | null;
  logic: 'and' | 'or';
  priority: number;
  action_type: RuleActionType;
  action_value: Record<string, unknown>;
  conditions: RuleCondition[];
  rules?: Array<{ id: string; name: string }>;
  rules_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleGroupData {
  name: string;
  description?: string;
  logic?: 'and' | 'or';
  priority?: number;
  link_id?: string;
  qr_code_id?: string;
  action_type?: RuleActionType;
  action_value?: Record<string, unknown>;
  conditions?: Array<{
    condition_type: RuleConditionType;
    condition_operator: RuleOperator;
    condition_value: unknown;
    condition_key?: string;
  }>;
  is_active?: boolean;
}

export interface TestRuleData {
  link_id?: string;
  qr_code_id?: string;
  country_code?: string;
  city?: string;
  device_type?: 'mobile' | 'tablet' | 'desktop';
  os?: string;
  browser?: string;
  language?: string;
  referrer?: string;
  time_hour?: number;
  day_of_week?: number;
  scan_count?: number;
  is_first_scan?: boolean;
}

export interface TestRuleResult {
  matched: boolean;
  rule: {
    id: string;
    name: string;
    action: RuleActionType;
    action_value: Record<string, unknown>;
  } | null;
  result: {
    type: string;
    url?: string;
    message?: string;
  };
  context_used: Record<string, unknown>;
}

export interface RuleStats {
  total_rules: number;
  active_rules: number;
  total_matches: number;
  rules_by_type: Record<string, number>;
  top_rules: Array<{
    id: string;
    name: string;
    times_matched: number;
    last_matched: string | null;
  }>;
}

// =============================================================================
// SERIALIZATION TYPES - Matches backend qrcodes/serializers.py
// =============================================================================

export type SerialBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SerialCodeStatus = 'unused' | 'active' | 'verified' | 'suspicious' | 'revoked' | 'blocked' | 'recalled' | 'expired';

export interface SerialBatch {
  id: string;
  name: string;
  description: string;
  prefix: string;
  quantity: number;
  generated_count: number;
  progress_percent: number;
  destination_url_template: string;
  url_template?: string; // Alias for destination_url_template
  style: string;
  frame: string;
  foreground_color: string;
  background_color: string;
  eye_style: string;
  eye_color: string;
  gradient_enabled: boolean;
  gradient_start: string;
  gradient_end: string;
  gradient_direction: string;
  logo_url: string;
  product_name: string;
  product_sku: string;
  product_batch?: string;
  product_category: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  batch_metadata: Record<string, unknown>;
  status: SerialBatchStatus;
  error_message: string;
  export_file_url: string;
  export_expires_at: string | null;
  celery_task_id: string;
  created_at: string;
  completed_at: string | null;
  is_complete: boolean;
  can_download: boolean;
  total_scans?: number;
  suspicious_count?: number;
}

export interface CreateSerialBatchData {
  name: string;
  description?: string;
  prefix?: string;
  quantity: number;
  destination_url_template: string;
  style?: string;
  frame?: string;
  foreground_color?: string;
  background_color?: string;
  eye_style?: string;
  eye_color?: string;
  gradient_enabled?: boolean;
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: string;
  logo_url?: string;
  product_name?: string;
  product_sku?: string;
  product_category?: string;
  manufacture_date?: string;
  expiry_date?: string;
  batch_metadata?: Record<string, unknown>;
}

export interface SerialCode {
  id: string;
  batch: string;
  batch_name: string;
  qr_code: string;
  serial_number: string;
  short_url: string;
  verify_url: string;
  verification_url?: string; // Alias
  first_scanned_at: string | null;
  last_scanned_at?: string | null;
  first_scan_location: string;
  last_scan_location?: string;
  first_scan_device: string;
  total_scans: number;
  scan_count: number; // Alias for total_scans
  unique_ips: number;
  unique_locations: number;
  unique_countries: number;
  status: SerialCodeStatus;
  status_reason: string;
  suspicion_score: number;
  suspicion_reasons: string[];
  product_metadata: Record<string, unknown>;
  created_at: string;
  scan_history?: Array<{
    timestamp: string;
    location?: string;
    device?: string;
    ip?: string;
  }>;
}

export interface SerialCodeStats {
  total_codes: number;
  scanned_codes: number;
  active_codes: number;
  suspicious_codes: number;
  blocked_codes: number;
  total_scans: number;
  unique_scanners: number;
  scan_rate: number;
  status_distribution?: Record<string, number>;
  daily_scans?: Array<{ date: string; count: number }>;
  top_countries?: Array<{ country: string; count: number }>;
  suspicious_scans?: Array<{ serial: string; reason: string; timestamp: string }>;
}

export interface VerificationResult {
  valid: boolean;
  status: 'authentic' | 'suspicious' | 'counterfeit' | 'unknown' | SerialCodeStatus | 'invalid';
  is_first_scan: boolean;
  product: {
    name: string;
    sku: string;
    batch?: string;
    category?: string;
    manufacture_date?: string;
    expiry_date?: string;
  } | null;
  first_scan: {
    date: string;
    location: string;
  } | null;
  verification?: {
    scan_count: number;
    first_scanned?: string;
  };
  scan_count: number;
  message: string;
  recall_info?: string;
  warnings?: string[];
  manufacturer?: {
    name: string;
    logo?: string;
    website?: string;
  };
  support_url?: string;
}

