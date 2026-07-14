/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  transpilePackages: ["@reckon/core"],
  images: { unoptimized: true },
};

export default nextConfig;
