import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disabled in dev to prevent double-invoking effects (Firestore calls, etc.)
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,

  // Optimize package imports — tree-shake large icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
