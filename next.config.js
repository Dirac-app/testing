/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required to allow better-sqlite3 (native module) to work server-side
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling native modules
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }
    return config;
  },
  // Ensure API routes are never statically optimized
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
