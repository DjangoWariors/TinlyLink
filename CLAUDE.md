# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TinlyLink is a URL shortener and QR code platform with a React frontend and Django backend. The monorepo has two top-level directories: `frontend/` and `backend/`.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev              # Dev server on port 3000
npm run build            # tsc -b && vite build
npm run test             # Vitest watch mode
npm run test:run         # Vitest single run
npm run test -- src/pages/__tests__/Login.test.tsx  # Run specific test
npm run lint             # ESLint (--max-warnings 0, many pre-existing warnings)
npm run lint:fix         # ESLint auto-fix
npm run typecheck        # tsc --noEmit
npm run format           # Prettier
```

### Backend (`backend/`)
```bash
python manage.py runserver                    # Dev server on port 8000
python manage.py migrate                      # Run migrations
pytest                                        # All tests
pytest tests/test_links/test_links.py         # Specific test file
pytest tests/test_links/test_links.py::TestLinkCreation::test_create_link_success  # Specific test
pytest --cov=apps --cov-report=html           # Coverage
celery -A config worker -l info               # Celery worker
celery -A config beat -l info                 # Celery Beat scheduler
```

### Windows Note
Quote paths in bash: `cd "D:\fly_me\update-me\me\frontend"`

## Architecture

### Frontend (React + TypeScript + Vite)

**Provider hierarchy**: `QueryClientProvider` > `BrowserRouter` > `AuthProvider` > `TeamProvider` > Routes

**Routing**: `App.tsx` defines all routes. Public routes use `PublicRoute` wrapper (redirects authenticated users). Dashboard routes use `ProtectedRoute` wrapper + `DashboardLayout`. All dashboard routes are nested under `/dashboard`.

**API layer**: `src/services/api.ts` is the single API client. It exports namespaced API objects: `authAPI`, `accountAPI`, `linksAPI`, `qrCodesAPI`, `analyticsAPI`, `campaignsAPI`, `rulesAPI`, `serialAPI`, `billingAPI`, `teamsAPI`, `publicAPI`. Uses Axios with cookie-based JWT tokens and interceptor-based refresh. Exports `onAuthLogout` event for cross-component logout signaling.

**State management**:
- Server state: TanStack React Query v5 (5-min stale time, 1 retry). Note: v5 has no `onSuccess` callback in `useQuery` — use `useEffect` to sync fetched data to local state.
- Auth state: `AuthContext` provides `user`, `subscription`, `usage`, `isAuthenticated`, `login`, `logout`, `refreshUser`.
- Team state: `TeamContext` provides `currentTeam`, `switchTeam`, role helpers (`isOwner`, `isAdmin`, `canManage`, `canEdit`).
- Form state: React Hook Form + Zod schemas.

**Path alias**: `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`).

**Shared components**: `src/components/common/` — Button, Card, Input, ConfirmDialog, ErrorBoundary, FileUpload, Skeleton, SEO, VirtualList. Import from `@/components/common`.

**Types**: All TypeScript types in `src/types/`. API service imports types from `@/types`.

**Testing**: Vitest + Testing Library + MSW. Test utils in `src/test/`. Tests colocated in `__tests__/` directories.

### Backend (Django 5.2 + DRF)

**9 Django apps** in `apps/`: `users`, `links`, `qrcodes`, `analytics`, `campaigns`, `rules`, `teams`, `billing`, `public`.

**Settings**: Split settings in `config/settings/` — `base.py`, `local.py`, `production.py`.

**Key models**:
- `users`: `User` (UUID PK), `Subscription`, `APIKey`, `UsageTracking`
- `links`: `Link` (nanoid short codes, UTM, password, expiry), `CustomDomain`
- `qrcodes`: `QRCode` (16 content types, styling), `SerialBatch`, `SerialCode`
- `analytics`: `ClickEvent` (unified for links + QR + campaigns), `DailyStats`
- `campaigns`: `Campaign` (lifecycle, A/B variants), `Variant`
- `rules`: `Rule`, `RuleGroup`, `RuleCondition`
- `teams`: `Team`, `TeamMember` (owner/admin/editor/viewer), `TeamInvite`

**Auth**: JWT (15-min access, 7-day refresh) with rotation + blacklisting. Google OAuth2. API key auth with scopes.

**Middleware stack**: `RateLimitMiddleware` (Redis sliding window) > `SessionTrackingMiddleware` > `TeamContextMiddleware`.

**Async processing**: Celery + Beat with Redis broker. 13+ scheduled tasks for analytics aggregation, link cleanup, domain verification, campaign status updates, Stripe sync.

**Analytics pipeline**: Click > Redis counter (5-min sync) > `ClickEvent` row > hourly/daily aggregation via Celery Beat > pre-computed `DailyStats`.

**Quota system**: Cumulative per billing period — deleting links/QR codes does NOT restore quota count.

**Testing**: pytest + pytest-django, factory-boy, faker, responses, freezegun. Tests in `tests/` with `conftest.py` and `factories.py`.

**API docs**: drf-spectacular at `/api/docs/` (Swagger) and `/api/redoc/`.

**Health checks**: `/health/`, `/ready/` (DB + Redis + Celery), `/live/`, `/metrics/`.