/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin remotePatterns: no servimos imágenes remotas por defecto (evita el
  // vector de DoS del Image Optimizer con remotePatterns mal acotados).
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
