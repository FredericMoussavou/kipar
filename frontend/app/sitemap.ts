import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.kipar.app'
  const currentDate = new Date()

  const staticRoutes = [
    { url: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { url: '/faq', changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: '/cgu', changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: '/mentions-legales', changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: '/cookies', changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: currentDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
