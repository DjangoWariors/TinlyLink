import { http, HttpResponse } from 'msw';

const API_URL = '/api/v1';

// Mock data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  company: '',
  avatar_url: '',
  email_verified: true,
  created_at: new Date().toISOString(),
  initials: 'TU',
  display_name: 'Test User',
};

const mockSubscription = {
  plan: 'free',
  status: 'active',
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
};

const mockUsage = {
  period_start: '2024-01-01',
  period_end: '2024-01-31',
  links_created: 5,
  qr_codes_created: 2,
  api_calls: 0,
};

const mockLinks = [
  {
    id: 'link-1',
    short_code: 'abc123',
    short_url: 'https://lnk.to/abc123',
    original_url: 'https://example.com/page1',
    destination_url: 'https://example.com/page1',
    title: 'Example Link 1',
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
    total_clicks: 150,
    unique_clicks: 120,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'link-2',
    short_code: 'def456',
    short_url: 'https://lnk.to/def456',
    original_url: 'https://example.com/page2',
    destination_url: 'https://example.com/page2',
    title: 'Example Link 2',
    domain: null,
    domain_name: null,
    campaign: null,
    campaign_name: null,
    utm_source: 'twitter',
    utm_medium: 'social',
    utm_campaign: 'promo',
    utm_term: '',
    utm_content: '',
    is_password_protected: false,
    expires_at: null,
    is_expired: false,
    is_active: true,
    total_clicks: 75,
    unique_clicks: 60,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
];

export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/auth/login/`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: mockUser,
        subscription: mockSubscription,
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post(`${API_URL}/auth/register/`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string; full_name?: string };
    
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { ...mockUser, email: body.email, full_name: body.full_name || '' },
      subscription: mockSubscription,
    });
  }),

  http.post(`${API_URL}/auth/logout/`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.get(`${API_URL}/auth/me/`, () => {
    return HttpResponse.json({
      ...mockUser,
      subscription: mockSubscription,
      usage: mockUsage,
    });
  }),

  http.post(`${API_URL}/auth/refresh/`, () => {
    return HttpResponse.json({
      access_token: 'new-mock-access-token',
      refresh_token: 'new-mock-refresh-token',
    });
  }),

  // Links endpoints
  http.get(`${API_URL}/links/`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '10');
    
    return HttpResponse.json({
      count: mockLinks.length,
      next: null,
      previous: null,
      results: mockLinks.slice((page - 1) * pageSize, page * pageSize),
    });
  }),

  http.get(`${API_URL}/links/:id/`, ({ params }) => {
    const link = mockLinks.find((l) => l.id === params.id);
    if (link) {
      return HttpResponse.json(link);
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }),

  http.post(`${API_URL}/links/`, async ({ request }) => {
    const body = await request.json() as { original_url: string; title?: string };
    
    return HttpResponse.json({
      id: `link-${Date.now()}`,
      short_code: Math.random().toString(36).substring(2, 10),
      short_url: `https://lnk.to/${Math.random().toString(36).substring(2, 10)}`,
      original_url: body.original_url,
      destination_url: body.original_url,
      title: body.title || '',
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
    });
  }),

  http.delete(`${API_URL}/links/:id/`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Analytics endpoints
  http.get(`${API_URL}/analytics/overview/`, () => {
    return HttpResponse.json({
      total_clicks: 225,
      total_links: 2,
      total_qr_scans: 30,
      clicks_trend: {
        current: 225,
        previous: 180,
        change_percent: 25,
      },
    });
  }),

  // QR Codes endpoints
  http.get(`${API_URL}/qr-codes/`, () => {
    return HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'qr-1',
          link: 'link-1',
          link_short_url: 'https://lnk.to/abc123',
          link_title: 'Example Link 1',
          style: 'square',
          foreground_color: '#000000',
          background_color: '#FFFFFF',
          logo_url: '',
          png_url: '/qr/1.png',
          svg_url: '/qr/1.svg',
          total_scans: 30,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
      ],
    });
  }),

  // Campaigns endpoints
  http.get(`${API_URL}/campaigns/`, () => {
    return HttpResponse.json([
      {
        id: 'campaign-1',
        name: 'Newsletter Campaign',
        description: 'Email newsletter links',
        default_utm_source: 'newsletter',
        default_utm_medium: 'email',
        default_utm_campaign: 'weekly',
        total_links: 5,
        total_clicks: 500,
        is_active: true,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      },
    ]);
  }),

  // Billing endpoints
  http.get(`${API_URL}/billing/`, () => {
    return HttpResponse.json({
      subscription: mockSubscription,
      invoices: [],
      payment_method: null,
    });
  }),

  http.post(`${API_URL}/billing/checkout/`, async ({ request }) => {
    const body = await request.json() as { plan: string };
    return HttpResponse.json({
      checkout_url: `https://checkout.stripe.com/test?plan=${body.plan}`,
    });
  }),
];
