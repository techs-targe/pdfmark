import * as pdfjsLib from 'pdfjs-dist';

// Configure environment-aware paths
const isDevelopment = import.meta.env.DEV;

// Configure PDF.js worker with proper path
pdfjsLib.GlobalWorkerOptions.workerSrc = isDevelopment
  ? '/pdf.worker.min.mjs' // Use public directory in development
  : './pdf.worker.min.mjs'; // Use relative path in production

// Configure CMap and standard fonts for Japanese text support
const CMAP_URL = isDevelopment 
  ? '/cmaps/' // Use absolute path from root in development
  : './cmaps/';
const STANDARD_FONT_DATA_URL = isDevelopment
  ? '/standard_fonts/' // Use absolute path from root in development  
  : './standard_fonts/';

// Default PDF loading parameters with Japanese text support
export const PDF_LOAD_PARAMS = {
  cMapUrl: CMAP_URL,
  cMapPacked: true,
  standardFontDataUrl: STANDARD_FONT_DATA_URL,
  useSystemFonts: false, // Force use of provided fonts for consistency
  verbosity: 0, // Reduce console spam
  disableFontFace: false, // Enable web fonts
  fontExtraProperties: true, // Include font metrics
  enableXfa: false, // Disable XFA forms
  useWorkerFetch: false, // Disable worker-based fetch to avoid CORS issues
  isEvalSupported: false, // Disable eval for security
  disableRange: false, // Allow range requests
  disableStream: false, // Allow streaming
  maxImageSize: 16777216 // 16MB max image size
};

// Debug logging for CMap configuration
console.log('PDF.js CMap Configuration:');
console.log('- Environment:', isDevelopment ? 'development' : 'production');
console.log('- CMap URL:', CMAP_URL);
console.log('- Font URL:', STANDARD_FONT_DATA_URL);
console.log('- Use System Fonts:', PDF_LOAD_PARAMS.useSystemFonts);

// Test CMap accessibility
if (isDevelopment) {
  fetch(CMAP_URL + '78-EUC-H.bcmap')
    .then(response => {
      console.log('✅ CMap file accessible:', response.status, response.statusText);
    })
    .catch(error => {
      console.error('❌ CMap file not accessible:', error);
      console.log('💡 Try: http://localhost:4567/cmaps/78-EUC-H.bcmap');
    });
}

export { pdfjsLib };