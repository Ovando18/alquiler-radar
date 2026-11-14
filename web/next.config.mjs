/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true }, // fotos vêm de dezenas de CDNs dos portais
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
};
export default nextConfig;
