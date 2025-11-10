/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@wine-club/ui", "@wine-club/lib", "@wine-club/db", "@wine-club/emails"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;

