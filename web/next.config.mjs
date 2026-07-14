/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@reckon/core"],
  images: { unoptimized: true },
};

export default nextConfig;
