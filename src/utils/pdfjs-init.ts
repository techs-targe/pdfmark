// Import PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path - use local file with proper base path for GitHub Pages
if (typeof window !== 'undefined') {
  // Get base path from environment or default to root
  const basePath = import.meta.env.BASE_URL || '/';
  
  // Set worker source with proper path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}pdf.worker.min.mjs`;
  
  // Disable automatic worker detection to prevent conflicts
  pdfjsLib.GlobalWorkerOptions.workerPort = null;
}

export { pdfjsLib };