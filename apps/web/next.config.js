/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@siliba/shared'],
  // `output: 'standalone'` esta DESACTIVADO a proposito. El VPS arranca con
  // `next start` (via ecosystem.config.js) y `standalone` exige arrancar con
  // `node .next/standalone/server.js`. Tener ambos a la vez generaba el
  // warning recurrente en cada arranque de PM2. Si en el futuro se migra a
  // Docker o se quiere un bundle reducido, reactivarlo Y cambiar el comando
  // de arranque en ecosystem.config.js.
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
  // No cachear HTML para que cada deploy se refleje al instante.
  // Los chunks JS/CSS de _next/static tienen hash en el nombre, esos sí se cachean.
  async headers() {
    return [
      {
        // Match HTML pages: cualquier ruta que NO empiece con _next/, /icons/, ni tenga extensión.
        source: '/((?!_next/|icons/|favicon|manifest|sw\\.js).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
