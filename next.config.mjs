/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // admin uploads (hero video up to 30 MB) go through server actions
    serverActions: { bodySizeLimit: "35mb" },
  },
};

export default nextConfig;
