import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Edugistics — School Financial Planning',
    short_name: 'Edugistics',
    description: 'Financial planning and forecasting for school operators.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F6F7FA',
    theme_color: '#2B3A67',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
