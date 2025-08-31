import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker with proper base path for deployment
const basePath = import.meta.env.BASE_URL || '/';
pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}pdf.worker.min.mjs`;

export { pdfjsLib };