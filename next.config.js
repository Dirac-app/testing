/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
};

module.exports = nextConfig;
