import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'проЯв — онлайн-галереї для фотографів',
    short_name: 'проЯв',
    description:
      'Онлайн-галерея для фотографа: передавайте зйомки клієнтам красивим посиланням — з відбором фото, паролем і завантаженням оригіналів.',
    start_url: '/uk',
    display: 'standalone',
    background_color: '#f4f4f1',
    theme_color: '#2f55ff',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
