// =============================================================================
// GOOGLE ANALYTICS SETUP
// =============================================================================
// Production analytics tracking
// =============================================================================

import { config } from '@/config';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

interface EventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
}

class AnalyticsService {
  private initialized = false;
  private trackingId: string;

  constructor() {
    this.trackingId = config.googleAnalytics.trackingId;
  }

  init(): void {
    if (this.initialized || !this.trackingId) {
      return;
    }

    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.trackingId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('config', this.trackingId, {
      send_page_view: false, // We'll track page views manually
    });

    this.initialized = true;
    console.info('Google Analytics initialized');
  }

  // Track page views
  pageView(path: string, title?: string): void {
    if (!this.initialized) return;

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  }

  // Track custom events
  event(action: string, params?: EventParams): void {
    if (!this.initialized) return;

    window.gtag('event', action, {
      event_category: params?.category,
      event_label: params?.label,
      value: params?.value,
      ...params,
    });
  }

  // Track user
  setUser(userId: string): void {
    if (!this.initialized) return;

    window.gtag('config', this.trackingId, {
      user_id: userId,
    });
  }

  // Track conversions
  conversion(conversionId: string, value?: number, currency = 'USD'): void {
    if (!this.initialized) return;

    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: currency,
    });
  }

  // E-commerce tracking
  purchase(transactionId: string, value: number, items: unknown[]): void {
    if (!this.initialized) return;

    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: 'USD',
      items: items,
    });
  }

  // Track signup
  signUp(method: string): void {
    this.event('sign_up', { method });
  }

  // Track login
  login(method: string): void {
    this.event('login', { method });
  }

  // Track link creation
  linkCreated(linkId: string): void {
    this.event('link_created', {
      category: 'engagement',
      label: linkId,
    });
  }

  // Track QR code creation
  qrCodeCreated(qrId: string): void {
    this.event('qr_code_created', {
      category: 'engagement',
      label: qrId,
    });
  }

  // Track subscription upgrade
  subscriptionUpgrade(plan: string, value: number): void {
    this.event('subscription_upgrade', {
      category: 'monetization',
      label: plan,
      value: value,
    });
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// Initialize analytics
export function initAnalytics(): void {
  if (!config.googleAnalytics.trackingId) {
    console.info('GA tracking ID not configured, skipping initialization');
    return;
  }

  analytics.init();
}

// Hook for tracking page views with React Router
export function usePageTracking(): void {
  // This would be called in App.tsx with useLocation
  // const location = useLocation();
  // useEffect(() => {
  //   analytics.pageView(location.pathname, document.title);
  // }, [location]);
}

export default analytics;
