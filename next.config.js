const legacyBlogSlugs = require('./src/lib/blog/legacy-slugs.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Originals and previews are served straight from R2 via presigned URLs —
  // never proxied through Next/Vercel (egress cost). Image optimization is
  // deliberately disabled until an image CDN (Bunny Optimizer / Cloudflare
  // Images) is wired in via the custom loader in src/lib/images/loader.ts.
  images: {
    unoptimized: true,
  },
  // The photographer-site OG image reads brand .ttf fonts from disk at render
  // time; make sure Vercel's function bundle includes them. (Next 14 nests this
  // under `experimental`; it graduates to top-level in Next 15.)
  // proiav.space/vistela is served by a separate Vercel project (the wedding
  // gallery/RSVP app). It sets basePath '/vistela', so the prefix is kept on
  // the way through and its assets resolve.
  // Blog slugs moved to the official Ukrainian transliteration — old URLs 301.
  async redirects() {
    const locales = 'uk|en|pl|de|es|fr|it|ro|pt'
    const out = []
    for (const [from, to] of Object.entries(legacyBlogSlugs)) {
      if (from.startsWith('_')) continue
      out.push({ source: `/:locale(${locales})/blog/${from}`, destination: `/:locale/blog/${to}`, permanent: true })
      out.push({ source: `/blog/${from}`, destination: `/uk/blog/${to}`, permanent: true })
    }
    // The photographer-site builder is shelved — its theme catalogue points to
    // the gallery demo until sites come back (temporary, so 307).
    out.push({ source: `/:locale(${locales})/themes`, destination: '/:locale/gallery-demo', permanent: false })
    out.push({ source: `/:locale(${locales})/themes/:value`, destination: '/:locale/gallery-demo', permanent: false })
    return out
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/vistela', destination: 'https://momently-dianahohol97-7159s-projects.vercel.app/vistela' },
        { source: '/vistela/:path*', destination: 'https://momently-dianahohol97-7159s-projects.vercel.app/vistela/:path*' },
      ],
    }
  },
  experimental: {
    outputFileTracingIncludes: {
      '/[locale]/s/[handle]/opengraph-image': ['./src/assets/fonts/**'],
      '/og/[key]': ['./src/assets/fonts/**'],
    },
  },
}

// Sentry only when a DSN is configured: without it the build is untouched
// (no SDK in the bundle, no instrumentation hook, no source-map upload).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require('@sentry/nextjs/config')
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    // Readable stack traces need an upload token; without one, skip uploads quietly.
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
    telemetry: false,
  })
} else {
  module.exports = nextConfig
}
