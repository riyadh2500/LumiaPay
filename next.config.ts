import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Fix multiple lockfiles warning - set correct workspace root
  outputFileTracingRoot: 'C:/Users/AC/OneDrive/Desktop/LumiaPay-main/LumiaPay-main',
  
  // Faster builds
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig