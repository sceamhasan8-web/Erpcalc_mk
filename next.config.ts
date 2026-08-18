import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disabled in dev to prevent double-invoking effects (Firestore calls, etc.)
  // Keep true for production builds only
  reactStrictMode: false,

  // Optimize package imports — tree-shake large icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
