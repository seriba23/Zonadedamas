/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@siliba/shared'],
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ['192.168.3.33'],
  // Skip TypeScript and ESLint during build. Errores quedan para iteracion en local.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
