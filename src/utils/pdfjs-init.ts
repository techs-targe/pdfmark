import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for PDF.js worker to avoid module loading issues
// This ensures the worker loads correctly on GitHub Pages and other deployments
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs`;

export { pdfjsLib };