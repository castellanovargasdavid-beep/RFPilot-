/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin remotePatterns: no servimos imágenes remotas por defecto (evita el
  // vector de DoS del Image Optimizer con remotePatterns mal acotados).
  images: {
    remotePatterns: [],
  },
  // Paquetes con binarios nativos o requires dinámicos (OCR): que Next los
  // cargue con require() en runtime en vez de intentar bundlearlos con
  // webpack, que no sabe qué hacer con un .node binario.
  experimental: {
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "tesseract.js",
      "pdfjs-dist",
      "@tesseract.js-data/spa",
      "@tesseract.js-data/eng",
    ],
  },
};

export default nextConfig;
