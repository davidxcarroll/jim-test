/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['a.espncdn.com', 'a1.espncdn.com', 'a2.espncdn.com'],
  },
}

module.exports = nextConfig 