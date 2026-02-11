import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  company: '',
  avatar_url: '',
  email_verified: true,
  created_at: new Date().toISOString(),
  initials: 'TU',
  display_name: 'Test User',
  ...overrides,
});

export const createMockSubscription = (overrides = {}) => ({
  plan: 'free' as const,
  status: 'active' as const,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  is_paid: false,
  limits: {
    links_per_month: 50,
    qr_codes_per_month: 10,
    api_calls_per_month: 0,
    custom_domains: 0,
    analytics_retention_days: 30,
    custom_slugs: false,
    password_protection: false,
    show_ads: true,
  },
  ...overrides,
});

export const createMockLink = (overrides = {}) => ({
  id: 'link-123',
  short_code: 'abc123',
  short_url: 'https://lnk.to/abc123',
  original_url: 'https://example.com',
  destination_url: 'https://example.com',
  title: 'Test Link',
  domain: null,
  domain_name: null,
  campaign: null,
  campaign_name: null,
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
  is_password_protected: false,
  expires_at: null,
  is_expired: false,
  is_active: true,
  total_clicks: 0,
  unique_clicks: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockQRCode = (overrides = {}) => ({
  id: 'qr-123',
  link: 'link-123',
  link_short_url: 'https://lnk.to/abc123',
  link_title: 'Test Link',
  style: 'square' as const,
  foreground_color: '#000000',
  background_color: '#FFFFFF',
  logo_url: '',
  png_url: '/qr/123.png',
  svg_url: '/qr/123.svg',
  total_scans: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockCampaign = (overrides = {}) => ({
  id: 'campaign-123',
  name: 'Test Campaign',
  description: 'A test campaign',
  default_utm_source: 'newsletter',
  default_utm_medium: 'email',
  default_utm_campaign: 'test',
  total_links: 0,
  total_clicks: 0,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});
