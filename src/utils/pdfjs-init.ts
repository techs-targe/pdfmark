import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use the worker from node_modules directly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export { pdfjsLib };