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
    // tesseract.js-core carga su motor WASM con una ruta calculada en
    // tiempo de ejecución (igual problema que pdf.worker.mjs, ver
    // src/server/pdf/setup-worker.ts) — el tracer de archivos de Vercel no
    // la sigue, así que los .wasm (varios MB cada uno) no se incluían en
    // el bundle serverless. Sin ellos, el OCR se queda colgado
    // indefinidamente en la primera página, sin lanzar ningún error
    // visible. Se fuerzan aquí los 4 (lstm/simd-lstm/simd/legacy) porque
    // tesseract.js elige uno u otro según soporte de SIMD en runtime, y no
    // sabemos de antemano cuál tocará en la función de Vercel.
    outputFileTracingIncludes: {
      "/api/inngest/**": ["./node_modules/tesseract.js-core/*.wasm"],
    },
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
