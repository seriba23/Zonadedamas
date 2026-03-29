/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@siliba/shared'],
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ['192.168.3.33'],
};

module.exports = nextConfig;
