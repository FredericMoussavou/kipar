import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kipar.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/carrier',
          '/packages',
          '/profile',
          '/preferences',
          '/premium',
          '/notifications',
          '/search',
          '/requests',
          '/onboarding',
          '/trips/*/book',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/reactivate',
          '/splash',
          '/auth/',
          '/admin',
          '/receiver/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
