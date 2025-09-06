declare const __BUILD_DATE__: string;

export const APP_INFO = {
  name: 'PDFMark',
  version: '1.0.2',
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString().split('T')[0],
  description: 'Study PDF Viewer with Annotation Tools'
} as const;