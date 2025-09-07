import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjsLib, PDF_LOAD_PARAMS } from '../../utils/pdfjs-init';

interface PDFViewerProps {
  file: File | null;
  currentPage: number;
  zoomLevel: number | 'fit-width' | 'fit-page';
  onPageChange: (page: number) => void;
  onDocumentLoad: (doc: PDFDocumentProxy) => void;
  onPageRender: (canvas: HTMLCanvasElement) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  currentPage,
  zoomLevel,
  onPageChange,
  onDocumentLoad,
  onPageRender,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{ width: number; height: number } | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const loadPDF = async () => {
      try {
        setError(null);
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          ...PDF_LOAD_PARAMS
        });
        const doc = await loadingTask.promise;
        
        if (!cancelled) {
          setPdfDoc(doc);
          onDocumentLoad(doc);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load PDF file');
          console.error('Error loading PDF:', err);
        }
      }
    };

    loadPDF();
    
    return () => {
      cancelled = true;
    };
  }, [file, onDocumentLoad]);

  // Calculate scale based on zoom level
  const calculateScale = useCallback(
    (viewport: { width: number; height: number }): number => {
      if (!containerRef.current) return 1;

      const container = containerRef.current;
      const containerWidth = container.clientWidth - 48; // Padding
      const containerHeight = container.clientHeight - 48;

      if (zoomLevel === 'fit-width') {
        return containerWidth / viewport.width;
      } else if (zoomLevel === 'fit-page') {
        const widthScale = containerWidth / viewport.width;
        const heightScale = containerHeight / viewport.height;
        return Math.min(widthScale, heightScale);
      } else {
        return zoomLevel as number;
      }
    },
    [zoomLevel]
  );

  // Render PDF page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current || renderingRef.current) return;

      renderingRef.current = true;

      try {
        const page = await pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = calculateScale({ width: baseViewport.width, height: baseViewport.height });
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Set canvas dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // Store page info
        setPageInfo({ width: viewport.width, height: viewport.height });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        onPageRender(canvas);
      } catch (err) {
        console.error('Error rendering page:', err);
      } finally {
        renderingRef.current = false;
      }
    },
    [pdfDoc, calculateScale, onPageRender]
  );

  // Render page when conditions change
  useEffect(() => {
    if (pdfDoc && currentPage > 0 && currentPage <= pdfDoc.numPages && !renderingRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, pdfDoc, zoomLevel, renderPage]);

  // Handle page navigation
  const goToPage = (pageNum: number) => {
    if (!pdfDoc) return;
    const validPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
    onPageChange(validPage);
  };

  // Memoize container styles
  const containerStyles = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    overflow: 'auto',
  }), []);

  const pageWrapperStyles = useMemo(() => ({
    position: 'relative' as const,
    display: 'inline-block',
    padding: '24px',
  }), []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-pdf-bg text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="button-primary"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full bg-pdf-bg text-gray-400">
        <div className="text-center">
          <svg
            className="w-24 h-24 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg">No PDF loaded</p>
          <p className="text-sm mt-2">Drag and drop a PDF file or click to select</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pdf-container h-full w-full scrollbar-thin bg-pdf-bg"
      style={containerStyles}
    >
      <div style={pageWrapperStyles}>
        <canvas
          ref={canvasRef}
          className="bg-white shadow-lg block"
        />
        
        {/* Page info overlay - positioned absolutely */}
        {pageInfo && (
          <div 
            className="absolute"
            style={{
              top: '24px',
              left: '24px',
              width: `${pageInfo.width}px`,
              height: `${pageInfo.height}px`,
              pointerEvents: 'none',
            }}
            data-page-overlay="true"
          />
        )}
      </div>
      
      {/* Page navigation buttons */}
      <div className="fixed bottom-8 right-8 flex gap-2 z-10">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="bg-gray-800 text-white px-4 py-2 rounded">
          {currentPage} / {pdfDoc?.numPages || 0}
        </span>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={!pdfDoc || currentPage >= pdfDoc.numPages}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};