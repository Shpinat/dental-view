import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ДентаВью — просмотр КЛКТ',
    short_name: 'ДентаВью',
    description: 'Офлайн-просмотрщик КЛКТ для стоматологов',
    start_url: '/',
    display: 'standalone',
    background_color: '#16191f',
    theme_color: '#16191f',
    lang: 'ru',
    icons: [
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
