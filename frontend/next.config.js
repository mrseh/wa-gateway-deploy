/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  images: {
    domains: [
      'localhost',
      'api.yourdomain.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  experimental: {
    serverActions: true,
  },
  
  // Optimize production build
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Output standalone for Docker
  output: 'standalone',
}

module.exports = nextConfig
