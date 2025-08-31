import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { TextAnnotation } from '../../types';
import { normalizedToScreen, screenToNormalized } from '../../utils/helpers';

interface ResizableTextProps {
  annotation: TextAnnotation;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onUpdate?: (annotationId: string, updates: Partial<TextAnnotation>) => void;
  onSelect?: () => void;
  onEdit?: () => void;
}

export const ResizableText: React.FC<ResizableTextProps> = ({
  annotation,
  canvasWidth,
  canvasHeight,
  isSelected,
  onUpdate,
  onSelect,
  onEdit,
}) => {
  // Safety checks
  if (!annotation || !annotation.position) {
    console.error('ResizableText: Invalid annotation', annotation);
    return null;
  }
  
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [originalBox, setOriginalBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert normalized position to screen coordinates
  const screenPos = normalizedToScreen(annotation.position, canvasWidth, canvasHeight);
  
  // Calculate box dimensions
  const boxWidth = annotation.width ? annotation.width * canvasWidth : 200;
  const boxHeight = annotation.height ? annotation.height * canvasHeight : annotation.fontSize * 1.5;

  // Calculate font size to fit the box (unused but kept for future)
  useMemo(() => {
    if (annotation.width && annotation.height) {
      // Calculate font size based on box dimensions
      // The font should scale with the box size
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        // Start with a base font size
        let testFontSize = 16;
        tempCtx.font = `${testFontSize}px sans-serif`;
        const metrics = tempCtx.measureText(annotation.content);
        
        // Calculate how much we need to scale the font
        const widthRatio = (boxWidth * 0.9) / metrics.width; // 0.9 for padding
        const heightRatio = (boxHeight * 0.8) / testFontSize; // 0.8 for padding
        const scaleFactor = Math.min(widthRatio, heightRatio);
        
        // Apply the scale factor
        return Math.max(8, Math.min(200, testFontSize * scaleFactor));
      }
    }
    // Fallback to a reasonable default
    return Math.min(boxHeight * 0.7, annotation.fontSize);
  }, [annotation.width, annotation.height, annotation.content, annotation.fontSize, boxWidth, boxHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setOriginalBox({
      x: screenPos.x,
      y: screenPos.y,
      width: boxWidth,
      height: boxHeight,
    });
  }, [screenPos, boxWidth, boxHeight]);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!isDragging || !onUpdate) return;
    
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    const newScreenPos = {
      x: originalBox.x + deltaX,
      y: originalBox.y + deltaY,
    };
    
    const normalizedPos = screenToNormalized(newScreenPos, canvasWidth, canvasHeight);
    if (onUpdate) {
      onUpdate(annotation.id, { position: normalizedPos });
    }
  }, [isDragging, startPos, originalBox, canvasWidth, canvasHeight, onUpdate, annotation.id]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeHandle || !onUpdate) return;

    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

    let newX = originalBox.x;
    let newY = originalBox.y;
    let newWidth = originalBox.width;
    let newHeight = originalBox.height;

    // Handle resize based on which handle is being dragged
    switch (resizeHandle) {
      case 'nw':
        newX = originalBox.x + deltaX;
        newY = originalBox.y + deltaY;
        newWidth = originalBox.width - deltaX;
        newHeight = originalBox.height - deltaY;
        break;
      case 'ne':
        newY = originalBox.y + deltaY;
        newWidth = originalBox.width + deltaX;
        newHeight = originalBox.height - deltaY;
        break;
      case 'sw':
        newX = originalBox.x + deltaX;
        newWidth = originalBox.width - deltaX;
        newHeight = originalBox.height + deltaY;
        break;
      case 'se':
        newWidth = originalBox.width + deltaX;
        newHeight = originalBox.height + deltaY;
        break;
      case 'n':
        newY = originalBox.y + deltaY;
        newHeight = originalBox.height - deltaY;
        break;
      case 's':
        newHeight = originalBox.height + deltaY;
        break;
      case 'w':
        newX = originalBox.x + deltaX;
        newWidth = originalBox.width - deltaX;
        break;
      case 'e':
        newWidth = originalBox.width + deltaX;
        break;
    }

    // Ensure minimum size
    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(20, newHeight);

    // Convert back to normalized coordinates
    const normalizedPos = screenToNormalized({ x: newX, y: newY }, canvasWidth, canvasHeight);
    const normalizedWidth = newWidth / canvasWidth;
    const normalizedHeight = newHeight / canvasHeight;

    if (onUpdate) {
      onUpdate(annotation.id, {
        position: normalizedPos,
        width: normalizedWidth,
        height: normalizedHeight,
      });
    }
  }, [isResizing, resizeHandle, startPos, originalBox, canvasWidth, canvasHeight, onUpdate, annotation.id]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isResizing || isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (isResizing) {
          handleMouseMove(e);
        } else if (isDragging) {
          handleDragMove(e);
        }
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, isDragging, handleMouseMove, handleDragMove, handleMouseUp]);

  // Handle container mouse down for dragging
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelected) return;
    
    // Check if clicking on a resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setOriginalBox({
      x: screenPos.x,
      y: screenPos.y,
      width: boxWidth,
      height: boxHeight,
    });
  }, [isSelected, screenPos, boxWidth, boxHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        pointerEvents: 'auto',
        cursor: isSelected ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        zIndex: 25,
        background: 'transparent',
      }}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onEdit) onEdit();
      }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={(e) => handleDragMove(e)}
      onMouseUp={handleMouseUp}
    >

      {/* Selection box and resize handles */}
      {isSelected && (
        <>
          {/* Selection outline */}
          <div
            className="absolute inset-0 border-2 border-blue-500"
            style={{
              borderStyle: 'dashed',
              pointerEvents: 'none',
            }}
          />

          {/* Resize handles */}
          {[
            { name: 'nw', cursor: 'nw-resize', top: -4, left: -4 },
            { name: 'ne', cursor: 'ne-resize', top: -4, right: -4 },
            { name: 'sw', cursor: 'sw-resize', bottom: -4, left: -4 },
            { name: 'se', cursor: 'se-resize', bottom: -4, right: -4 },
            { name: 'n', cursor: 'n-resize', top: -4, left: '50%', transform: 'translateX(-50%)' },
            { name: 's', cursor: 's-resize', bottom: -4, left: '50%', transform: 'translateX(-50%)' },
            { name: 'w', cursor: 'w-resize', left: -4, top: '50%', transform: 'translateY(-50%)' },
            { name: 'e', cursor: 'e-resize', right: -4, top: '50%', transform: 'translateY(-50%)' },
          ].map((handle) => (
            <div
              key={handle.name}
              className="resize-handle absolute w-2 h-2 bg-blue-500"
              style={{
                cursor: handle.cursor,
                ...handle,
              }}
              onMouseDown={(e) => handleMouseDown(e, handle.name)}
            />
          ))}
        </>
      )}
    </div>
  );
};