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
  // El visor de PDF (src/components/tenders/pdf-split-viewer.tsx) importa
  // pdfjs-dist dinámicamente EN EL CLIENTE para renderizar páginas en
  // <canvas>. Su build de navegador referencia opcionalmente el paquete
  // `canvas` de Node como fallback — no existe (ni hace falta) en el
  // bundle de cliente, así que se desactiva explícitamente para que
  // webpack no intente resolverlo.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    }
    return config;
  },
};

export default nextConfig;
