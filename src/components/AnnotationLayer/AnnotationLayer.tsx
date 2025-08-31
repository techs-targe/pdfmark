import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Annotation, ToolType, TextAnnotation } from '../../types';
import { PenTool } from '../../tools/PenTool';
import { EraserTool } from '../../tools/EraserTool';
import { LineTool } from '../../tools/LineTool';
import { TextTool } from '../../tools/TextTool';
import { TextEditDialog } from './TextEditDialog';
import { ResizableText } from './ResizableText';
import { normalizedToScreen, normalizedPointsToScreen } from '../../utils/helpers';

interface AnnotationLayerProps {
  pageNumber: number;
  annotations: Annotation[];
  currentTool: ToolType;
  toolSettings: {
    color: string;
    lineWidth: number;
    fontSize: number;
    eraserSize: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationRemove: (annotationId: string) => void;
  onAnnotationUpdate?: (annotationId: string, updates: Partial<Annotation>) => void;
  isDisabled?: boolean;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNumber,
  annotations,
  currentTool,
  toolSettings,
  canvasWidth,
  canvasHeight,
  onAnnotationAdd,
  onAnnotationRemove,
  onAnnotationUpdate,
  isDisabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [, forceUpdate] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [tools, setTools] = useState<{
    pen: PenTool | null;
    eraser: EraserTool | null;
    line: LineTool | null;
    text: TextTool | null;
  }>({
    pen: null,
    eraser: null,
    line: null,
    text: null,
  });

  // Initialize tools only once
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newTools = {
      pen: new PenTool(canvas, ctx, onAnnotationAdd),
      eraser: new EraserTool(canvas, ctx, (ids) => ids.forEach(onAnnotationRemove)),
      line: new LineTool(canvas, ctx, onAnnotationAdd),
      text: new TextTool(canvas, ctx, onAnnotationAdd),
    };

    setTools(newTools);

    return () => {
      // Cleanup
      newTools.text.cancel();
    };
  }, [onAnnotationAdd, onAnnotationRemove]);

  // Update tool settings
  useEffect(() => {
    if (tools.pen) {
      tools.pen.setColor(toolSettings.color);
      tools.pen.setLineWidth(toolSettings.lineWidth);
    }
    if (tools.eraser) {
      tools.eraser.setEraserSize(toolSettings.eraserSize);
    }
    if (tools.line) {
      tools.line.setColor(toolSettings.color);
      tools.line.setLineWidth(toolSettings.lineWidth);
    }
    if (tools.text) {
      tools.text.setColor(toolSettings.color);
      tools.text.setFontSize(toolSettings.fontSize);
    }
  }, [tools, toolSettings]);

  // Maintain canvas dimensions and draw annotations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to match container
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved annotations (only those for this page)
    const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
    
    pageAnnotations.forEach((annotation) => {
      ctx.save();

      switch (annotation.type) {
        case 'pen':
          // Convert normalized points to screen coordinates
          const screenPoints = normalizedPointsToScreen(
            annotation.points,
            canvas.width,
            canvas.height
          );
          
          ctx.strokeStyle = annotation.color;
          ctx.lineWidth = annotation.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          
          screenPoints.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          
          ctx.stroke();
          break;

        case 'line':
          // Convert normalized points to screen coordinates
          const screenStart = normalizedToScreen(
            annotation.start,
            canvas.width,
            canvas.height
          );
          const screenEnd = normalizedToScreen(
            annotation.end,
            canvas.width,
            canvas.height
          );
          
          ctx.strokeStyle = annotation.color;
          ctx.lineWidth = annotation.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(screenStart.x, screenStart.y);
          ctx.lineTo(screenEnd.x, screenEnd.y);
          ctx.stroke();
          break;

        case 'text':
          // Always render text on canvas
          // Convert normalized position to screen coordinates
          const screenPosition = normalizedToScreen(
            annotation.position,
            canvas.width,
            canvas.height
          );
          
          // Calculate text box dimensions
          const boxWidth = annotation.width ? annotation.width * canvas.width : 200;
          const boxHeight = annotation.height ? annotation.height * canvas.height : annotation.fontSize * 1.2;
          
          // Calculate font size to fit the box
          let fontSize = annotation.fontSize;
          if (annotation.width && annotation.height) {
            // Start with a base font size and scale to fit the box
            let testFontSize = 16;
            ctx.font = `${testFontSize}px sans-serif`;
            const metrics = ctx.measureText(annotation.content);
            
            // Calculate scale factors
            const widthRatio = (boxWidth * 0.9) / metrics.width; // 0.9 for padding
            const heightRatio = (boxHeight * 0.8) / testFontSize; // 0.8 for padding
            const scaleFactor = Math.min(widthRatio, heightRatio);
            
            // Apply the scale factor
            fontSize = Math.max(8, Math.min(200, testFontSize * scaleFactor));
          }
          
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = annotation.color;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          
          // Draw text centered in the box
          ctx.fillText(
            annotation.content,
            screenPosition.x + boxWidth / 2,
            screenPosition.y + boxHeight / 2
          );
          
          // Reset text alignment
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
          break;
      }

      ctx.restore();
    });
    
    // Update selected annotation if needed
    setSelectedAnnotation(prev => {
      // Clear selection if annotation no longer exists
      if (prev && !annotations.find(a => a.id === prev)) {
        return null;
      }
      return prev;
    });

    // Draw current drawing path if exists
    if (tools.pen && tools.pen.isActive()) {
      const currentPath = tools.pen.getCurrentPath();
      if (currentPath && currentPath.points.length > 0) {
        ctx.save();
        ctx.strokeStyle = currentPath.color;
        ctx.lineWidth = currentPath.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        currentPath.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw current line if exists
    if (tools.line && tools.line.isActive()) {
      const currentLine = tools.line.getCurrentLine();
      if (currentLine) {
        ctx.save();
        ctx.strokeStyle = currentLine.color;
        ctx.lineWidth = currentLine.lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentLine.end.x, currentLine.end.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [annotations, canvasWidth, canvasHeight, tools.pen, tools.line, currentTool, pageNumber]);

  // Check if click is on a text annotation
  const getTextAnnotationAtPoint = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    for (const annotation of annotations) {
      if (annotation.type === 'text') {
        const screenPos = normalizedToScreen(
          annotation.position,
          canvas.width,
          canvas.height
        );
        
        // Calculate text box dimensions
        const boxWidth = annotation.width ? annotation.width * canvas.width : 200;
        const boxHeight = annotation.height ? annotation.height * canvas.height : annotation.fontSize * 1.2;
        const padding = 4;
        
        if (
          x >= screenPos.x - padding &&
          x <= screenPos.x + boxWidth + padding &&
          y >= screenPos.y - padding &&
          y <= screenPos.y + boxHeight + padding
        ) {
          return annotation;
        }
      }
    }
    return null;
  }, [annotations, canvasWidth, canvasHeight]);

  // Handle mouse/touch events
  const handlePointerDown = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (isDisabled) return;
      if (!tools.pen || !tools.eraser || !tools.line || !tools.text) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in event.nativeEvent
        ? event.nativeEvent.touches[0].clientX - rect.left
        : event.nativeEvent.clientX - rect.left;
      const y = 'touches' in event.nativeEvent
        ? event.nativeEvent.touches[0].clientY - rect.top
        : event.nativeEvent.clientY - rect.top;

      // Handle select tool
      if (currentTool === 'select') {
        const textAnnotation = getTextAnnotationAtPoint(x, y);
        if (textAnnotation) {
          setSelectedAnnotation(textAnnotation.id);
          // Don't start dragging here - let ResizableText handle it
        } else {
          setSelectedAnnotation(null);
        }
        return;
      }

      // For line tool, don't set isDrawingRef as we use click-based approach
      if (currentTool !== 'line') {
        isDrawingRef.current = true;
      }

      // Start drawing based on current tool
      switch (currentTool) {
        case 'pen':
          tools.pen.startDrawing(event.nativeEvent);
          break;
        case 'eraser':
          tools.eraser.startErasing(event.nativeEvent);
          break;
        case 'text':
          tools.text.createTextInput(event.nativeEvent, pageNumber);
          break;
        case 'line':
          // Line tool uses two-click approach
          if (!tools.line.isActive()) {
            tools.line.startDrawing(event.nativeEvent);
          } else {
            tools.line.stopDrawing(event.nativeEvent, pageNumber);
          }
          break;
      }
    },
    [currentTool, tools, pageNumber, getTextAnnotationAtPoint, isDisabled]
  );

  const handlePointerMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (isDisabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in event.nativeEvent
        ? event.nativeEvent.touches[0].clientX - rect.left
        : event.nativeEvent.clientX - rect.left;
      const y = 'touches' in event.nativeEvent
        ? event.nativeEvent.touches[0].clientY - rect.top
        : event.nativeEvent.clientY - rect.top;

      // Don't handle dragging here - ResizableText handles it

      // For line tool, we always want to update preview even if not "drawing"
      if (currentTool === 'line' && tools.line) {
        if (tools.line.isActive()) {
          tools.line.draw(event.nativeEvent);
          forceUpdate(prev => prev + 1);
        }
        return;
      }
      
      if (!tools.pen || !tools.eraser || !tools.line || !isDrawingRef.current) return;

      switch (currentTool) {
        case 'pen':
          tools.pen.draw(event.nativeEvent);
          forceUpdate(prev => prev + 1); // Trigger re-render to show current path
          break;
        case 'eraser':
          tools.eraser.erase(event.nativeEvent);
          // Check for annotations to erase
          if (tools.eraser.isActive()) {
            const point = { x, y };
            const toErase = tools.eraser.checkAnnotationsForErasure(point, annotations);
            toErase.forEach(onAnnotationRemove);
          }
          break;
        case 'line':
          tools.line.draw(event.nativeEvent);
          forceUpdate(prev => prev + 1); // Trigger re-render to show current line
          break;
      }
    },
    [currentTool, tools, annotations, onAnnotationRemove, forceUpdate, isDisabled]
  );

  const handlePointerUp = useCallback(
    (_event: React.MouseEvent | React.TouchEvent) => {
      if (!tools.pen || !tools.eraser || !tools.line) return;

      isDrawingRef.current = false;

      // Complete the drawing operation (but not for line tool which uses click-based approach)
      switch (currentTool) {
        case 'pen':
          tools.pen.stopDrawing(pageNumber);
          forceUpdate(prev => prev + 1); // Final update to show completed annotation
          break;
        case 'eraser':
          tools.eraser.stopErasing();
          break;
        case 'line':
          // Line tool uses two-click approach, don't stop on mouse up
          break;
      }
    },
    [currentTool, tools, pageNumber, forceUpdate]
  );

  // Handle double-click for text editing
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (isDisabled) return;
      if (currentTool !== 'select') return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const textAnnotation = getTextAnnotationAtPoint(x, y);
      if (textAnnotation) {
        setEditingAnnotation(textAnnotation.id);
      }
    },
    [currentTool, getTextAnnotationAtPoint, isDisabled]
  );

  const handlePointerLeave = useCallback(() => {
    if (!tools.pen || !tools.eraser || !tools.line) return;

    isDrawingRef.current = false;

    // Cancel active operations when pointer leaves canvas
    tools.pen.cancel();
    tools.eraser.cancel();
    tools.line.cancel();
    
    forceUpdate(prev => prev + 1); // Update to clear any temporary drawing
  }, [tools, forceUpdate]);

  // Define cursor style based on tool
  const getCursorStyle = () => {
    switch (currentTool) {
      case 'eraser':
      case 'pen':
      case 'line':
        return 'crosshair';
      case 'text':
        return 'text';
      case 'select':
        return 'pointer';
      default:
        return 'default';
    }
  };
  
  const cursorStyle = getCursorStyle();

  // Get the editing annotation
  const editingAnnotationData = annotations.find(
    a => a.id === editingAnnotation && a.type === 'text'
  ) as TextAnnotation | undefined;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          cursor: cursorStyle,
          pointerEvents: currentTool === 'select' ? 'none' : 'all',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 20,
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      
      {/* Render ResizableText components for text annotations when in select mode */}
      {currentTool === 'select' && annotations
        .filter(a => a && a.type === 'text')
        .map(annotation => {
          const textAnnotation = annotation as TextAnnotation;
          if (!textAnnotation.position || !textAnnotation.content) {
            return null;
          }
          return (
            <ResizableText
              key={annotation.id}
              annotation={textAnnotation}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              isSelected={selectedAnnotation === annotation.id}
              onUpdate={onAnnotationUpdate}
              onSelect={() => setSelectedAnnotation(annotation.id)}
              onEdit={() => setEditingAnnotation(annotation.id)}
            />
          );
        })
      }
      
      {/* Clickable overlay for select tool when no text is selected */}
      {currentTool === 'select' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasWidth,
            height: canvasHeight,
            pointerEvents: selectedAnnotation ? 'none' : 'all',
            zIndex: 19,
            cursor: 'default',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const textAnnotation = getTextAnnotationAtPoint(x, y);
            if (textAnnotation) {
              setSelectedAnnotation(textAnnotation.id);
            } else {
              setSelectedAnnotation(null);
            }
          }}
          onDoubleClick={handleDoubleClick}
        />
      )}
      
      {/* Text edit dialog */}
      {editingAnnotationData && onAnnotationUpdate && (
        <TextEditDialog
          annotation={editingAnnotationData}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onSave={(updates) => {
            onAnnotationUpdate(editingAnnotation!, updates);
            setEditingAnnotation(null);
            setSelectedAnnotation(null);
          }}
          onCancel={() => {
            setEditingAnnotation(null);
          }}
        />
      )}
    </>
  );
};