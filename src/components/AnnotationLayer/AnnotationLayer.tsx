import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Annotation, ToolType, TextAnnotation } from '../../types';
import { PenTool } from '../../tools/PenTool';
import { EraserTool } from '../../tools/EraserTool';
import { LineTool } from '../../tools/LineTool';
import { TextTool } from '../../tools/TextTool';
import { TextEditDialog } from './TextEditDialog';
import { ResizableText } from './ResizableText';
import { normalizedToScreen, normalizedPointsToScreen } from '../../utils/helpers';
import { isPenEvent, isPenActive, setToolActive } from '../../utils/penDetection';

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
  onToolChange?: (tool: ToolType) => void;
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
  onToolChange,
  isDisabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [renderCounter, forceUpdate] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const initialTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCountRef = useRef<number>(0);
  const previousToolRef = useRef<ToolType | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
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

  // Initialize tools and gesture detection
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

    // Add gesture event listeners for pinch detection
    const handleGestureStart = (e: Event) => {
      console.log('🚫 Gesture start detected');

      // CRITICAL FIX: Don't cancel pen drawing for genuine pen input
      if (isPenActive()) {
        console.log('🚫 Gesture start - PEN ACTIVE, NOT cancelling drawing');
        e.preventDefault();
        return;
      }

      console.log('🚫 Gesture start - preventing non-pen drawing');
      e.preventDefault();
      if (isDrawingRef.current && newTools.pen.isActive()) {
        newTools.pen.cancel();
        isDrawingRef.current = false;
        forceUpdate(prev => prev + 1);
      }
      // Stop tracking tool activities
      setToolActive('eraser', false);
      setToolActive('line', false);
    };

    const handleGestureChange = (e: Event) => {
      console.log('🚫 Gesture change detected');

      // CRITICAL FIX: Don't cancel pen drawing for genuine pen input
      if (isPenActive()) {
        console.log('🚫 Gesture change - PEN ACTIVE, NOT cancelling drawing');
        e.preventDefault();
        return;
      }

      console.log('🚫 Gesture change - preventing non-pen drawing');
      e.preventDefault();
      if (isDrawingRef.current) {
        if (newTools.pen.isActive()) newTools.pen.cancel();
        if (newTools.eraser.isActive()) newTools.eraser.cancel();
        isDrawingRef.current = false;
        forceUpdate(prev => prev + 1);
      }
      // Stop tracking tool activities
      setToolActive('eraser', false);
      setToolActive('line', false);
    };

    const handleGestureEnd = (e: Event) => {
      console.log('🚫 Gesture end detected');
      e.preventDefault();
    };

    // Add gesture event listeners (for iOS Safari pinch detection)
    canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', handleGestureChange, { passive: false });
    canvas.addEventListener('gestureend', handleGestureEnd, { passive: false });

    return () => {
      // Cleanup
      newTools.text.cancel();
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureChange);
      canvas.removeEventListener('gestureend', handleGestureEnd);
    };
  }, [onAnnotationAdd, onAnnotationRemove, forceUpdate]);

  // Cancel previous tool when switching tools
  useEffect(() => {
    if (tools.line && currentTool !== 'line') {
      // Cancel line tool when switching away from it
      if (tools.line.isActive()) {
        tools.line.cancel();
        forceUpdate(prev => prev + 1);
      }
    }
    if (tools.pen && currentTool !== 'pen') {
      if (tools.pen.isActive()) {
        tools.pen.cancel();
        forceUpdate(prev => prev + 1);
      }
    }
  }, [currentTool, tools, forceUpdate]);

  // Handle Escape key to reset line tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentTool === 'line' && tools.line && tools.line.isActive()) {
          tools.line.cancel();
          forceUpdate(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTool, tools, forceUpdate]);

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

    // Draw current drawing path with smooth rendering
    if (tools.pen && tools.pen.isActive()) {
      const currentPath = tools.pen.getCurrentPath();
      if (currentPath && currentPath.points.length > 0) {
        ctx.save();
        ctx.strokeStyle = currentPath.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Check if we have pressure data
        const pressurePoints = (currentPath as any).pressurePoints;
        
        if (pressurePoints && pressurePoints.length > 1) {
          // Draw smooth curves with pressure sensitivity
          ctx.beginPath();
          ctx.moveTo(pressurePoints[0].x, pressurePoints[0].y);
          
          for (let i = 1; i < pressurePoints.length - 1; i++) {
            const current = pressurePoints[i];
            const next = pressurePoints[i + 1];
            
            // Simple pressure-based line width without artifacts
            const pressureMultiplier = Math.pow(current.pressure || 0.7, 0.6);
            const lineWidth = Math.max(0.5, currentPath.lineWidth * pressureMultiplier);
            ctx.lineWidth = lineWidth;
            
            // Use quadratic curves for smoothness
            const midX = (current.x + next.x) / 2;
            const midY = (current.y + next.y) / 2;
            ctx.quadraticCurveTo(current.x, current.y, midX, midY);
          }
          
          // Draw to the last point
          if (pressurePoints.length > 1) {
            const lastPoint = pressurePoints[pressurePoints.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
          }
          
          ctx.stroke();
        } else {
          // Simple smooth line drawing
          ctx.lineWidth = currentPath.lineWidth;
          ctx.beginPath();
          if (currentPath.points.length > 2) {
            // Use quadratic curves for smoothness
            ctx.moveTo(currentPath.points[0].x, currentPath.points[0].y);
            
            for (let i = 1; i < currentPath.points.length - 1; i++) {
              const current = currentPath.points[i];
              const next = currentPath.points[i + 1];
              const midX = (current.x + next.x) / 2;
              const midY = (current.y + next.y) / 2;
              ctx.quadraticCurveTo(current.x, current.y, midX, midY);
            }
            
            const lastPoint = currentPath.points[currentPath.points.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
          } else {
            // Fallback for short paths
            currentPath.points.forEach((point, index) => {
              if (index === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });
          }
          ctx.stroke();
        }
        
        ctx.restore();
      }
    }

    // Draw current line if exists (with dashed preview)
    if (tools.line && tools.line.isActive()) {
      const currentLine = tools.line.getCurrentLine();
      if (currentLine) {
        ctx.save();
        ctx.strokeStyle = currentLine.color;
        ctx.lineWidth = currentLine.lineWidth;
        ctx.lineCap = 'round';

        // Draw dashed line for preview
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentLine.end.x, currentLine.end.y);
        ctx.stroke();

        // Draw start point indicator (circle with "1")
        ctx.setLineDash([]);
        ctx.fillStyle = currentLine.color;
        ctx.beginPath();
        ctx.arc(currentLine.start.x, currentLine.start.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', currentLine.start.x, currentLine.start.y);

        // Draw end point indicator (circle with "2")
        ctx.fillStyle = currentLine.color;
        ctx.beginPath();
        ctx.arc(currentLine.end.x, currentLine.end.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('2', currentLine.end.x, currentLine.end.y);

        ctx.restore();
      }
    }

    // Draw cursor indicator for line tool
    if (currentTool === 'line' && cursorPosition && tools.line) {
      const state = tools.line.getState();
      const label = state === 'waiting-first' ? '1' : '2';
      const cursorSize = 24;

      ctx.save();

      // Draw circle background
      ctx.fillStyle = state === 'waiting-first' ? '#3b82f6' : '#10b981';
      ctx.beginPath();
      ctx.arc(cursorPosition.x, cursorPosition.y, cursorSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cursorPosition.x, cursorPosition.y);

      ctx.restore();
    }
  }, [annotations, canvasWidth, canvasHeight, tools.pen, tools.line, currentTool, pageNumber, renderCounter, cursorPosition]);

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

  // Helper function to calculate distance between two touches
  const getTouchDistance = useCallback((touches: TouchList | Touch[]) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // COMPLETELY REWRITTEN: Helper function to check for multi-finger gestures (2+ fingers)
  const isMultiFingerGesture = useCallback((event: any) => {
    // CRITICAL FIX: If this is a pen/stylus input, NEVER treat it as multi-finger gesture
    if (isPenEvent(event)) {
      console.log('✅ Pen input confirmed, completely skipping multi-finger check');
      return false;
    }

    // If global pen detection says pen is active, skip multi-finger check
    if (isPenActive()) {
      console.log('✅ Global pen detection active, skipping multi-finger check');
      return false;
    }

    // Multiple comprehensive checks for multi-finger gestures (including 2-finger pinch)
    let touchCount = 0;
    let touches = null;

    // Get the touch count and touches from various event sources
    if (event.touches && event.touches.length >= 2) {
      touchCount = event.touches.length;
      touches = event.touches;
      console.log('🚫 React event: 2+ fingers detected:', touchCount);
    } else if (event.nativeEvent) {
      if (event.nativeEvent.touches && event.nativeEvent.touches.length >= 2) {
        touchCount = event.nativeEvent.touches.length;
        touches = event.nativeEvent.touches;
        console.log('🚫 Native event: 2+ fingers detected:', touchCount);
      } else if (event.nativeEvent.originalEvent && event.nativeEvent.originalEvent.touches && event.nativeEvent.originalEvent.touches.length >= 2) {
        touchCount = event.nativeEvent.originalEvent.touches.length;
        touches = event.nativeEvent.originalEvent.touches;
        console.log('🚫 Original event: 2+ fingers detected:', touchCount);
      }
    } else if ('targetTouches' in event && event.targetTouches && event.targetTouches.length >= 2) {
      touchCount = event.targetTouches.length;
      touches = event.targetTouches;
      console.log('🚫 Target touches: 2+ fingers detected:', touchCount);
    }

    // Store touch count for tracking
    lastTouchCountRef.current = Math.max(touchCount, lastTouchCountRef.current);

    // If we have 2+ fingers, analyze the distance for pinch detection
    if (touchCount >= 2 && touches) {
      const currentDistance = getTouchDistance(touches);

      // Store initial distance if this is the first multi-touch event
      if (initialTouchDistanceRef.current === null) {
        initialTouchDistanceRef.current = currentDistance;
        console.log('🚫 Initial touch distance recorded:', currentDistance);
      } else {
        // Check if this is a pinch gesture (distance changed significantly)
        const distanceChange = Math.abs(currentDistance - initialTouchDistanceRef.current);
        if (distanceChange > 10) { // 10px threshold for pinch detection
          console.log('🚫 Pinch gesture detected! Distance change:', distanceChange);
        }
      }

      return true;
    }

    // Check for scale-based pinch detection (iOS Safari)
    if (event.nativeEvent && 'scale' in event.nativeEvent && event.nativeEvent.scale !== 1) {
      console.log('🚫 Pinch gesture detected via scale:', event.nativeEvent.scale);
      return true;
    }

    // Reset distance tracking when no multi-touch is detected
    if (touchCount < 2) {
      initialTouchDistanceRef.current = null;
      lastTouchCountRef.current = 0;
    }

    return false;
  }, [getTouchDistance]);

  // COMPLETELY REWRITTEN: Handle mouse/touch/pointer events
  const handlePointerDown = useCallback(
    (event: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      if (isDisabled) return;
      if (!tools.pen || !tools.eraser || !tools.line || !tools.text) return;

      // Handle middle mouse button click for tool toggle
      if ('button' in event && event.button === 1 && onToolChange) {
        event.preventDefault();
        if (currentTool === 'select') {
          // Switch back to previous tool
          if (previousToolRef.current) {
            onToolChange(previousToolRef.current);
          }
        } else {
          // Save current tool and switch to select
          previousToolRef.current = currentTool;
          onToolChange('select');
        }
        return;
      }

      // Check if this is a pen/stylus input using our robust detection
      const isPenInput = isPenEvent(event.nativeEvent || event);

      if (isPenInput) {
        console.log('🔥 CONFIRMED PEN INPUT in handlePointerDown - PROCEEDING WITH DRAWING');
      }

      // For pen input, COMPLETELY BYPASS multi-finger gesture detection
      if (isPenInput) {
        console.log('✅ Pen input - bypassing ALL gesture checks');
        // Proceed directly to drawing logic
      } else {
        // Only check for multi-finger gestures for non-pen input
        if (isMultiFingerGesture(event)) {
          console.log('🚫 Multi-finger gesture detected, preventing drawing');
          // Cancel any current drawing
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            if (tools.pen && tools.pen.isActive()) {
              tools.pen.cancel();
            }
            if (tools.eraser && tools.eraser.isActive()) {
              tools.eraser.cancel();
              setToolActive('eraser', false); // Stop tracking eraser activity
            }
          }
          return;
        }
      }

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
          console.log(`🧹 AnnotationLayer.handlePointerDown - STARTING eraser tool`);
          setToolActive('eraser', true); // Track eraser tool activity
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
    [currentTool, tools, pageNumber, getTextAnnotationAtPoint, isDisabled, isMultiFingerGesture, onToolChange]
  );

  const handlePointerMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      if (isDisabled) return;

      // Update cursor position for line tool
      if (currentTool === 'line') {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const x = 'touches' in event.nativeEvent
            ? event.nativeEvent.touches[0].clientX - rect.left
            : event.nativeEvent.clientX - rect.left;
          const y = 'touches' in event.nativeEvent
            ? event.nativeEvent.touches[0].clientY - rect.top
            : event.nativeEvent.clientY - rect.top;
          setCursorPosition({ x, y });
        }
      } else {
        setCursorPosition(null);
      }

      // Check if this is a pen/stylus input using our robust detection
      const isPenInput = isPenEvent(event.nativeEvent || event);

      // For pen input, COMPLETELY BYPASS multi-finger gesture detection
      if (isPenInput) {
        console.log('✅ Pen input during move - bypassing ALL gesture checks');
        // Proceed directly to drawing logic
      } else {
        // Only check for multi-finger gestures for non-pen input
        if (isMultiFingerGesture(event)) {
          console.log('🚫 Multi-finger gesture detected during move, canceling drawing');
          // Cancel any current drawing immediately
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            if (tools.pen && tools.pen.isActive()) {
              tools.pen.cancel();
            }
            if (tools.eraser && tools.eraser.isActive()) {
              tools.eraser.cancel();
              setToolActive('eraser', false); // Stop tracking eraser activity
            }
            forceUpdate(prev => prev + 1); // Force re-render to clear drawing
          }
          return;
        }
      }
      
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
      if (currentTool === 'line' && tools.line && tools.line.isActive()) {
        tools.line.draw(event.nativeEvent);
        forceUpdate(prev => prev + 1);
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
    [currentTool, tools, annotations, onAnnotationRemove, forceUpdate, isDisabled, isMultiFingerGesture]
  );

  const handlePointerUp = useCallback(
    (event: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      // Check if this is a pen/stylus input using our robust detection
      const isPenInput = isPenEvent(event.nativeEvent || event);

      if (isPenInput) {
        console.log('🔥 CONFIRMED PEN INPUT in handlePointerUp - COMPLETING DRAWING NORMALLY');
      }

      // For pen input, COMPLETELY BYPASS multi-finger gesture detection
      if (isPenInput) {
        console.log('✅ Pen input - bypassing ALL gesture checks, proceeding to complete drawing');
        // Proceed directly to completion logic - NO CANCELLATION
      } else {
        // Only check for multi-finger gestures for non-pen input
        if (isMultiFingerGesture(event)) {
          console.log('🚫 Multi-finger gesture detected during up, canceling drawing');
          // Cancel any current drawing immediately
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            if (tools.pen && tools.pen.isActive()) {
              tools.pen.cancel();
            }
            if (tools.eraser && tools.eraser.isActive()) {
              tools.eraser.cancel();
              setToolActive('eraser', false); // Stop tracking eraser activity
            }
            forceUpdate(prev => prev + 1); // Force re-render to clear drawing
          }
          return;
        }
      }
      
      if (!tools.pen || !tools.eraser || !tools.line) return;

      isDrawingRef.current = false;

      // Complete the drawing operation (but not for line tool which uses click-based approach)
      const nativeEvent = event.nativeEvent || event;
      const eventType = (nativeEvent as PointerEvent).pointerType || 'unknown';
      console.log(`🎯 AnnotationLayer.handlePointerUp - Current tool: ${currentTool}, Event type: ${eventType}`);

      switch (currentTool) {
        case 'pen':
          console.log(`🎯 AnnotationLayer.handlePointerUp - CALLING tools.pen.stopDrawing for ${eventType} event`);
          tools.pen.stopDrawing(pageNumber);
          console.log(`🎯 AnnotationLayer.handlePointerUp - tools.pen.stopDrawing completed for ${eventType} event`);
          forceUpdate(prev => prev + 1); // Final update to show completed annotation
          break;
        case 'eraser':
          console.log(`🎯 AnnotationLayer.handlePointerUp - CALLING tools.eraser.stopErasing for ${eventType} event`);
          tools.eraser.stopErasing();
          console.log(`🧹 AnnotationLayer.handlePointerUp - STOPPING eraser tool`);
          setToolActive('eraser', false); // Stop tracking eraser tool activity
          break;
        case 'line':
          // Line tool uses two-click approach, don't stop on mouse up
          console.log(`🎯 AnnotationLayer.handlePointerUp - Skipping line tool for ${eventType} event`);
          break;
      }
    },
    [currentTool, tools, pageNumber, forceUpdate, isMultiFingerGesture]
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
    // Clear cursor position when leaving canvas
    setCursorPosition(null);

    if (!tools.pen || !tools.eraser || !tools.line) return;

    // CRITICAL FIX: Don't cancel pen drawing on pointer leave for touch pens
    // Touch pens often trigger pointer leave events during normal drawing
    if (isPenActive()) {
      console.log('🚫 handlePointerLeave - PEN ACTIVE, NOT cancelling drawing');
      return;
    }

    console.log('🚫 handlePointerLeave - Cancelling non-pen operations');
    isDrawingRef.current = false;

    // Stop tracking tool activities
    setToolActive('eraser', false);
    setToolActive('line', false);

    // Cancel active operations when pointer leaves canvas (but not for active pen)
    tools.pen.cancel();
    tools.eraser.cancel();
    tools.line.cancel();

    forceUpdate(prev => prev + 1); // Update to clear any temporary drawing
  }, [tools, forceUpdate]);

  // Define cursor style based on tool
  const getCursorStyle = () => {
    // Hide cursor for line tool (we draw custom indicator)
    if (currentTool === 'line') {
      return 'none';
    }
    switch (currentTool) {
      case 'eraser':
      case 'pen':
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
          touchAction: 'none' // Prevent default touch behaviors for precise gesture detection
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onDoubleClick={handleDoubleClick}
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