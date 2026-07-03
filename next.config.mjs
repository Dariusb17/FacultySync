/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve the (already small) logo directly; no server-side image optimizer.
    unoptimized: true,
  },
};

export default nextConfig;
