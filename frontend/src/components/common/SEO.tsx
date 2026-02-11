import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
}

const DEFAULT_TITLE = 'TinlyLink - URL Shortener & QR Code Generator';
const DEFAULT_DESCRIPTION = 'Shorten URLs, generate branded QR codes, and understand your audience with click analytics. Free to start, built for marketers, developers, and small businesses.';
const DEFAULT_IMAGE = '/og-image.png';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = 'url shortener, link shortener, qr code generator, link tracking, analytics, custom domains, branded links, tinlylink',
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | TinlyLink` : DEFAULT_TITLE;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const imageUrl = image.startsWith('http') ? image : `${typeof window !== 'undefined' ? window.location.origin : ''}${image}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update meta tags
    const metaTags: Record<string, string> = {
      description,
      keywords,
      'og:title': fullTitle,
      'og:description': description,
      'og:image': imageUrl,
      'og:url': currentUrl,
      'og:type': type,
      'twitter:card': 'summary_large_image',
      'twitter:title': fullTitle,
      'twitter:description': description,
      'twitter:image': imageUrl,
    };

    if (noIndex) {
      metaTags['robots'] = 'noindex, nofollow';
    }

    Object.entries(metaTags).forEach(([name, content]) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.querySelector(`meta[property="${name}"]`) as HTMLMetaElement;
      }
      
      if (!meta) {
        meta = document.createElement('meta');
        if (name.startsWith('og:') || name.startsWith('twitter:')) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    });

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);

    // Cleanup on unmount
    return () => {
      // Reset to defaults when component unmounts
      document.title = DEFAULT_TITLE;
    };
  }, [fullTitle, description, keywords, imageUrl, currentUrl, type, noIndex]);

  return null;
}

// Structured data component for SEO
interface StructuredDataProps {
  type: 'Organization' | 'WebApplication' | 'BreadcrumbList';
  data: Record<string, unknown>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': type,
      ...data,
    });
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [type, data]);

  return null;
}

// Default structured data for the app
export function AppStructuredData() {
  return (
    <StructuredData
      type="WebApplication"
      data={{
        name: 'TinlyLink',
        description: DEFAULT_DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      }}
    />
  );
}

export default SEO;
