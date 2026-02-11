# TinlyLink Backend

A production-ready URL shortener and advanced QR code generator API built with Django REST Framework.

## Features

- 🔗 **URL Shortening**: Create short, memorable links with custom slugs
- 📊 **Advanced Analytics**: Track clicks, geography, devices, referrers, real-time stats
- 📱 **QR Code Generation**: 16 QR types, custom styles, frames, gradients, eye styling, logo support
- 🏷️ **Serial Batches**: Generate unique batch QR codes for products/inventory
- 🎯 **Campaign Management**: UTM parameters and campaign tracking
- 📋 **Rules Engine**: Conditional routing based on time, location, device, and more
- 👥 **Team Collaboration**: Multi-user workspaces with roles and permissions
- 💳 **Stripe Billing**: Subscription management with Pro/Business tiers
- 🔐 **Security**: JWT authentication, Google Login, API keys, rate limiting
- 📧 **Email Notifications**: SendGrid integration for transactional emails
- 🛑 **Strict Quotas**: "No-Decrement" quota logic (deletions do not restore limits)
- 🚀 **Production Ready**: Docker, health checks, monitoring, backups

## Tech Stack

- **Framework**: Django 5.1 + Django REST Framework
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Task Queue**: Celery with Beat scheduler
- **Authentication**: JWT + API Keys
- **Payments**: Stripe
- **Email**: SendGrid
- **Monitoring**: Sentry
- **Documentation**: OpenAPI/Swagger (drf-spectacular)

## Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and setup environment**
```bash
git clone https://github.com/yourusername/linkshort.git
cd linkshort

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Setup database**
```bash
# Start PostgreSQL and Redis (if using Docker)
docker compose up -d db redis

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

4. **Start development server**
```bash
python manage.py runserver
```

5. **Start Celery worker (in another terminal)**
```bash
celery -A config worker -l info
```

6. **Start Celery Beat (in another terminal)**
```bash
celery -A config beat -l info
```

### Docker Deployment

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

## API Documentation

Once running, access the API documentation:

- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/api/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/` | Register new user |
| POST | `/api/v1/auth/login/` | Login and get tokens |
| POST | `/api/v1/auth/logout/` | Logout (blacklist token) |
| POST | `/api/v1/auth/refresh/` | Refresh access token |
| GET | `/api/v1/auth/me/` | Get current user |
| POST | `/api/v1/auth/forgot-password/` | Request password reset |
| POST | `/api/v1/auth/reset-password/` | Reset password |
| POST | `/api/v1/auth/verify-email/` | Verify email |
| POST | `/api/v1/auth/resend-verification/` | Resend verification email |
| POST | `/api/v1/auth/google/` | Login with Google |

### Account
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/account/profile/` | Get profile |
| PATCH | `/api/v1/account/profile/` | Update profile |
| POST | `/api/v1/account/password/` | Change password |
| GET | `/api/v1/account/usage/` | Get usage statistics |
| POST | `/api/v1/account/delete/` | Delete account |
| GET | `/api/v1/account/api-keys/` | List API keys |
| POST | `/api/v1/account/api-keys/` | Create API key |
| GET | `/api/v1/account/api-keys/{id}/` | Get API key details |
| DELETE | `/api/v1/account/api-keys/{id}/` | Delete API key |
| POST | `/api/v1/account/api-keys/{id}/regenerate/` | Regenerate API key |
| GET | `/api/v1/account/notifications/` | Get notification settings |
| PATCH | `/api/v1/account/notifications/` | Update notification settings |
| GET | `/api/v1/account/sessions/` | List active sessions |
| DELETE | `/api/v1/account/sessions/{id}/` | Revoke session |
| POST | `/api/v1/account/sessions/revoke-all/` | Revoke all other sessions |
| GET | `/api/v1/account/export/` | Export user data (GDPR) |

### Links
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/links/` | List user's links |
| POST | `/api/v1/links/` | Create new link |
| POST | `/api/v1/links/public/` | Create public link (limited) |
| GET | `/api/v1/links/{id}/` | Get link details |
| PATCH | `/api/v1/links/{id}/` | Update link |
| DELETE | `/api/v1/links/{id}/` | Delete link |
| GET | `/api/v1/links/{id}/stats/` | Get link statistics |
| POST | `/api/v1/links/{id}/duplicate/` | Duplicate link |
| POST | `/api/v1/links/bulk/` | Bulk create links |
| POST | `/api/v1/links/bulk/delete/` | Bulk delete links |
| POST | `/api/v1/links/bulk/move/` | Bulk move links to campaign |
| POST | `/api/v1/links/bulk/export/` | Bulk export specific links |
| GET | `/api/v1/links/export/` | Export all links (CSV/JSON) |
| POST | `/api/v1/links/import/` | Import links from CSV |
| GET | `/api/v1/links/import/template/` | Download import template |

### Custom Domains
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/links/domains/` | List custom domains |
| POST | `/api/v1/links/domains/` | Create custom domain |
| GET | `/api/v1/links/domains/{id}/` | Get custom domain |
| POST | `/api/v1/links/domains/{id}/verify/` | Verify DNS records |

### QR Codes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/qr-codes/` | List QR codes |
| POST | `/api/v1/qr-codes/` | Create QR code |
| GET | `/api/v1/qr-codes/{id}/` | Get QR code |
| PATCH | `/api/v1/qr-codes/{id}/` | Update QR code |
| DELETE | `/api/v1/qr-codes/{id}/` | Delete QR code |
| GET | `/api/v1/qr-codes/{id}/download/` | Download QR image |
| GET | `/api/v1/qr-codes/{id}/framed/` | Download framed QR |
| POST | `/api/v1/qr-codes/preview/` | Preview QR code |
| POST | `/api/v1/qr-codes/batch/download/` | Batch download QR codes |

#### QR Code Types
Supports 16 QR types: `link`, `vcard`, `wifi`, `email`, `sms`, `phone`, `text`, `calendar`, `location`, `upi`, `pix`, `product`, `menu`, `document`, `pdf`, `multi_url`, `app_store`, `social`, `serial`

#### Styling Options
- **Styles**: square, dots, rounded, diamond, star
- **Frames**: 12 frame types (none, simple, scan_me, balloon, badge, phone, polaroid, laptop, ticket, card, tag, certificate)
- **Eye Styles**: square, circle, rounded, leaf, diamond
- **Gradients**: Vertical, horizontal, diagonal, radial directions
- **Colors**: Custom foreground, background, and eye colors
- **Logo**: Upload custom logo with automatic excavation

### Serial Batches
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/qr-codes/serial-batches/` | List serial batches |
| POST | `/api/v1/qr-codes/serial-batches/` | Create serial batch |
| GET | `/api/v1/qr-codes/serial-batches/{id}/` | Get batch details |
| GET | `/api/v1/qr-codes/serial-batches/{id}/progress/` | Get generation progress |
| POST | `/api/v1/qr-codes/serial-batches/{id}/start/` | Start batch generation |
| POST | `/api/v1/qr-codes/serial-batches/{id}/cancel/` | Cancel batch |
| GET | `/api/v1/qr-codes/serial-batches/{id}/download/` | Download batch ZIP |
| GET | `/api/v1/qr-codes/serial-batches/{id}/stats/` | Get batch statistics |
| GET | `/api/v1/qr-codes/serial-batches/{id}/codes/` | List batch codes |

### Serial Codes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/qr-codes/serial-codes/{id}/` | Get serial code |
| PATCH | `/api/v1/qr-codes/serial-codes/{id}/status/` | Update code status |
| GET | `/api/v1/qr-codes/serial-codes/lookup/` | Lookup code by value |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/overview/` | Overview stats |
| GET | `/api/v1/analytics/clicks/` | Click timeline |
| GET | `/api/v1/analytics/geography/` | Geographic breakdown |
| GET | `/api/v1/analytics/devices/` | Device breakdown |
| GET | `/api/v1/analytics/referrers/` | Referrer breakdown |
| GET | `/api/v1/analytics/realtime/` | Real-time activity |
| GET | `/api/v1/analytics/compare/` | Compare performance |
| GET | `/api/v1/analytics/top-links/` | Top performing links |
| GET | `/api/v1/analytics/export/` | Export analytics data |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/campaigns/` | List campaigns |
| POST | `/api/v1/campaigns/` | Create campaign |
| POST | `/api/v1/campaigns/compare/` | Compare campaigns |
| GET | `/api/v1/campaigns/templates/` | UTM templates |
| GET | `/api/v1/campaigns/{id}/` | Get campaign |
| PATCH | `/api/v1/campaigns/{id}/` | Update campaign |
| DELETE | `/api/v1/campaigns/{id}/` | Delete campaign |
| GET | `/api/v1/campaigns/{id}/links/` | List campaign links |
| GET | `/api/v1/campaigns/{id}/stats/` | Campaign statistics |

### Rules Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/rules/` | List rules |
| POST | `/api/v1/rules/` | Create rule |
| GET | `/api/v1/rules/{id}/` | Get rule details |
| PATCH | `/api/v1/rules/{id}/` | Update rule |
| DELETE | `/api/v1/rules/{id}/` | Delete rule |
| POST | `/api/v1/rules/{id}/toggle/` | Toggle rule active status |
| POST | `/api/v1/rules/reorder/` | Reorder rule priority |
| GET | `/api/v1/rules/link/{id}/` | List rules for link |
| GET | `/api/v1/rules/qr-code/{id}/` | List rules for QR code |
| GET | `/api/v1/rules/groups/` | List rule groups |
| POST | `/api/v1/rules/groups/` | Create rule group |
| GET | `/api/v1/rules/groups/{id}/` | Get rule group |
| DELETE | `/api/v1/rules/groups/{id}/` | Delete rule group |
| POST | `/api/v1/rules/test/` | Test rules engine |
| GET | `/api/v1/rules/stats/` | Get rules statistics |

### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/teams/` | List user's teams |
| POST | `/api/v1/teams/` | Create team |
| GET | `/api/v1/teams/{id}/` | Get team details |
| PATCH | `/api/v1/teams/{id}/` | Update team |
| DELETE | `/api/v1/teams/{id}/` | Delete team |
| GET | `/api/v1/teams/{id}/members/` | List team members |
| PATCH | `/api/v1/teams/{id}/members/{member_id}/` | Update member role |
| DELETE | `/api/v1/teams/{id}/members/{member_id}/` | Remove member |
| GET | `/api/v1/teams/{id}/invites/` | List pending invites |
| POST | `/api/v1/teams/{id}/invites/` | Create invite |
| POST | `/api/v1/teams/{id}/invites/{invite_id}/revoke/` | Revoke invite |
| POST | `/api/v1/teams/invites/accept/{token}/` | Accept invite |
| GET | `/api/v1/teams/my-teams/` | List all user's teams |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/billing/` | Billing overview |
| POST | `/api/v1/billing/checkout/` | Create checkout session |
| POST | `/api/v1/billing/portal/` | Create portal session |
| POST | `/api/v1/billing/webhook/` | Stripe webhook |

## Configuration

### Environment Variables

See `.env.example` for all available options:

```bash
# Required
DJANGO_SECRET_KEY=your-secret-key
DATABASE_URL=postgres://user:pass@host:5432/db
REDIS_URL=redis://localhost:6379/0

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# SendGrid (for emails)
SENDGRID_API_KEY=SG.xxx
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id

# Optional
SENTRY_DSN=https://xxx@sentry.io/xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### Plan Limits

Configure in `config/settings.py`.
> **Note**: Quota limits are **cumulative** per billing period. Deleting links or QR codes does **not** restore the quota count.

```python
PLAN_LIMITS = {
    "free": {
        "links_per_month": 50,
        "qr_codes_per_month": 10,
        "custom_domains": 0,
        "custom_slugs": False,
    },
    "pro": {
        "links_per_month": 500,
        "qr_codes_per_month": 100,
        "custom_domains": 1,
        "custom_slugs": True,
    },
    "business": {
        "links_per_month": -1,  # Unlimited
        "qr_codes_per_month": -1,
        "custom_domains": 5,
        "custom_slugs": True,
    },
}
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=apps --cov-report=html

# Run specific test file
pytest tests/test_links/test_links.py

# Run specific test
pytest tests/test_links/test_links.py::TestLinkCreation::test_create_link_success
```

## Deployment

### Using Deploy Script

```bash
# Production deployment
./scripts/deploy.sh production deploy

# Check status
./scripts/deploy.sh production status

# View logs
./scripts/deploy.sh production logs

# Rollback
./scripts/deploy.sh production rollback
```

### Manual Deployment

```bash
# Build and start containers
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api python manage.py migrate

# Collect static files
docker compose -f docker-compose.prod.yml exec api python manage.py collectstatic --noinput
```

### Database Backup

```bash
# Create backup
./scripts/backup.sh backup

# List backups
./scripts/backup.sh list

# Restore backup
./scripts/backup.sh restore linkshort_20240115_120000.sql.gz
```

## Monitoring

### Health Checks

- `/health/` - Basic health check (for load balancers)
- `/ready/` - Readiness check (verifies DB, Redis, Celery)
- `/live/` - Liveness check (for Kubernetes)
- `/metrics/` - Prometheus-compatible metrics

### Celery Tasks

Scheduled tasks (via Celery Beat):

| Task | Schedule | Description |
|------|----------|-------------|
| `aggregate_hourly_stats` | Every hour at :05 | Aggregate click stats |
| `aggregate_daily_stats` | Daily at 00:15 | Generate daily stats |
| `sync_click_counters` | Every 5 minutes | Sync Redis to DB |
| `cleanup_expired_links` | Every hour | Deactivate expired links |
| `cleanup_old_analytics` | Daily at 2:00 | Delete old click data |
| `verify_pending_domains` | Every 15 minutes | Check DNS records |
| `send_weekly_reports` | Monday at 9:00 | Send email reports |

## Security

- JWT tokens with 15-minute expiry
- Refresh token rotation with blacklisting
- API key authentication with scopes
- Rate limiting per endpoint and plan
- Password hashing with Argon2
- CORS configuration
- Security headers (HSTS, CSP, etc.)
- Stripe webhook signature verification

## Project Structure

```
backend/
├── apps/
│   ├── analytics/     # Click tracking and statistics
│   ├── billing/       # Stripe subscription management
│   ├── campaigns/     # Campaign and UTM management
│   ├── links/         # URL shortening and custom domains
│   ├── public/        # Public redirect handler
│   ├── qrcodes/       # QR code generation and serial batches
│   ├── rules/         # Rules engine for conditional routing
│   ├── teams/         # Team collaboration features
│   └── users/         # Authentication and user management
├── config/            # Django settings and configuration
├── scripts/           # Deployment and utility scripts
└── templates/         # Email and error templates
```

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.tinlylink.com
- Issues: https://github.com/DjangoWariors/TinlyLink/issues
- Email: support@tinlylink.com
