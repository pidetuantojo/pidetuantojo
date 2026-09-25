/** @type {import('next').NextConfig} */
const nextConfig = {
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
