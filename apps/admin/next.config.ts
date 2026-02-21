import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@vexel/sdk'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
