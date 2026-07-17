/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@codeswithroh/reckon-core"],
  images: { unoptimized: true },
};

export default nextConfig;
