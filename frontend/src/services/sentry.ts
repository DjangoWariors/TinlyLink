// =============================================================================
// SENTRY ERROR TRACKING SETUP
// =============================================================================
// Production error tracking and monitoring
// =============================================================================

import { config } from '@/config';

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

interface ErrorContext {
  user?: {
    id: string;
    email: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

// Mock Sentry interface (replace with actual @sentry/react when installed)
interface SentryInterface {
  init: (config: SentryConfig) => void;
  captureException: (error: Error, context?: ErrorContext) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
  setUser: (user: { id: string; email: string } | null) => void;
  setTag: (key: string, value: string) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  addBreadcrumb: (breadcrumb: {
    category: string;
    message: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }) => void;
}

// Sentry wrapper (no-op in development or when DSN not configured)
class SentryService implements SentryInterface {
  private initialized = false;
  private sentry: typeof import('@sentry/react') | null = null;

  async init(sentryConfig: SentryConfig): Promise<void> {
    if (this.initialized || !sentryConfig.dsn) {
      return;
    }

    try {
      // Dynamically import Sentry only when needed
      this.sentry = await import('@sentry/react');
      
      this.sentry.init({
        dsn: sentryConfig.dsn,
        environment: sentryConfig.environment,
        release: sentryConfig.release,
        integrations: [
          this.sentry.browserTracingIntegration(),
          this.sentry.replayIntegration(),
        ],
        tracesSampleRate: sentryConfig.tracesSampleRate,
        replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
        replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
      });
      
      this.initialized = true;
      console.info('Sentry initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize Sentry:', error);
    }
  }

  captureException(error: Error, context?: ErrorContext): void {
    if (!this.initialized || !this.sentry) {
      console.error('Error captured (Sentry not initialized):', error);
      return;
    }

    this.sentry.captureException(error, {
      user: context?.user,
      tags: context?.tags,
      extra: context?.extra,
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.initialized || !this.sentry) {
      console.log(`Message captured (Sentry not initialized) [${level}]:`, message);
      return;
    }

    this.sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; email: string } | null): void {
    if (!this.initialized || !this.sentry) return;
    this.sentry.setUser(user);
  }

  setTag(key: string, value: string): void {
    if (!this.initialized || !this.sentry) return;
    this.sentry.setTag(key, value);
  }

  setContext(name: string, context: Record<string, unknown>): void {
    if (!this.initialized || !this.sentry) return;
    this.sentry.setContext(name, context);
  }

  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void {
    if (!this.initialized || !this.sentry) return;
    this.sentry.addBreadcrumb(breadcrumb);
  }
}

// Singleton instance
export const sentry = new SentryService();

// Initialize Sentry
export async function initSentry(): Promise<void> {
  if (!config.sentry.dsn) {
    console.info('Sentry DSN not configured, skipping initialization');
    return;
  }

  await sentry.init({
    dsn: config.sentry.dsn,
    environment: config.isProd ? 'production' : 'development',
    release: config.appVersion,
    tracesSampleRate: config.isProd ? 0.1 : 1.0,
    replaysSessionSampleRate: config.isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Error boundary helper
export function captureError(error: Error, componentStack?: string): void {
  sentry.captureException(error, {
    extra: {
      componentStack,
    },
  });
}

export default sentry;
