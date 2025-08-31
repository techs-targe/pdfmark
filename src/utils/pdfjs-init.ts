// Import PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path - use local file with proper base path for GitHub Pages
if (typeof window !== 'undefined') {
  // Get base path from environment or default to root
  const basePath = import.meta.env.BASE_URL || '/';
  
  // Set worker source with proper path
  const workerSrc = `${basePath}pdf.worker.min.mjs`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  
  // Disable automatic worker detection to prevent conflicts
  pdfjsLib.GlobalWorkerOptions.workerPort = null;
  
  // Log the worker configuration for debugging
  console.log('PDF.js Worker Configuration:', {
    workerSrc,
    basePath,
    url: window.location.href
  });
  
  // Test if worker file is accessible
  fetch(workerSrc, { method: 'HEAD' })
    .then(response => {
      if (!response.ok) {
        console.error(`Worker file not accessible at ${workerSrc}, status: ${response.status}`);
      } else {
        console.log('Worker file verified at:', workerSrc);
      }
    })
    .catch(err => {
      console.error('Failed to verify worker file:', err);
    });
}

export { pdfjsLib };