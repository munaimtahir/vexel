import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/admin',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@vexel/sdk', '@vexel/theme'],
};

export default nextConfig;
