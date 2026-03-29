/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@siliba/shared'],
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ['192.168.3.33'],
  webpack: (config) => {
    // Stub Capacitor native plugins so Next.js doesn't crash when building for web
    config.resolve.alias = {
      ...config.resolve.alias,
      '@codetrix-studio/capacitor-google-auth': false,
    };
    return config;
  },
};

module.exports = nextConfig;
