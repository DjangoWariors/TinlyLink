# LinkShort Frontend

A modern, production-ready React frontend for the LinkShort URL shortener platform.

## Features

- ⚡ **React 19** with latest features
- 🚀 **Vite** for lightning-fast builds
- 📝 **TypeScript** for type safety
- 🎨 **Tailwind CSS** for styling
- 📊 **Recharts** for analytics visualizations
- 🔄 **React Query** for data fetching & caching
- 📱 **Responsive design** for all devices
- 🧪 **Vitest** for testing
- 🔐 **JWT authentication** with auto-refresh

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 6
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 3.4
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library + MSW

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/linkshort-frontend.git
cd linkshort-frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

```bash
# API Configuration
VITE_API_URL=/api/v1            # Backend API URL
VITE_APP_URL=http://localhost:3000

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_QR_CODES=true
VITE_ENABLE_CAMPAIGNS=true
VITE_ENABLE_CUSTOM_DOMAINS=true

# External Services (optional)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_GA_TRACKING_ID=
VITE_SENTRY_DSN=
```

## Available Scripts

```bash
# Development
npm run dev           # Start dev server on port 3000

# Building
npm run build         # Production build
npm run preview       # Preview production build

# Testing
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage
npm run test:ui       # Open Vitest UI

# Code Quality
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint errors
npm run format        # Format with Prettier
npm run format:check  # Check formatting
npm run typecheck     # TypeScript check
```

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (Button, Input, etc)
│   └── layout/          # Layout components (Navbar, Sidebar)
├── config/              # App configuration
├── contexts/            # React contexts (Auth, Theme)
├── hooks/               # Custom React hooks
├── pages/               # Page components
│   └── __tests__/       # Page tests
├── services/            # API services
├── test/                # Test utilities and mocks
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Marketing homepage |
| `/login` | Login | User authentication |
| `/register` | Register | New user registration |
| `/forgot-password` | Forgot Password | Password reset request |
| `/reset-password` | Reset Password | Set new password |
| `/verify-email` | Verify Email | Email verification |
| `/features` | Features | Product features |
| `/pricing` | Pricing | Pricing plans |
| `/dashboard` | Dashboard | User dashboard |
| `/dashboard/links` | Links | Link management |
| `/dashboard/links/new` | Create Link | Create new link |
| `/dashboard/links/:id` | Link Detail | Link details & stats |
| `/dashboard/qr-codes` | QR Codes | QR code management |
| `/dashboard/analytics` | Analytics | Analytics overview |
| `/dashboard/campaigns` | Campaigns | Campaign management |
| `/dashboard/domains` | Custom Domains | Domain management |
| `/dashboard/api-keys` | API Keys | API key management |
| `/dashboard/settings` | Settings | User settings |

## Components

### Common Components

- `Button` - Primary button component with variants
- `Input` - Form input with validation support
- `Card` - Content card wrapper
- `Skeleton` - Loading placeholders
- `ErrorBoundary` - Error handling wrapper
- `SEO` - Meta tags management

### Layout Components

- `DashboardLayout` - Dashboard wrapper with sidebar
- `Navbar` - Top navigation bar
- `Sidebar` - Dashboard sidebar navigation

## API Integration

All API calls go through the centralized `services/api.ts`:

```typescript
import { linksAPI } from '@/services/api';

// Get links
const links = await linksAPI.getLinks({ page: 1 });

// Create link
const newLink = await linksAPI.createLink({
  original_url: 'https://example.com',
  title: 'My Link',
});
```

### Authentication

JWT tokens are automatically managed:
- Access tokens stored in cookies (1 day expiry)
- Refresh tokens stored in cookies (7 day expiry)
- Automatic token refresh on 401 responses

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/pages/__tests__/Login.test.tsx
```

### Test Structure

```typescript
import { render, screen } from '@/test/utils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Mocking API

Tests use MSW (Mock Service Worker) for API mocking:

```typescript
import { handlers } from '@/test/handlers';
import { setupServer } from 'msw/node';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Deployment

### Docker

```bash
# Build image
docker build -t linkshort-frontend .

# Run container
docker run -p 80:80 linkshort-frontend
```

### Docker Compose

```yaml
services:
  frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=/api/v1
```

### Static Hosting

Build and deploy the `dist` folder to any static hosting:

```bash
npm run build
# Deploy dist/ to Vercel, Netlify, AWS S3, etc.
```

## Performance Optimizations

- **Code Splitting**: Automatic route-based splitting via Vite
- **Lazy Loading**: Components loaded on demand
- **Caching**: React Query with 5-minute stale time
- **Compression**: Gzip enabled in production nginx
- **Asset Optimization**: Images and CSS minified

### Bundle Analysis

```bash
npm run build:analyze
```

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## License

MIT License - see LICENSE file for details.
