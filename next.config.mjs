/** @type {import('next').NextConfig} */
const nextConfig = {

  images: {
    remotePatterns: [
      // ImgBB CDN domains
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "ibb.co",
      },
      {
        protocol: "https",
        hostname: "**.ibb.co",
      },
    ],
  },
};

export default nextConfig;
