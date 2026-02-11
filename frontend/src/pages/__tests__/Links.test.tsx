import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, createMockLink } from '@/test/utils';
import { LinksPage } from '@/pages/Links';

// Mock the API
vi.mock('@/services/api', () => ({
  linksAPI: {
    getLinks: vi.fn().mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 'link-1',
          short_code: 'abc123',
          short_url: 'https://lnk.to/abc123',
          original_url: 'https://example.com',
          title: 'Example Link',
          total_clicks: 150,
          unique_clicks: 120,
          is_active: true,
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'link-2',
          short_code: 'def456',
          short_url: 'https://lnk.to/def456',
          original_url: 'https://test.com',
          title: 'Test Link',
          total_clicks: 75,
          unique_clicks: 60,
          is_active: true,
          created_at: '2024-01-10T10:00:00Z',
        },
      ],
    }),
    deleteLink: vi.fn().mockResolvedValue(undefined),
  },
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe('LinksPage', () => {
  it('renders links page title', async () => {
    render(<LinksPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/links/i)).toBeInTheDocument();
    });
  });

  it('shows create link button', async () => {
    render(<LinksPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /create|new/i })).toBeInTheDocument();
    });
  });
});
