'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useUser } from '@/firebase';
import { GA_MEASUREMENT_ID, setAnalyticsUser, trackEvent, trackPageView } from '@/lib/ga';

function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    trackPageView(pagePath, typeof document !== 'undefined' ? document.title : undefined, typeof window !== 'undefined' ? window.location.href : undefined);
  }, [pathname, searchParams]);

  return null;
}

function AnalyticsUserTracker() {
  const { user } = useUser();

  useEffect(() => {
    void setAnalyticsUser(user?.uid ?? null);
  }, [user?.uid]);

  return null;
}

function AnalyticsInteractionTracker() {
  useEffect(() => {
    const clickListener = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickTarget = target.closest('button, a, [data-analytics-event]') as HTMLElement | null;
      if (!clickTarget) return;

      const customEvent = clickTarget.getAttribute('data-analytics-event');
      if (customEvent) {
        trackEvent(customEvent, {
          element_id: clickTarget.id || undefined,
          page_path: window.location.pathname,
        });
        return;
      }

      const label = (clickTarget.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      const href = clickTarget instanceof HTMLAnchorElement ? clickTarget.getAttribute('href') : undefined;

      trackEvent('ui_click', {
        element_tag: clickTarget.tagName.toLowerCase(),
        element_id: clickTarget.id || undefined,
        element_label: label || undefined,
        href: href || undefined,
        page_path: window.location.pathname,
      });
    };

    const submitListener = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;

      trackEvent('form_submit', {
        form_id: form.id || undefined,
        form_name: form.getAttribute('name') || undefined,
        form_action: form.getAttribute('action') || undefined,
        page_path: window.location.pathname,
      });
    };

    document.addEventListener('click', clickListener, true);
    document.addEventListener('submit', submitListener, true);

    return () => {
      document.removeEventListener('click', clickListener, true);
      document.removeEventListener('submit', submitListener, true);
    };
  }, []);

  return null;
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true,
            transport_type: 'beacon'
          });
        `}
      </Script>
      <AnalyticsRouteTracker />
      <AnalyticsUserTracker />
      <AnalyticsInteractionTracker />
    </>
  );
}
