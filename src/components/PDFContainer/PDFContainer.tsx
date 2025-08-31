import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjsLib } from '../../utils/pdfjs-init';
import { AnnotationLayer } from '../AnnotationLayer/AnnotationLayer';
import { Annotation, ToolType } from '../../types';

interface PDFContainerProps {
  file: File | null;
  currentPage: number;
  zoomLevel: number | 'fit-width' | 'fit-page';
  annotations: Annotation[];
  currentTool: ToolType;
  toolSettings: {
    color: string;
    lineWidth: number;
    fontSize: number;
    eraserSize: number;
  };
  onPageChange: (page: number) => void;
  onDocumentLoad: (doc: PDFDocumentProxy) => void;
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationRemove: (annotationId: string) => void;
}

export const PDFContainer: React.FC<PDFContainerProps> = ({
  file,
  currentPage,
  zoomLevel,
  annotations,
  currentTool,
  toolSettings,
  onPageChange,
  onDocumentLoad,
  onAnnotationAdd,
  onAnnotationRemove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const loadPDF = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        
        if (!cancelled) {
          setPdfDoc(doc);
          onDocumentLoad(doc);
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
      }
    };

    loadPDF();
    
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [file, onDocumentLoad]);

  // Calculate scale
  const calculateScale = useCallback(
    (viewport: { width: number; height: number }): number => {
      if (!containerRef.current) return 1;

      const container = containerRef.current;
      const containerWidth = container.clientWidth - 48;
      const containerHeight = container.clientHeight - 100; // Account for navigation buttons

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
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current || loading) return;

    const renderPage = async () => {
      setLoading(true);
      
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = calculateScale({ width: baseViewport.width, height: baseViewport.height });
        const viewport = page.getViewport({ scale });

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Set actual canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Set display size
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setPageSize({ width: viewport.width, height: viewport.height });

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
      } catch (err) {
        if ((err as any).name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, zoomLevel, calculateScale, loading]);

  // Handle page navigation
  const goToPage = (pageNum: number) => {
    if (!pdfDoc) return;
    const validPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
    onPageChange(validPage);
  };

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
    <div ref={containerRef} className="relative w-full h-full overflow-auto bg-pdf-bg">
      {/* Centered content wrapper */}
      <div className="flex items-center justify-center min-h-full p-6">
        <div className="relative inline-block">
          {/* PDF Canvas */}
          <canvas
            ref={pdfCanvasRef}
            className="block bg-white shadow-2xl"
            style={{ position: 'relative', zIndex: 1 }}
          />
          
          {/* Annotation Layer - positioned absolutely over PDF */}
          {pageSize.width > 0 && pageSize.height > 0 && !loading && (
            <div 
              className="absolute top-0 left-0"
              style={{
                width: pageSize.width,
                height: pageSize.height,
                zIndex: 10,
              }}
            >
              <AnnotationLayer
                pageNumber={currentPage}
                annotations={annotations}
                currentTool={currentTool}
                toolSettings={toolSettings}
                canvasWidth={pageSize.width}
                canvasHeight={pageSize.height}
                onAnnotationAdd={onAnnotationAdd}
                onAnnotationRemove={onAnnotationRemove}
              />
            </div>
          )}
        </div>
      </div>

      {/* Page navigation */}
      <div className="fixed bottom-8 right-8 flex gap-2 z-20">
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