// Static export for GitHub Pages.
// NEXT_PUBLIC_BASE_PATH is set by the GitHub Actions workflow ("/<repo-name>" for project
// pages, "" for user/organisation pages or a custom domain).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

module.exports = nextConfig
