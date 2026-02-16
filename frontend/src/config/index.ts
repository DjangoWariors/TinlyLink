// =============================================================================
// TINLYLINK FRONTEND CONFIGURATION
// =============================================================================
// Centralized configuration for environment variables and app settings
// =============================================================================

interface Config {
  // API
  apiUrl: string;
  appUrl: string;
  
  // App Info
  appName: string;
  appVersion: string;
  defaultShortDomain: string;
  
  // Feature Flags
  features: {
    analytics: boolean;
    qrCodes: boolean;
    campaigns: boolean;
    customDomains: boolean;
    apiKeys: boolean;
  };
  
  // External Services
  stripe: {
    publishableKey: string;
  };
  sentry: {
    dsn: string;
  };
  googleAnalytics: {
    trackingId: string;
  };
  
  // Environment
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;
}

function getEnvVar(key: string, defaultValue = ''): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env[key] as string) || defaultValue;
  }
  return defaultValue;
}

function getEnvBool(key: string, defaultValue = false): boolean {
  const value = getEnvVar(key, String(defaultValue));
  return value === 'true' || value === '1';
}

export const config: Config = {
  // API
  apiUrl: getEnvVar('VITE_API_URL', '/api/v1'),
  appUrl: getEnvVar('VITE_APP_URL', 'http://localhost:3000'),
  
  // App Info
  appName: getEnvVar('VITE_APP_NAME', 'TinlyLink'),
  appVersion: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  defaultShortDomain: getEnvVar('VITE_DEFAULT_SHORT_DOMAIN', 'lnk.to'),
  
  // Feature Flags
  features: {
    analytics: getEnvBool('VITE_ENABLE_ANALYTICS', true),
    qrCodes: getEnvBool('VITE_ENABLE_QR_CODES', true),
    campaigns: getEnvBool('VITE_ENABLE_CAMPAIGNS', true),
    customDomains: getEnvBool('VITE_ENABLE_CUSTOM_DOMAINS', true),
    apiKeys: getEnvBool('VITE_ENABLE_API_KEYS', true),
  },
  
  // External Services
  stripe: {
    publishableKey: getEnvVar('VITE_STRIPE_PUBLISHABLE_KEY', ''),
  },
  sentry: {
    dsn: getEnvVar('VITE_SENTRY_DSN', ''),
  },
  googleAnalytics: {
    trackingId: getEnvVar('VITE_GA_TRACKING_ID', ''),
  },
  
  // Environment
  isDev: import.meta.env?.DEV ?? false,
  isProd: import.meta.env?.PROD ?? false,
  isTest: import.meta.env?.MODE === 'test',
};

// API Routes
export const API_ROUTES = {
  // Auth
  login: '/auth/login/',
  register: '/auth/register/',
  logout: '/auth/logout/',
  refresh: '/auth/refresh/',
  me: '/auth/me/',
  forgotPassword: '/auth/forgot-password/',
  resetPassword: '/auth/reset-password/',
  verifyEmail: '/auth/verify-email/',
  resendVerification: '/auth/resend-verification/',
  
  // Account
  profile: '/account/profile/',
  password: '/account/password/',
  usage: '/account/usage/',
  deleteAccount: '/account/delete/',
  apiKeys: '/account/api-keys/',
  
  // Links
  links: '/links/',
  linksBulk: '/links/bulk/',
  linksExport: '/links/export/',
  linksImport: '/links/import/',
  domains: '/links/domains/',
  
  // QR Codes
  qrCodes: '/qr-codes/',
  
  // Campaigns
  campaigns: '/campaigns/',
  
  // Analytics
  analyticsOverview: '/analytics/overview/',
  analyticsClicks: '/analytics/clicks/',
  analyticsGeography: '/analytics/geography/',
  analyticsDevices: '/analytics/devices/',
  analyticsReferrers: '/analytics/referrers/',
  analyticsExport: '/analytics/export/',
  
  // Billing
  billing: '/billing/',
  checkout: '/billing/checkout/',
  portal: '/billing/portal/',
} as const;

export default config;
