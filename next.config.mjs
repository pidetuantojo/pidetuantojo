/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Baileys necesita correr en Node.js nativo — no bundlear con webpack
    serverComponentsExternalPackages: ['@whiskeysockets/baileys'],
  },
  webpack: (config, { webpack }) => {
    // qz-tray hace un require('lna') opcional dentro de try/catch; no es dependencia real.
    // IgnorePlugin hace que el require lance en runtime (qz-tray lo atrapa y conecta sin LNA).
    // No usar alias `lna: false`: devuelve `{}`, qz-tray lo toma como LNA válido y rompe la conexión.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^lna$/, contextRegExp: /qz-tray/ }));
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'pidetuantojo.com' }],
        destination: 'https://www.pidetuantojo.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
