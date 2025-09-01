import { useRef, useEffect, useState, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
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

export const SimplePDFViewer = memo(forwardRef<any, SimplePDFViewerProps>(({
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
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const renderingRef = useRef<boolean>(false);
  const renderTaskRef = useRef<any>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isRightClickPanning, setIsRightClickPanning] = useState(false);
  const [isCtrlZooming, setIsCtrlZooming] = useState(false);
  const [zoomStartY, setZoomStartY] = useState(0);
  const [initialZoom, setInitialZoom] = useState<number | 'fit-width' | 'fit-page'>(1);
  // Touch gesture states
  const [touchDistance, setTouchDistance] = useState<number | null>(null);
  const [touchZoomStart, setTouchZoomStart] = useState<number | 'fit-width' | 'fit-page'>(1);
  const [pinchCenter, setPinchCenter] = useState<{ x: number; y: number } | null>(null);
  const [lastTap, setLastTap] = useState<{ time: number; y: number } | null>(null);
  const [isResizingText, setIsResizingText] = useState(false);

  // Expose containerRef and totalPages to parent
  useImperativeHandle(ref, () => ({
    containerRef,
    totalPages: pdfDoc?.numPages || 0
  }), [pdfDoc]);

  // Load PDF document
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    let timeoutId: NodeJS.Timeout;
    
    const loadPDF = async () => {
      try {
        // Small delay to ensure file is ready
        await new Promise(resolve => { timeoutId = setTimeout(resolve, 100); });
        
        if (cancelled) {
          return;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        
        if (cancelled) {
          return;
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        
        if (!cancelled) {
          setPdfDoc(doc);
          onDocumentLoad(doc);
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
  }, [file?.name, file?.size, file?.lastModified, onDocumentLoad]); // Use specific file properties as dependencies

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

  // Render PDF page - optimized to prevent flickering
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    
    // If already rendering, skip this call
    if (renderingRef.current) return;

    renderingRef.current = true;
    
    // Cancel any existing render task only if it exists and is not complete
    if (renderTaskRef.current && renderTaskRef.current._internalRenderTask) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
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

      // Only update canvas size if it changed
      if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setPageSize({ width: viewport.width, height: viewport.height });
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    } finally {
      renderingRef.current = false;
    }
  }, [pdfDoc, currentPage, calculateScale]);

  // Render page when conditions change
  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Handle scroll position restoration
  useEffect(() => {
    if (!containerRef.current || !scrollPosition) return;
    
    containerRef.current.scrollTo(scrollPosition.x, scrollPosition.y);
  }, [scrollPosition]);
  
  // Reset scroll to top when page changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  }, [currentPage]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onScrollChange) return;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll events
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
      
      const factor = e.deltaY < 0 ? 1.1 : 0.9; // Zoom in/out with better sensitivity
      let newZoom: number | 'fit-width' | 'fit-page';
      
      if (typeof zoomLevel === 'number') {
        newZoom = Math.max(0.25, Math.min(8, zoomLevel * factor)); // Max zoom increased to 800%
      } else {
        newZoom = 1;
      }
      
      onZoomChange(newZoom);
    }
  }, [zoomLevel, onZoomChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, handleWheel]);

  // Handle page navigation
  const goToPage = useCallback((pageNum: number) => {
    if (!pdfDoc) return;
    const validPage = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
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
    // Handle Ctrl+drag zoom
    if ((e.ctrlKey || e.metaKey) && e.button === 0 && onZoomChange) {
      e.preventDefault();
      setIsCtrlZooming(true);
      setZoomStartY(e.clientY);
      setInitialZoom(zoomLevel);
      return;
    }
    
    // Handle right-click panning
    if (e.button === 2 && containerRef.current) {
      e.preventDefault();
      setIsRightClickPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Handle panning with select tool
    if (currentTool === 'select' && e.button === 0 && containerRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [currentTool, zoomLevel, onZoomChange]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle Ctrl+drag zoom
    if (isCtrlZooming && onZoomChange) {
      const deltaY = zoomStartY - e.clientY;
      const scaleFactor = 1 + deltaY / 200; // Adjust sensitivity
      
      let baseZoom = typeof initialZoom === 'number' ? initialZoom : 1;
      let newZoom = Math.max(0.25, Math.min(8, baseZoom * scaleFactor));
      
      onZoomChange(newZoom);
      e.preventDefault();
      return;
    }
    
    if ((isPanning && currentTool === 'select') || isRightClickPanning) {
      if (containerRef.current) {
        const deltaX = panStart.x - e.clientX;
        const deltaY = panStart.y - e.clientY;
        
        containerRef.current.scrollLeft += deltaX;
        containerRef.current.scrollTop += deltaY;
        
        setPanStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      }
    }
  }, [isPanning, isRightClickPanning, panStart, currentTool, isCtrlZooming, zoomStartY, initialZoom, onZoomChange]);

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsRightClickPanning(false);
    setIsCtrlZooming(false);
  }, []);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Handle touch start for pinch zoom and panning
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Check if touching a text resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) {
      setIsResizingText(true);
      return;
    }

    // Handle double-tap for page navigation
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      
      if (rect && lastTap && now - lastTap.time < 300) {
        // Double tap detected
        e.preventDefault();
        const relativeY = touch.clientY - rect.top;
        const isTopHalf = relativeY < rect.height / 2;
        
        if (isTopHalf && currentPage > 1) {
          onPageChange(currentPage - 1);
        } else if (!isTopHalf && pdfDoc && currentPage < pdfDoc.numPages) {
          onPageChange(currentPage + 1);
        }
        setLastTap(null);
      } else {
        setLastTap({ time: now, y: touch.clientY });
      }
    }

    // Handle single touch for panning with select tool
    if (e.touches.length === 1 && currentTool === 'select' && containerRef.current && !isResizingText) {
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX, y: touch.clientY });
    }
    // Handle two-finger pinch zoom
    else if (e.touches.length === 2 && onZoomChange) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setTouchDistance(distance);
      setTouchZoomStart(zoomLevel);
      setPinchCenter(center);
      // Stop panning if it was active
      setIsPanning(false);
    }
  }, [zoomLevel, onZoomChange, currentTool, currentPage, pdfDoc, onPageChange, lastTap, isResizingText]);

  // Handle touch move for pinch zoom and panning
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent PDF movement if resizing text
    if (isResizingText) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Handle single touch panning
    if (e.touches.length === 1 && isPanning && containerRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.x;
      const deltaY = touch.clientY - panStart.y;
      
      containerRef.current.scrollLeft -= deltaX;
      containerRef.current.scrollTop -= deltaY;
      
      setPanStart({ x: touch.clientX, y: touch.clientY });
    }
    // Handle two-finger pinch zoom with center point
    else if (e.touches.length === 2 && touchDistance && onZoomChange && pinchCenter && containerRef.current) {
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      if (!newDistance || !newCenter) return;
      
      const scale = newDistance / touchDistance;
      let baseZoom = typeof touchZoomStart === 'number' ? touchZoomStart : 1;
      let newZoom = Math.max(0.25, Math.min(8, baseZoom * scale));
      
      // Calculate scroll adjustment to keep pinch center point fixed
      if (typeof newZoom === 'number' && typeof touchZoomStart === 'number') {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;
        const scrollTop = containerRef.current.scrollTop;
        
        // Get the pinch center relative to the viewport
        const centerX = pinchCenter.x - rect.left;
        const centerY = pinchCenter.y - rect.top;
        
        // Calculate the point in the document that should stay fixed
        const docX = (scrollLeft + centerX) / touchZoomStart;
        const docY = (scrollTop + centerY) / touchZoomStart;
        
        // Update zoom
        onZoomChange(newZoom);
        
        // Adjust scroll to keep the center point fixed
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = docX * newZoom - centerX;
            containerRef.current.scrollTop = docY * newZoom - centerY;
          }
        });
      } else {
        onZoomChange(newZoom);
      }
    }
  }, [touchDistance, touchZoomStart, onZoomChange, isPanning, panStart, pinchCenter, isResizingText]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setTouchDistance(null);
    setIsPanning(false);
    setPinchCenter(null);
    setIsResizingText(false);
  }, []);

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
        style={{ cursor: (currentTool === 'select' && !isPanning) || isRightClickPanning ? (isPanning || isRightClickPanning ? 'grabbing' : 'grab') : 'default' }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* Content wrapper with proper centering */}
      <div className="flex min-h-full" style={{ padding: typeof zoomLevel === 'number' && zoomLevel > 2 ? '100px' : '24px' }}>
        <div className="relative inline-block">
          {/* PDF Canvas */}
          <canvas
            ref={pdfCanvasRef}
            className="block bg-white shadow-2xl"
            style={{ 
              position: 'relative', 
              zIndex: 1
            }}
          />
          
          {/* Annotation Layer - positioned absolutely over PDF */}
          {pageSize.width > 0 && pageSize.height > 0 && (
            <AnnotationLayer
              pageNumber={currentPage}
              annotations={annotations}
              currentTool={currentTool}
              toolSettings={toolSettings}
              canvasWidth={pageSize.width}
              canvasHeight={pageSize.height}
              onAnnotationAdd={onAnnotationAdd}
              onAnnotationRemove={onAnnotationRemove}
              onAnnotationUpdate={onAnnotationUpdate}
              isDisabled={isRightClickPanning}
            />
          )}
        </div>
      </div>
    </div>

    {/* Page navigation - fixed within parent, mobile-friendly */}
    <div className="absolute bottom-4 right-4 left-4 flex justify-end gap-2 z-30 pointer-events-none">
      <div className="flex gap-2 pointer-events-auto bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed min-w-[60px] text-sm md:text-base"
        >
          Prev
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
            className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors text-sm md:text-base"
          >
            {currentPage} / {pdfDoc?.numPages || 0}
          </button>
        )}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={!pdfDoc || currentPage >= pdfDoc.numPages}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed min-w-[60px] text-sm md:text-base"
        >
          Next
        </button>
      </div>
    </div>
    </div>
  );
}));

SimplePDFViewer.displayName = 'SimplePDFViewer';