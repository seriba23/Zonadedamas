/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@siliba/shared'],
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
