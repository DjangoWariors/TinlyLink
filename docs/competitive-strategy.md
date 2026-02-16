# TinlyLink Competitive Strategy Document

**Date:** February 2026
**Objective:** Make TinlyLink competitive with Bitly, Linktree, Dub.co, Rebrandly, Beacons.ai, and other link management platforms.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Competitor Analysis](#3-competitor-analysis)
4. [Gap Analysis](#4-gap-analysis)
5. [Strategic Roadmap](#5-strategic-roadmap)
6. [Phase 1: Foundation Fixes (Weeks 1-3)](#6-phase-1-foundation-fixes)
7. [Phase 2: Bio Page Upgrades (Weeks 4-6)](#7-phase-2-bio-page-upgrades)
8. [Phase 3: Landing Page Overhaul (Weeks 7-10)](#8-phase-3-landing-page-overhaul)
9. [Phase 4: Analytics & Attribution (Weeks 11-14)](#9-phase-4-analytics--attribution)
10. [Phase 5: Growth & Differentiation (Weeks 15-20)](#10-phase-5-growth--differentiation)
11. [Pricing Strategy](#11-pricing-strategy)
12. [Go-to-Market Priorities](#12-go-to-market-priorities)

---

## 1. Executive Summary

TinlyLink already has a solid foundation: URL shortening, QR codes, bio pages, landing pages, team support, and an API. However, to compete with established players, we need to close critical gaps in bio page customization, landing page sophistication, analytics depth, and conversion tracking.

**Our competitive edge:** TinlyLink is one of the very few platforms that combines URL shortening + QR codes + bio pages + landing pages + team collaboration in a single product. Bitly is the only major competitor with this breadth, and they charge $199+/month for full access.

**Strategic position:** Mid-market all-in-one link platform -- more powerful than Linktree, more affordable than Bitly, more user-friendly than Dub.co.

---

## 2. Current State Assessment

### What We Have (Functional)

| Feature | Status | Quality |
|---|---|---|
| URL Shortening | Complete | Good -- nanoid codes, UTM, password, expiry |
| QR Codes | Complete | Good -- 16 content types, styling, serial batches |
| Bio Pages | Complete | Basic -- 5 themes, social links, link management |
| Landing Pages | Complete | Basic -- 5 block types, form capture, SEO |
| Analytics | Partial | Click tracking exists, visualization missing |
| Teams | Complete | Good -- 4 roles, team switching |
| API | Complete | Good -- API keys with scopes |
| Campaigns | Complete | A/B testing, variants |
| Rules Engine | Complete | Conditional redirects |

### What's Broken or Missing

| Issue | Impact |
|---|---|
| Landing page analytics not visualized in dashboard | Users can't see page performance |
| Template gallery UI empty (no templates seeded) | First-run experience is poor |
| Plan quota enforcement missing in views | Users can exceed limits |
| Bio page public rendering is plain HTML | Looks outdated vs. Linktree |
| Only 5 landing page block types | Can't build real marketing pages |
| No conversion tracking beyond form submissions | Can't prove ROI |
| No native integrations | Isolated from user workflows |
| No custom domains for bio/landing pages | Unprofessional look |
| No email capture or newsletter integration | Huge missed opportunity |
| No scheduled publishing | Basic feature competitors offer |
| No embeddable widgets | Limits distribution |

---

## 3. Competitor Analysis

### Competitor Positioning Map

```
                    HIGH PRICE
                        |
            Bitly       |
            Enterprise  |       Later
                        |
   LINK-FOCUSED --------+-------- CREATOR-FOCUSED
                        |
        Dub.co    Short.io  Linktree
        Rebrandly       |       Beacons.ai
                        |
                    LOW PRICE

    TinlyLink Target: Center -- all-in-one at mid-market price
```

### Key Competitor Strengths

| Competitor | Their Moat | What They Lack |
|---|---|---|
| **Bitly** | Brand, scale, 800+ integrations, Fortune 500 trust | Expensive, limited free tier, no conversion tracking |
| **Linktree** | 50M+ creators, simplicity, commerce | No URL shortening, no QR codes, no landing pages |
| **Dub.co** | Open source, conversion attribution, developer API | No bio pages, no landing pages, developer-only |
| **Rebrandly** | Best branded links, API throughput (100K/sec) | No landing pages, basic bio pages |
| **Beacons.ai** | Creator monetization, digital store, AI tools | No URL shortening, no QR codes, no teams |
| **Short.io** | Generous free tier, strong API, retargeting pixels | No bio pages, no landing pages |
| **Later** | Social media scheduling integration | No free plan, narrow scope |

### Feature Comparison: TinlyLink vs. Market

| Feature | TinlyLink | Bitly | Linktree | Dub.co | Beacons |
|---|---|---|---|---|---|
| URL Shortening | Yes | Yes | No | Yes | No |
| Branded/Custom Domains | Partial | Yes | No | Yes | Yes |
| Bio Pages | Basic | Basic | Advanced | No | Advanced |
| Landing Pages | Basic | Basic | No | No | Basic |
| QR Codes | Advanced | Advanced | Basic | Included | No |
| Click Analytics | Yes | Advanced | Basic | Advanced | Good |
| Conversion Tracking | No | Shopify only | Sales | Best | Sales |
| A/B Testing | Yes | No | No | No | No |
| Rules/Smart Redirects | Yes | No | No | Yes | No |
| Team Collaboration | Yes | Yes | Limited | Yes | No |
| API | Yes | Yes | Early | Yes | No |
| Commerce/Store | No | No | Yes | No | Yes |
| Integrations | None | 800+ | Growing | Stripe | Limited |
| Serial/Bulk QR | Yes | Yes | No | No | No |
| Campaign Management | Yes | No | No | No | No |

**TinlyLink's unique advantage:** We're the only platform with URL shortening + advanced QR codes + bio pages + landing pages + A/B testing + rules engine + team collaboration combined. No single competitor matches this breadth.

---

## 4. Gap Analysis

### Critical Gaps (Must Fix to Compete)

1. **Bio page public rendering is unpolished** -- Linktree and Beacons pages look modern with animations, gradients, and rich media. Our server-rendered bio pages look like 2018.
2. **Only 5 landing page blocks** -- Can't build real marketing pages. Need pricing tables, testimonials, countdown timers, video embeds, galleries.
3. **No conversion tracking** -- Competitors are moving beyond clicks. Without knowing what happens after the click, we can't compete for business customers.
4. **No native integrations** -- Zero integrations means users must manually export everything. Bitly has 800+.
5. **Analytics dashboard for pages is missing** -- We track views/conversions but don't display them.

### Important Gaps (Need for Growth)

6. **No email/newsletter capture** -- Linktree and Beacons capture emails natively.
7. **No scheduled link/page publishing** -- Basic feature everyone expects.
8. **No custom fonts or advanced theming** -- Bio pages look generic.
9. **No embed blocks** (video, podcast, social posts) -- Modern bio pages embed rich media.
### Nice-to-Have Gaps (Differentiation)

10. **No commerce/monetization** -- Digital product sales, tipping, affiliate links.
11. **No dark mode** for dashboard -- Expected in 2026.

---

## 5. Strategic Roadmap

### 5-Month Plan (20 Weeks)

```
Phase 1: Foundation Fixes          [Weeks 1-3]    -- Fix broken things
Phase 2: Bio Page Upgrades         [Weeks 4-6]    -- Match Linktree quality
Phase 3: Landing Page Overhaul     [Weeks 7-10]   -- Beat Bitly Pages
Phase 4: Analytics & Attribution   [Weeks 11-14]  -- Track conversions
Phase 5: Growth & Differentiation  [Weeks 15-20]  -- Integrations, API, commerce
```

---

## 6. Phase 1: Foundation Fixes (Weeks 1-3)

**Goal:** Fix everything that's broken or obviously incomplete.

### 1.1 Enforce Plan Quotas
- Add quota checks in bio page and landing page create views
- Return clear error messages when limits are reached
- Show upgrade prompts in frontend when approaching limits

### 1.2 Seed Landing Page Templates
- Create 8-10 starter templates in the database:
  - Product Launch
  - Coming Soon
  - Event Registration
  - Newsletter Signup
  - App Download
  - Webinar Registration
  - Lead Capture
  - Portfolio Showcase
- Each template pre-populates blocks and settings
- Build the template gallery UI (currently empty)

### 1.3 Add Page Analytics Dashboard
- Create analytics views for bio pages and landing pages
- Show: views over time, top referrers, device breakdown, geographic data
- For landing pages: conversion rate chart, form submission timeline
- Reuse existing `ClickEvent` and `DailyStats` infrastructure

### 1.4 Fix Bio Page Public Rendering
- Improve the server-rendered template with modern CSS:
  - Smooth animations on link hover
  - Better typography (Google Fonts integration)
  - Proper gradient rendering
  - Social link icons (not text links)
  - Loading animation
  - Mobile-optimized with proper viewport

### 1.5 Landing Page Form Validation
- Add backend validation for required form fields
- Return proper error responses
- Add honeypot field for spam prevention
- Add rate limiting per IP (already have middleware)

---

## 7. Phase 2: Bio Page Upgrades (Weeks 4-6)

**Goal:** Make bio pages competitive with Linktree and Beacons.

### 2.1 Advanced Theming System
- **Custom fonts:** Add 20+ Google Font options (model field + template rendering)
- **10+ new themes:** Neon, Pastel, Earth, Ocean, Sunset, Mono, etc.
- **Background images/patterns:** Upload or URL, with overlay opacity
- **Animated backgrounds:** Subtle CSS animations (floating particles, gradient shifts)
- **Custom CSS field** (Pro plan): Power users can inject their own styles

### 2.2 Rich Media Blocks
Bio pages should support more than just links. Add block types:
- **Header block:** Section headers with customizable size
- **Text block:** Rich text paragraphs
- **Image block:** Full-width or card-style images
- **Video embed:** YouTube, Vimeo, TikTok (iframe embed)
- **Music embed:** Spotify, Apple Music, SoundCloud
- **Social embed:** Instagram post, Tweet, TikTok video
- **Divider block:** Visual separator
- **Email capture block:** Inline email signup form

### 2.3 Link Enhancements
- **Link thumbnails:** Image preview on each link
- **Link animations:** Hover effects (shake, glow, slide)
- **Scheduled links:** Show/hide based on date range
- **Priority/pinned links:** Pin important links to top
- **Link groups:** Organize links under collapsible headers

### 2.4 Social Link Icons
- Replace text social links with proper SVG icons
- Support 20+ platforms: Twitter/X, Instagram, LinkedIn, YouTube, TikTok, GitHub, Twitch, Discord, Threads, Bluesky, Mastodon, Snapchat, Pinterest, Spotify, Apple Music, Telegram, WhatsApp, Website, Email, Phone
- Configurable icon style: filled, outlined, monochrome

### 2.5 Bio Page Analytics
- View count over time (chart)
- Link click-through rates
- Top performing links
- Visitor device/browser/location breakdown
- Referrer sources (Instagram, Twitter, direct, etc.)

### 2.6 Custom Domain Support
- Allow users to serve bio pages on their own domain (e.g., `links.yourbrand.com`)
- CNAME/A record verification flow
- SSL provisioning via Let's Encrypt
- Already have `CustomDomain` model in links app -- extend to bio pages

---

## 8. Phase 3: Landing Page Overhaul (Weeks 7-10)

**Goal:** Build a landing page builder that rivals dedicated tools.

### 3.1 New Block Types (Priority Order)

| Block | Purpose | Competitor Status |
|---|---|---|
| **Pricing Table** | 2-4 column pricing comparison | Rare -- big differentiator |
| **Testimonial** | Customer quotes with avatar/name/title | Common in page builders |
| **Countdown Timer** | Urgency for launches/events | Uncommon in link tools |
| **Video Embed** | YouTube/Vimeo with optional autoplay | Expected |
| **FAQ/Accordion** | Expandable Q&A section | Common |
| **Feature Grid** | 3-6 feature cards with icons | Common |
| **Stats/Numbers** | Animated counters (e.g., "10K+ users") | Moderate |
| **Logo Carousel** | Partner/client logos | Common |
| **Social Proof** | "Trusted by X companies" with logos | Growing trend |
| **Gallery/Carousel** | Image gallery with lightbox | Expected |
| **Embed** | Generic iframe/HTML embed | Power user feature |
| **Divider/Spacer** | Layout control | Expected |
| **Navigation/Anchor** | Jump links within the page | Useful for long pages |
| **Map** | Google Maps embed | Niche but valuable |
| **Newsletter Signup** | Email capture (separate from form) | High demand |

### 3.2 Drag-and-Drop Improvements
- Visual drag handles (current up/down buttons feel outdated)
- Use `dnd-kit` or `react-beautiful-dnd` for proper drag-and-drop
- Block copy/paste across pages
- Undo/redo support (Ctrl+Z)
- Block grouping (sections containing multiple blocks)

### 3.3 Template System Overhaul
- **Template categories:** Marketing, Events, Portfolio, SaaS, E-commerce, Non-profit
- **Template preview:** Full-page preview before selecting
- **Template marketplace (future):** Community-submitted templates
- **Quick start wizard:** Ask user their goal, suggest templates

### 3.4 Advanced Form Features
- **Multi-step forms** (wizard-style)
- **File upload field**
- **Payment field** (Stripe integration for paid forms)
- **Form submission email notifications** (configurable recipient)
- **Auto-responder emails** (send confirmation to submitter)
- **Google Sheets integration** (auto-append rows)
- **Spam protection:** reCAPTCHA or hCaptcha option

### 3.5 Page-Level Features
- **A/B testing for pages:** Show variant A vs. B, track conversion rates
- **Scheduled publishing:** Publish/unpublish at specific date/time
- **Password protection** for pages
- **Custom favicon** per page
- **Exit-intent popup** (capture leads before leaving)
- **Announcement bar** (sticky top banner)
- **Live chat widget embed** (Crisp, Intercom script injection)

### 3.6 Mobile-First Preview
- Side-by-side desktop and mobile preview in builder
- Responsive block settings (different padding/sizing per breakpoint)
- Google Mobile-Friendly Test integration

---

## 9. Phase 4: Analytics & Attribution (Weeks 11-14)

**Goal:** Go beyond click counting. This is where we beat most competitors.

### 4.1 Unified Analytics Dashboard
- Single dashboard showing all assets: links, QR codes, bio pages, landing pages
- Date range picker with presets (7d, 30d, 90d, custom)
- Exportable reports (CSV, PDF)

### 4.2 Deep Click Analytics
Current tracking already captures most data. Surface it in the UI:
- **Geographic heatmap** (clickable, drill-down by country/city)
- **Device/browser/OS breakdown** (pie charts)
- **Referrer analysis** (where traffic comes from)
- **Time-of-day heatmap** (when users click)
- **Click trends** (line chart with comparison periods)
- **Top performing links** (sortable table)
- **Unique vs. total clicks** distinction

### 4.3 Conversion Tracking
This is the #1 differentiator opportunity. Dub.co charges $49/month for this.

**Implementation approach:**
- Provide a JavaScript pixel/snippet users add to their thank-you page
- When someone clicks a TinlyLink > visits destination > reaches thank-you page, the pixel fires back to our API
- Match click sessions to conversions via first-party cookie or URL parameter
- Track: signups, purchases, form fills, any custom event
- Show conversion funnel: Clicks > Page Views > Conversions
- Calculate conversion rate per link, campaign, and channel

**Conversion pixel example:**
```html
<script src="https://tinlylink.com/pixel.js" data-key="YOUR_KEY"></script>
<script>tinly.track('purchase', { value: 49.99 });</script>
```

### 4.4 UTM Analytics
- Auto-detect and parse UTM parameters from destination URLs
- Show performance breakdown by: utm_source, utm_medium, utm_campaign
- UTM builder in link creation flow (already exists -- enhance UI)

### 4.5 Real-Time Analytics
- WebSocket-based live click counter
- Useful during launches, events, campaign rollouts
- Show "X people clicked in the last hour" on link detail page

### 4.6 Scheduled Reports
- Weekly/monthly email digests with key metrics
- Configurable: which assets, which metrics, which recipients
- PDF attachment with charts

---

## 10. Phase 5: Growth & Differentiation (Weeks 15-20)

**Goal:** Add integrations, improve the API, and build unique differentiators.

### 5.1 Native Integrations (Priority)
Build direct integrations for highest-impact tools:

| Integration | Type | Value |
|---|---|---|
| **Google Analytics 4** | Analytics | Track TinlyLink events in GA4 |
| **Google Sheets** | Form data | Auto-append form submissions |
| **Slack** | Notifications | Alert on form submissions, milestones |
| **Mailchimp/Brevo** | Email | Add form email captures to lists |
| **Stripe** | Commerce | Conversion tracking for purchases |
| **WordPress** | Plugin | Embed bio page, auto-shorten post links |
| **Shopify** | E-commerce | Product link shortening, conversion tracking |

### 5.2 API v2 Improvements
Current API is functional. Enhance for developer adoption:
- **OpenAPI/Swagger docs** (already have drf-spectacular -- publish publicly)
- **TypeScript SDK** (auto-generated from OpenAPI spec)
- **Python SDK** (auto-generated from OpenAPI spec)
- **Bulk operations endpoint** (create 100+ links in one call)
- **Rate limit headers** (X-RateLimit-Remaining, X-RateLimit-Reset)
- **API changelog** (version history and migration guides)

### 5.3 Import/Export Tools
- **Import from Bitly:** CSV import with mapping wizard
- **Import from Linktree:** Scrape existing bio page and recreate
- **Bulk link import:** CSV/Excel upload with column mapping
- **Bulk QR code export:** ZIP download with naming convention
- **Account data export:** GDPR-compliant full data download

### 5.4 Custom Domains (Full)
- Custom domain for short links (existing)
- Custom domain for bio pages (new)
- Custom domain for landing pages (new)
- Wildcard SSL certificate provisioning
- DNS verification wizard in UI
- CNAME setup instructions with copy-paste values

### 5.5 Embeddable Widgets
- **Link widget:** Embeddable shortened link with click counter
- **QR code widget:** Embed dynamic QR code on any site
- **Bio page widget:** Embed mini bio page in sidebar/footer
- JavaScript snippet with customizable styling

### 5.6 Link-in-Bio Commerce (Differentiator)
Following Linktree and Beacons, but integrated with our link platform:
- **Digital product sales:** Sell PDFs, courses, downloads directly from bio page
- **Tip jar:** Accept one-time payments via Stripe
- **Affiliate links:** Track affiliate clicks and commissions
- **Discount codes:** Time-limited promo codes for links
- **Product link cards:** Rich product previews with price, image, buy button

### 5.7 Advanced Redirect Rules
Expand the existing rules engine:
- **Time-based redirects:** Different destination by time of day or day of week
- **A/B split redirects:** 50/50 split to different URLs (simpler than full A/B testing)
- **Sequential redirects:** First 100 clicks go to URL A, rest go to URL B
- **Referrer-based redirects:** Instagram traffic to one page, Twitter to another
- **Language-based redirects:** Auto-detect browser language, redirect accordingly
- **Cookie-based redirects:** Returning vs. new visitors see different content
- **Rotation redirects:** Cycle through multiple destination URLs

### 5.8 Collaboration Enhancements
- **Comments on links/pages:** Team discussion per asset
- **Approval workflows:** Editor creates, admin approves before publish
- **Activity log:** Full audit trail of who changed what
- **Shared link collections:** Organize links into shareable folders

---

## 11. Pricing Strategy

### Current Market Pricing Reference

| Platform | Free | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| Bitly | $0 (5 links) | $10/mo | $29/mo | $199/mo | Custom |
| Linktree | $0 | $5/mo | $9/mo | $24/mo | -- |
| Dub.co | $0 (25 links) | -- | $25/mo | $49/mo | Custom |
| Rebrandly | $0 | $13/mo | -- | Custom | Custom |
| Beacons | $0 | $10/mo | $30/mo | $90/mo | -- |
| Short.io | $0 (1K links) | $20/mo | $50/mo | -- | Custom |

### Recommended TinlyLink Pricing

**Position: More features than Linktree, cheaper than Bitly.**

| Plan | Price | Target | Key Limits |
|---|---|---|---|
| **Free** | $0/mo | Individual users trying the platform | 25 links/mo, 2 QR codes, 1 bio page, 0 landing pages, 30-day analytics |
| **Starter** | $9/mo | Creators, freelancers, small businesses | 200 links/mo, 25 QR codes, 3 bio pages, 2 landing pages, 1 custom domain, 90-day analytics |
| **Pro** | $29/mo | Growing businesses, marketers | Unlimited links, unlimited QR codes, 10 bio pages, 10 landing pages, 5 custom domains, 1-year analytics, A/B testing, rules engine, conversion tracking, API access |
| **Business** | $79/mo | Agencies, teams, mid-market | Everything in Pro + unlimited pages, 20 custom domains, team features (10 members), priority support, 2-year analytics, advanced integrations |
| **Enterprise** | Custom | Large organizations | Unlimited everything, SSO/SAML, SLA, dedicated support, custom integrations |

**Key pricing principles:**
- Free tier must be generous enough to hook users (better than Bitly's 5 links)
- Pro plan is the conversion target -- pack it with value at $29 (same as Bitly Growth but with more features)
- Business plan captures agency/team revenue at less than half of Bitly Premium
- Annual billing: 20% discount (show monthly equivalent)

---

## 12. Go-to-Market Priorities

### Target Audiences (In Priority Order)

1. **Small business owners** -- Need link shortening + bio page + QR codes for print marketing. Currently use 3 separate tools.
2. **Digital marketers** -- Need branded links, UTM tracking, A/B testing, conversion tracking. Price-sensitive vs. Bitly.
3. **Content creators** -- Need bio pages for social media. Evaluate against Linktree. Win with built-in QR codes + landing pages.
4. **Agencies** -- Need team features, client management. High LTV.
5. **Developers** -- Need API, automation. Evaluate against Dub.co. Win with more features out of the box.

### Marketing Messages

**vs. Bitly:** "Everything Bitly offers at a fraction of the price. URL shortening, QR codes, bio pages, and landing pages -- all in one platform starting at $9/month."

**vs. Linktree:** "Your link-in-bio, plus URL shortening, QR codes, landing pages, and real analytics. Stop paying for 4 different tools."

**vs. Dub.co:** "All the analytics power, plus bio pages, landing pages, QR codes, and a visual builder. No coding required."

**Unique pitch:** "The only platform that combines URL shortening, QR codes, bio pages, landing pages, A/B testing, and smart redirects in one dashboard."

### Quick Win Marketing Tactics

1. **Bitly migration tool:** Import links from Bitly CSV. Blog post: "Switching from Bitly? Here's how."
2. **Free QR code generator** (public, no login): SEO lead magnet, capture emails for upsell
3. **Template gallery** (public): Show landing page templates, require signup to use
4. **Comparison pages:** SEO-optimized pages: "TinlyLink vs Bitly", "TinlyLink vs Linktree"
5. **Creator partnerships:** Give 10 mid-tier creators free Pro accounts for 6 months in exchange for mentions

---

## Appendix A: Priority Feature Matrix

Features ranked by **impact** (how much it helps competitiveness) and **effort** (development time).

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| Fix bio page public rendering | High | Low | P0 |
| Seed landing page templates | High | Low | P0 |
| Add page analytics dashboard | High | Medium | P0 |
| Enforce plan quotas | High | Low | P0 |
| Bio page custom fonts | High | Low | P1 |
| Bio page rich media blocks | High | Medium | P1 |
| Social link SVG icons | Medium | Low | P1 |
| Video/embed blocks for landing pages | High | Medium | P1 |
| Pricing table block | High | Medium | P1 |
| Testimonial block | Medium | Low | P1 |
| Countdown timer block | Medium | Medium | P2 |
| Drag-and-drop with dnd-kit | Medium | Medium | P2 |
| Conversion tracking pixel | Very High | High | P2 |
| Google Sheets integration | High | Medium | P2 |
| Slack notifications | Medium | Low | P2 |
| Scheduled publishing | Medium | Low | P3 |
| Custom domains for pages | High | High | P3 |
| Commerce/digital products | High | Very High | P3 |
| Collaboration enhancements | Medium | Medium | P3 |
| Advanced redirect rules | Medium | Medium | P3 |

---

## Appendix B: Tech Stack Recommendations for New Features

| Feature | Recommended Tech |
|---|---|
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` (React) |
| Rich text editing | TipTap or Slate.js |
| Video embeds | `react-player` (supports YouTube, Vimeo, etc.) |
| Countdown timer | `date-fns` (already in stack) + CSS animation |
| Real-time analytics | Django Channels + WebSocket |
| Conversion pixel | Lightweight JS (<2KB) + beacon API |
| Email notifications | Django signals + Celery + SendGrid/SES |
| Google Sheets | Google Sheets API v4 + OAuth2 |
| Custom fonts | Google Fonts API (dynamic `<link>` injection) |
| Image upload | Django Storages + S3/Cloudflare R2 |
| Commerce/payments | Stripe Checkout + Stripe Connect |

---

## Appendix C: Competitive Monitoring

Track these metrics monthly:

- **Bitly** pricing page changes, new feature announcements (blog.bitly.com)
- **Linktree** product updates (linktr.ee/blog)
- **Dub.co** GitHub releases (github.com/dubinc/dub/releases)
- **Beacons.ai** new creator tools
- **G2/Capterra** reviews for all competitors (identify pain points to exploit)
- **Product Hunt** launches in link management category
- **Reddit** r/SaaS, r/marketing threads about link shorteners

---

*This document should be reviewed and updated quarterly as the competitive landscape evolves.*