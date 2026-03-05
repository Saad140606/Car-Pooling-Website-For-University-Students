# GA4 + SEO Integration Guide

## GA4 Setup

- Measurement ID is configured in `src/lib/ga.ts` with fallback `G-8W1RSJZRFT`.
- Recommended override for environments:
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-8W1RSJZRFT`
- Global loader + SPA tracking lives in `src/components/analytics/GoogleAnalytics.tsx` and is mounted in `src/app/layout.tsx`.

## What is tracked automatically

- SPA page views (`page_view`) with:
  - `page_path`
  - `page_title`
  - `page_location`
- Duplicate protection for same route path in a single navigation state.
- Auto UI events:
  - `ui_click` for button/link clicks
  - `form_submit` for form submissions

## Key business events wired

- Auth:
  - `login`
  - `sign_up`
  - `password_reset_request`
- Rides:
  - `ride_booking` (ride created)
  - `ride_acceptance` (driver accept/reject + passenger confirm)
  - `ride_cancellation` (driver/passenger cancel)
  - `ride_completion`
  - `passenger_confirmation` (arrived/no-show review)
- Notifications:
  - `notifications_viewed`
  - `notification_feed_loaded`
- Feedback/contact:
  - `feedback_submit`
  - `feedback_submit_failed`

## Adding new analytics events

1. Import helper:

```ts
import { trackEvent } from '@/lib/ga';
```

2. Track inside your action handler:

```ts
trackEvent('your_event_name', {
  key: 'value',
  numeric_value: 1,
});
```

3. For custom click tracking in JSX, add:

```tsx
<button data-analytics-event="custom_button_click">...</button>
```

## User-level privacy-safe analytics

- `setAnalyticsUser` hashes Firebase UID with SHA-256 and stores it as `anonymous_user_id` in GA user properties.
- No raw user email is sent.

## SEO Keyword management

- Keyword + page mapping is centralized in `src/config/seo.ts`.
- Update `SEO_TARGET_KEYWORDS` to change target ranking terms.
- Update `SEO_PAGES` to map pages to titles, descriptions, and keywords.

## Indexing controls

- `src/app/robots.ts` controls crawl allow/disallow paths.
- `src/app/sitemap.ts` includes only SEO-targeted public pages.
- Private sections are set to noindex:
  - `src/app/auth/layout.tsx`
  - `src/app/dashboard/head.tsx`
  - `src/app/admin-dashboard/head.tsx`
  - `src/app/debug/head.tsx`

## Validation checklist before production

1. Open GA4 Realtime and navigate across routes; verify unique page_view events.
2. Use browser devtools Network tab and filter `collect?v=2` to inspect outgoing GA hits.
3. Verify no duplicate page_view on same route without route change.
4. Confirm private URLs show `noindex` meta and are disallowed in `robots.txt`.
5. Verify sitemap at `/sitemap.xml` contains only intended SEO pages.
