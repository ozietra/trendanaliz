/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Trendyol ürün görselleri için izinli alan adları
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.trendyol.com' },
      { protocol: 'https', hostname: '**.mncdn.com' },
      { protocol: 'https', hostname: '**.aliyuncs.com' },
    ],
  },
  // SSE (Server-Sent Events) proxy davranışı için tampon kapat
  async headers() {
    return [
      {
        source: '/api/notifications/stream',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-transform' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
