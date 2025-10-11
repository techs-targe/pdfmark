import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SimplePDFViewer } from '../PDFViewer/SimplePDFViewer';
import { Annotation, ToolType, SplitMode } from '../../types';
import { PDFDocumentProxy } from 'pdfjs-dist';

interface SplitViewProps {
  file: File | null;
  splitMode: SplitMode;
  splitRatio: number;
  onSplitRatioChange: (ratio: number) => void;
  
  // Left/Top view props
  leftPage: number;
  leftZoom: number | 'fit-width' | 'fit-page';
  leftAnnotations: Annotation[];
  leftScrollPosition?: { x: number; y: number };
  onLeftPageChange: (page: number) => void;
  onLeftScrollChange?: (position: { x: number; y: number }) => void;
  onLeftZoomChange?: (zoom: number | 'fit-width' | 'fit-page') => void;
  
  // Right/Bottom view props
  rightPage: number;
  rightZoom: number | 'fit-width' | 'fit-page';
  rightAnnotations: Annotation[];
  rightScrollPosition?: { x: number; y: number };
  onRightPageChange: (page: number) => void;
  onRightScrollChange?: (position: { x: number; y: number }) => void;
  onRightZoomChange?: (zoom: number | 'fit-width' | 'fit-page') => void;
  
  // Common props
  currentTool: ToolType;
  toolSettings: {
    color: string;
    lineWidth: number;
    fontSize: number;
    eraserSize: number;
    markerWidth: number;
    markerOpacity: number;
  };
  onDocumentLoad: (doc: PDFDocumentProxy) => void;
  onAnnotationAdd: (viewId: 'left' | 'right', annotation: Annotation) => void;
  onAnnotationRemove: (viewId: 'left' | 'right', annotationId: string) => void;
}

export const SplitView: React.FC<SplitViewProps> = ({
  file,
  splitMode,
  splitRatio,
  onSplitRatioChange,
  leftPage,
  leftZoom,
  leftAnnotations,
  leftScrollPosition,
  onLeftPageChange,
  onLeftScrollChange,
  onLeftZoomChange: _onLeftZoomChange,
  rightPage,
  rightZoom,
  rightAnnotations,
  rightScrollPosition,
  onRightPageChange,
  onRightScrollChange,
  onRightZoomChange: _onRightZoomChange,
  currentTool,
  toolSettings,
  onDocumentLoad,
  onAnnotationAdd,
  onAnnotationRemove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [initialRatio, setInitialRatio] = useState(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(splitMode === 'vertical' ? e.clientX : e.clientY);
    setInitialRatio(splitRatio);
    e.preventDefault();
  }, [splitMode, splitRatio]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    let newRatio: number;
    if (splitMode === 'vertical') {
      const totalWidth = rect.width;
      const deltaX = e.clientX - dragStart;
      newRatio = initialRatio + (deltaX / totalWidth);
    } else {
      const totalHeight = rect.height;
      const deltaY = e.clientY - dragStart;
      newRatio = initialRatio + (deltaY / totalHeight);
    }

    // Clamp between 0.2 and 0.8
    newRatio = Math.max(0.2, Math.min(0.8, newRatio));
    onSplitRatioChange(newRatio);
  }, [isDragging, splitMode, dragStart, initialRatio, onSplitRatioChange]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (splitMode === 'none') {
    return (
      <SimplePDFViewer
        file={file}
        currentPage={leftPage}
        zoomLevel={leftZoom}
        scrollPosition={leftScrollPosition}
        annotations={leftAnnotations}
        currentTool={currentTool}
        toolSettings={toolSettings}
        onPageChange={onLeftPageChange}
        onScrollChange={onLeftScrollChange}
        onDocumentLoad={onDocumentLoad}
        onAnnotationAdd={(annotation) => onAnnotationAdd('left', annotation)}
        onAnnotationRemove={(id) => onAnnotationRemove('left', id)}
      />
    );
  }

  const dividerStyle = splitMode === 'vertical'
    ? {
        position: 'absolute' as const,
        left: `${splitRatio * 100}%`,
        top: 0,
        bottom: 0,
        width: '4px',
        cursor: 'col-resize',
        transform: 'translateX(-50%)',
      }
    : {
        position: 'absolute' as const,
        top: `${splitRatio * 100}%`,
        left: 0,
        right: 0,
        height: '4px',
        cursor: 'row-resize',
        transform: 'translateY(-50%)',
      };

  const leftStyle = splitMode === 'vertical'
    ? {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: `${splitRatio * 100}%`,
      }
    : {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        right: 0,
        height: `${splitRatio * 100}%`,
      };

  const rightStyle = splitMode === 'vertical'
    ? {
        position: 'absolute' as const,
        right: 0,
        top: 0,
        bottom: 0,
        width: `${(1 - splitRatio) * 100}%`,
      }
    : {
        position: 'absolute' as const,
        left: 0,
        bottom: 0,
        right: 0,
        height: `${(1 - splitRatio) * 100}%`,
      };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Left/Top View */}
      <div style={leftStyle}>
        <SimplePDFViewer
          file={file}
          currentPage={leftPage}
          zoomLevel={leftZoom}
          scrollPosition={leftScrollPosition}
          annotations={leftAnnotations}
          currentTool={currentTool}
          toolSettings={toolSettings}
          onPageChange={onLeftPageChange}
          onScrollChange={onLeftScrollChange}
          onDocumentLoad={onDocumentLoad}
          onAnnotationAdd={(annotation) => onAnnotationAdd('left', annotation)}
          onAnnotationRemove={(id) => onAnnotationRemove('left', id)}
        />
      </div>

      {/* Right/Bottom View */}
      <div style={rightStyle}>
        <SimplePDFViewer
          file={file}
          currentPage={rightPage}
          zoomLevel={rightZoom}
          scrollPosition={rightScrollPosition}
          annotations={rightAnnotations}
          currentTool={currentTool}
          toolSettings={toolSettings}
          onPageChange={onRightPageChange}
          onScrollChange={onRightScrollChange}
          onDocumentLoad={onDocumentLoad}
          onAnnotationAdd={(annotation) => onAnnotationAdd('right', annotation)}
          onAnnotationRemove={(id) => onAnnotationRemove('right', id)}
        />
      </div>

      {/* Divider */}
      <div
        style={dividerStyle}
        className={`split-divider ${splitMode === 'horizontal' ? 'horizontal' : ''}`}
        onMouseDown={handleDragStart}
      />
    </div>
  );
};