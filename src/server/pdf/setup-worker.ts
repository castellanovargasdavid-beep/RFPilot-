/**
 * pdfjs-dist necesita su módulo "worker" incluso en Node (lo ejecuta en el
 * mismo proceso como "fake worker"). Por defecto lo carga con un
 * `import()` dinámico cuya ruta se calcula en tiempo de ejecución — el
 * tracer de archivos de Vercel no puede seguir esa ruta de forma estática,
 * así que `pdf.worker.mjs` no se incluye en el bundle serverless y la
 * extracción falla en producción con "Cannot find module ... pdf.worker.mjs"
 * aunque el PDF sea válido y todo funcione en local.
 *
 * Importar el worker aquí, de forma estática, registra
 * `globalThis.pdfjsWorker` — que pdfjs-dist comprueba antes de intentar el
 * `import()` dinámico — así que nunca llega a necesitarlo.
 */
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
