/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
    webpack: (config, { isServer }) => {
    // Resolve cornerstone WASM and worker dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },

  images: {
    unoptimized: true,
  },
}

export default nextConfig
