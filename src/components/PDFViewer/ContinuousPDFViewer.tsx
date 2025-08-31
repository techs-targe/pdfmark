import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { pdfjsLib } from '../../utils/pdfjs-init';
import { AnnotationLayer } from '../AnnotationLayer/AnnotationLayer';
import { Annotation, ToolType } from '../../types';

interface SimplePDFViewerProps {
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
  scrollPosition?: { x: number; y: number };
  onPageChange: (page: number) => void;
  onDocumentLoad: (doc: PDFDocumentProxy) => void;
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationRemove: (annotationId: string) => void;
  onAnnotationUpdate?: (annotationId: string, updates: Partial<Annotation>) => void;
  onScrollChange?: (position: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number | 'fit-width' | 'fit-page') => void;
}

interface PageInfo {
  pageNum: number;
  viewport: { width: number; height: number };
  canvas?: HTMLCanvasElement;
  rendered: boolean;
}

export const ContinuousPDFViewer = memo<SimplePDFViewerProps>(({
  file,
  currentPage,
  zoomLevel,
  annotations,
  currentTool,
  toolSettings,
  scrollPosition,
  onPageChange,
  onDocumentLoad,
  onAnnotationAdd,
  onAnnotationRemove,
  onAnnotationUpdate,
  onScrollChange,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const renderingPagesRef = useRef<Set<number>>(new Set());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageObserverRef = useRef<IntersectionObserver | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Load PDF document
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setPages([]);
      return;
    }

    let cancelled = false;
    let timeoutId: NodeJS.Timeout;
    
    const loadPDF = async () => {
      try {
        await new Promise(resolve => { timeoutId = setTimeout(resolve, 100); });
        
        if (cancelled) return;
        
        const arrayBuffer = await file.arrayBuffer();
        
        if (cancelled) return;
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        
        if (!cancelled) {
          setPdfDoc(doc);
          onDocumentLoad(doc);
          
          // Initialize page info for all pages
          const pageInfos: PageInfo[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            pageInfos.push({
              pageNum: i,
              viewport: { width: viewport.width, height: viewport.height },
              rendered: false,
            });
          }
          setPages(pageInfos);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading PDF:', err);
        }
      }
    };

    loadPDF();
    
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [file?.name, file?.size, file?.lastModified, onDocumentLoad]);

  // Calculate scale
  const calculateScale = useCallback(
    (viewport: { width: number; height: number }): number => {
      if (!containerRef.current) return 1;

      const container = containerRef.current;
      const containerWidth = container.clientWidth - 48;
      const containerHeight = container.clientHeight - 100;

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

  // Render a single page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || renderingPagesRef.current.has(pageNum)) return;
    
    renderingPagesRef.current.add(pageNum);
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = calculateScale({ width: baseViewport.width, height: baseViewport.height });
      const viewport = page.getViewport({ scale });

      const pageDiv = pageRefs.current.get(pageNum);
      if (!pageDiv) return;

      let canvas = pageDiv.querySelector('.pdf-canvas') as HTMLCanvasElement;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '1';
        canvas.style.backgroundColor = 'white';
        canvas.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
        pageDiv.appendChild(canvas);
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      
      // Update page info
      setPages(prev => prev.map(p => 
        p.pageNum === pageNum 
          ? { ...p, rendered: true, canvas }
          : p
      ));
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    } finally {
      renderingPagesRef.current.delete(pageNum);
    }
  }, [pdfDoc, calculateScale]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!pagesContainerRef.current) return;

    // Clean up previous observer
    if (pageObserverRef.current) {
      pageObserverRef.current.disconnect();
    }

    // Create new observer
    const observer = new IntersectionObserver(
      (entries) => {
        const newVisiblePages = new Set<number>();
        let currentVisiblePage = currentPage;
        
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
          if (entry.isIntersecting) {
            newVisiblePages.add(pageNum);
            // Update current page based on the topmost visible page
            if (entry.boundingClientRect.top >= 0 && 
                entry.boundingClientRect.top < window.innerHeight / 2) {
              currentVisiblePage = pageNum;
            }
          }
        });
        
        // Update current page if changed
        if (currentVisiblePage !== currentPage && newVisiblePages.has(currentVisiblePage)) {
          onPageChange(currentVisiblePage);
        }
        
        setVisiblePages(newVisiblePages);
        
        // Render visible pages
        newVisiblePages.forEach(pageNum => {
          const pageInfo = pages.find(p => p.pageNum === pageNum);
          if (pageInfo && !pageInfo.rendered) {
            renderPage(pageNum);
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '100px',
        threshold: [0, 0.1, 0.5, 1],
      }
    );

    pageObserverRef.current = observer;

    // Observe all page divs
    pageRefs.current.forEach((div, pageNum) => {
      observer.observe(div);
    });

    return () => {
      observer.disconnect();
    };
  }, [pages, renderPage, currentPage, onPageChange]);

  // Handle zoom changes - re-render all visible pages
  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return;
    
    // Mark all pages as not rendered to force re-render
    setPages(prev => prev.map(p => ({ ...p, rendered: false })));
    
    // Re-render visible pages
    visiblePages.forEach(pageNum => {
      renderPage(pageNum);
    });
  }, [zoomLevel, renderPage, visiblePages]);

  // Scroll to current page when it changes externally
  useEffect(() => {
    if (!containerRef.current || !currentPage) return;
    
    const pageDiv = pageRefs.current.get(currentPage);
    if (pageDiv && !visiblePages.has(currentPage)) {
      pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage, visiblePages]);

  // Handle scroll position restoration
  useEffect(() => {
    if (!containerRef.current || !scrollPosition) return;
    containerRef.current.scrollTo(scrollPosition.x, scrollPosition.y);
  }, [scrollPosition]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onScrollChange) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        onScrollChange({
          x: containerRef.current.scrollLeft,
          y: containerRef.current.scrollTop
        });
      }
    }, 100);
  }, [onScrollChange]);

  // Handle wheel events for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      if (!onZoomChange) return;
      
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      let newZoom: number | 'fit-width' | 'fit-page';
      
      if (typeof zoomLevel === 'number') {
        newZoom = Math.max(0.25, Math.min(4, zoomLevel * factor));
      } else {
        newZoom = 1;
      }
      
      onZoomChange(newZoom);
    }
  }, [zoomLevel, onZoomChange]);

  // Add wheel event listener with proper options
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add wheel event listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleWheel, handleScroll]);

  // Handle page navigation
  const goToPage = useCallback((pageNum: number) => {
    if (!pdfDoc) return;
    const validPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
    const pageDiv = pageRefs.current.get(validPage);
    if (pageDiv) {
      pageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onPageChange(validPage);
  }, [pdfDoc, onPageChange]);

  // Handle page jump
  const handlePageJump = useCallback(() => {
    const pageNum = parseInt(pageJumpValue, 10);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
      setShowPageJump(false);
      setPageJumpValue('');
    }
  }, [pageJumpValue, goToPage]);

  // Handle mouse down for panning with select tool
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle event for select tool
    if (currentTool === 'select' && containerRef.current) {
      // Check if clicking on the container itself, not on annotation layer
      if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('pdf-canvas')) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, [currentTool]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && containerRef.current && currentTool === 'select') {
      const deltaX = panStart.x - e.clientX;
      const deltaY = panStart.y - e.clientY;
      
      containerRef.current.scrollLeft += deltaX;
      containerRef.current.scrollTop += deltaY;
      
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      e.stopPropagation();
    }
  }, [isPanning, panStart, currentTool]);

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

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
    <div className="relative w-full h-full">
      <div 
        ref={containerRef} 
        className="w-full h-full overflow-auto bg-pdf-bg"
        style={{ cursor: currentTool === 'select' && !isPanning ? 'grab' : (currentTool === 'select' && isPanning ? 'grabbing' : 'default') }}
        onMouseDown={currentTool === 'select' ? handleMouseDown : undefined}
        onMouseMove={isPanning ? handleMouseMove : undefined}
        onMouseUp={isPanning ? handleMouseUp : undefined}
        onMouseLeave={isPanning ? handleMouseUp : undefined}
      >
        {/* Continuous pages container */}
        <div 
          ref={pagesContainerRef}
          className="flex flex-col items-center py-6 gap-6"
        >
          {pages.map((pageInfo) => {
            const scale = calculateScale(pageInfo.viewport);
            const scaledWidth = pageInfo.viewport.width * scale;
            const scaledHeight = pageInfo.viewport.height * scale;
            
            return (
              <div
                key={pageInfo.pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageInfo.pageNum, el);
                  else pageRefs.current.delete(pageInfo.pageNum);
                }}
                data-page={pageInfo.pageNum}
                className="relative bg-white shadow-2xl"
                style={{
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  minHeight: `${scaledHeight}px`,
                  position: 'relative',
                }}
              >
                {/* Placeholder while loading */}
                {!pageInfo.rendered && (
                  <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">Loading Page {pageInfo.pageNum}...</span>
                  </div>
                )}
                
                {/* Annotation Layer */}
                {pageInfo.rendered && scaledWidth > 0 && scaledHeight > 0 && (
                  <AnnotationLayer
                    pageNumber={pageInfo.pageNum}
                    annotations={annotations.filter(a => a.pageNumber === pageInfo.pageNum)}
                    currentTool={currentTool}
                    toolSettings={toolSettings}
                    canvasWidth={scaledWidth}
                    canvasHeight={scaledHeight}
                    onAnnotationAdd={onAnnotationAdd}
                    onAnnotationRemove={onAnnotationRemove}
                    onAnnotationUpdate={onAnnotationUpdate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Page navigation - fixed within parent */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-30">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {showPageJump ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={pageJumpValue}
              onChange={(e) => setPageJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePageJump();
                if (e.key === 'Escape') {
                  setShowPageJump(false);
                  setPageJumpValue('');
                }
              }}
              onBlur={() => {
                setShowPageJump(false);
                setPageJumpValue('');
              }}
              className="w-16 px-2 py-1 bg-gray-700 text-white rounded text-center"
              min="1"
              max={pdfDoc?.numPages || 1}
              autoFocus
            />
            <span className="text-white">/ {pdfDoc?.numPages || 0}</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowPageJump(true);
              setPageJumpValue(currentPage.toString());
            }}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            {currentPage} / {pdfDoc?.numPages || 0}
          </button>
        )}
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
});

ContinuousPDFViewer.displayName = 'ContinuousPDFViewer';