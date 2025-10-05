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

  // Track active pointer IDs to detect multi-finger gestures (3-4 fingers)
  const activePointerIds = useRef<Set<number>>(new Set());

  // Pending annotations that haven't been added to parent state yet (prevents race condition)
  const [pendingAnnotations, setPendingAnnotations] = useState<Annotation[]>([]);

  // Use refs to keep stable tool instances
  const toolsRef = useRef<{
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

  // Keep a state version for triggering re-renders when needed
  const [toolsInitialized, setToolsInitialized] = useState(false);

  // Store onAnnotationAdd in ref to avoid recreating handleAnnotationAdd
  const onAnnotationAddRef = useRef(onAnnotationAdd);
  useEffect(() => {
    onAnnotationAddRef.current = onAnnotationAdd;
  }, [onAnnotationAdd]);

  // Wrapper for onAnnotationAdd that handles pending state
  // CRITICAL: No dependencies to avoid recreating and causing tool re-initialization
  const handleAnnotationAdd = useCallback((annotation: Annotation) => {
    // Add to pending immediately (synchronous)
    setPendingAnnotations(prev => {
      const newPending = [...prev, annotation];
      return newPending;
    });

    // Notify parent (asynchronous state update) using ref
    onAnnotationAddRef.current(annotation);

    // Remove from pending after parent state should have updated
    setTimeout(() => {
      setPendingAnnotations(prev => prev.filter(a => a.id !== annotation.id));
    }, 50);
  }, []); // Empty dependency array - stable callback

  // Initialize tools once and keep them stable
  useEffect(() => {
    if (!canvasRef.current) return;
    if (toolsInitialized) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    toolsRef.current = {
      pen: new PenTool(canvas, ctx, handleAnnotationAdd),
      eraser: new EraserTool(canvas, ctx, (ids) => ids.forEach(onAnnotationRemove)),
      line: new LineTool(canvas, ctx, handleAnnotationAdd),
      text: new TextTool(canvas, ctx, handleAnnotationAdd),
    };

    setToolsInitialized(true);

    const handleGestureStart = (e: Event) => {
      if (isPenActive()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (isDrawingRef.current && toolsRef.current.pen?.isActive()) {
        toolsRef.current.pen.cancel();
        isDrawingRef.current = false;
        forceUpdate(prev => prev + 1);
      }
      setToolActive('eraser', false);
      setToolActive('line', false);
    };

    const handleGestureChange = (e: Event) => {
      if (isPenActive()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (isDrawingRef.current) {
        if (toolsRef.current.pen?.isActive()) toolsRef.current.pen.cancel();
        if (toolsRef.current.eraser?.isActive()) toolsRef.current.eraser.cancel();
        isDrawingRef.current = false;
        forceUpdate(prev => prev + 1);
      }
      setToolActive('eraser', false);
      setToolActive('line', false);
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    canvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
    canvas.addEventListener('gesturechange', handleGestureChange, { passive: false });
    canvas.addEventListener('gestureend', handleGestureEnd, { passive: false });

    return () => {
      if (toolsRef.current.text) toolsRef.current.text.cancel();
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureChange);
      canvas.removeEventListener('gestureend', handleGestureEnd);
    };
  }, [toolsInitialized]); // Removed handleAnnotationAdd from dependencies

  // Cancel previous tool when switching tools
  useEffect(() => {
    if (!toolsInitialized) return;
    if (toolsRef.current.line && currentTool !== 'line') {
      // Cancel line tool when switching away from it
      if (toolsRef.current.line.isActive()) {
        toolsRef.current.line.cancel();
        forceUpdate(prev => prev + 1);
      }
    }
    if (toolsRef.current.pen && currentTool !== 'pen') {
      if (toolsRef.current.pen.isActive()) {
        toolsRef.current.pen.cancel();
        forceUpdate(prev => prev + 1);
      }
    }
  }, [currentTool, toolsInitialized]);

  // Handle Escape key to reset line tool
  useEffect(() => {
    if (!toolsInitialized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentTool === 'line' && toolsRef.current.line && toolsRef.current.line.isActive()) {
          toolsRef.current.line.cancel();
          forceUpdate(prev => prev + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTool, toolsInitialized]);

  // Update tool settings
  useEffect(() => {
    if (!toolsInitialized) return;
    if (toolsRef.current.pen) {
      toolsRef.current.pen.setColor(toolSettings.color);
      toolsRef.current.pen.setLineWidth(toolSettings.lineWidth);
    }
    if (toolsRef.current.eraser) {
      toolsRef.current.eraser.setEraserSize(toolSettings.eraserSize);
    }
    if (toolsRef.current.line) {
      toolsRef.current.line.setColor(toolSettings.color);
      toolsRef.current.line.setLineWidth(toolSettings.lineWidth);
    }
    if (toolsRef.current.text) {
      toolsRef.current.text.setColor(toolSettings.color);
      toolsRef.current.text.setFontSize(toolSettings.fontSize);
    }
  }, [toolsInitialized, toolSettings]);

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

    // Draw saved annotations (only those for this page) + pending annotations
    const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
    const pagePendingAnnotations = pendingAnnotations.filter(a => a.pageNumber === pageNumber);
    const allAnnotations = [...pageAnnotations, ...pagePendingAnnotations];

    allAnnotations.forEach((annotation) => {
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
    if (toolsRef.current.pen && toolsRef.current.pen.isActive()) {
      const currentPath = toolsRef.current.pen.getCurrentPath();
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
    if (currentTool === 'line' && toolsRef.current.line && toolsRef.current.line.isActive()) {
      const currentLine = toolsRef.current.line.getCurrentLine();
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
    if (currentTool === 'line' && cursorPosition && toolsRef.current.line) {
      const state = toolsRef.current.line.getState();
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
  }, [annotations, pendingAnnotations, canvasWidth, canvasHeight, toolsInitialized, currentTool, pageNumber, renderCounter, cursorPosition]);

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
      return false;
    }

    // If global pen detection says pen is active, skip multi-finger check
    if (isPenActive()) {
      return false;
    }

    // Multiple comprehensive checks for multi-finger gestures (including 2-finger pinch)
    let touchCount = 0;
    let touches = null;

    // Get the touch count and touches from various event sources
    if (event.touches && event.touches.length >= 2) {
      touchCount = event.touches.length;
      touches = event.touches;
    } else if (event.nativeEvent) {
      if (event.nativeEvent.touches && event.nativeEvent.touches.length >= 2) {
        touchCount = event.nativeEvent.touches.length;
        touches = event.nativeEvent.touches;
      } else if (event.nativeEvent.originalEvent && event.nativeEvent.originalEvent.touches && event.nativeEvent.originalEvent.touches.length >= 2) {
        touchCount = event.nativeEvent.originalEvent.touches.length;
        touches = event.nativeEvent.originalEvent.touches;
      }
    } else if ('targetTouches' in event && event.targetTouches && event.targetTouches.length >= 2) {
      touchCount = event.targetTouches.length;
      touches = event.targetTouches;
    }

    // Store touch count for tracking
    lastTouchCountRef.current = Math.max(touchCount, lastTouchCountRef.current);

    // If we have 2+ fingers, analyze the distance for pinch detection
    if (touchCount >= 2 && touches) {
      const currentDistance = getTouchDistance(touches);

      // Store initial distance if this is the first multi-touch event
      if (initialTouchDistanceRef.current === null) {
        initialTouchDistanceRef.current = currentDistance;
      } else {
        // Check if this is a pinch gesture (distance changed significantly)
        const distanceChange = Math.abs(currentDistance - initialTouchDistanceRef.current);
        if (distanceChange > 10) { // 10px threshold for pinch detection
          // Pinch gesture detected
        }
      }

      return true;
    }

    // Check for scale-based pinch detection (iOS Safari)
    if (event.nativeEvent && 'scale' in event.nativeEvent && event.nativeEvent.scale !== 1) {
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
      if (!toolsRef.current.pen || !toolsRef.current.eraser || !toolsRef.current.line || !toolsRef.current.text) return;

      // Check if this is a pen/stylus input first
      const isPenInput = isPenEvent(event.nativeEvent || event);

      // Check if this is a mouse input (only 1 pointer possible)
      const isMouseInput = 'pointerType' in event && event.pointerType === 'mouse';

      // Track pointer ID for multi-finger gesture detection (but NOT for pen or mouse input)
      if ('pointerId' in event && !isPenInput && !isMouseInput) {
        activePointerIds.current.add(event.pointerId);
        const allPointerIds = Array.from(activePointerIds.current).join(', ');
        console.log(`👆 Pointer down: ${event.pointerId}, total active: ${activePointerIds.current.size}, IDs: [${allPointerIds}], pointerType: ${event.pointerType}`);

        // CRITICAL: Block drawing if 2+ fingers are active (including 3-4 finger gestures)
        if (activePointerIds.current.size >= 2) {
          console.log(`🚫 Multi-finger gesture detected (${activePointerIds.current.size} fingers), blocking drawing. IDs: [${allPointerIds}]`);
          // Cancel any current drawing
          if (isDrawingRef.current) {
            console.log('🚫 Canceling active drawing due to multi-finger gesture');
            isDrawingRef.current = false;
            if (toolsRef.current.pen && toolsRef.current.pen.isActive()) {
              toolsRef.current.pen.cancel();
            }
            if (toolsRef.current.eraser && toolsRef.current.eraser.isActive()) {
              toolsRef.current.eraser.cancel();
              setToolActive('eraser', false);
            }
            if (toolsRef.current.line && toolsRef.current.line.isActive()) {
              toolsRef.current.line.cancel();
            }
          }
          return; // Don't process this event for drawing
        }
      }

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

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in event
        ? event.touches[0].clientX - rect.left
        : 'clientX' in event
        ? event.clientX - rect.left
        : 0;
      const y = 'touches' in event
        ? event.touches[0].clientY - rect.top
        : 'clientY' in event
        ? event.clientY - rect.top
        : 0;

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

      // CRITICAL: Final check before starting drawing - ensure only 1 finger is active
      // This prevents race conditions where a second finger is added between the initial check and drawing start
      // Exception: Allow pen/stylus and mouse input (which don't use activePointerIds tracking)
      if (!isPenInput && !isMouseInput && activePointerIds.current.size !== 1) {
        console.log(`🚫 Refusing to start drawing: ${activePointerIds.current.size} fingers detected (touch input only)`);
        return;
      }

      // For line tool, don't set isDrawingRef as we use click-based approach
      if (currentTool !== 'line') {
        isDrawingRef.current = true;
      }

      // Start drawing based on current tool
      switch (currentTool) {
        case 'pen':
          toolsRef.current.pen.startDrawing(event.nativeEvent);
          break;
        case 'eraser':
          setToolActive('eraser', true); // Track eraser tool activity
          toolsRef.current.eraser.startErasing(event.nativeEvent);
          break;
        case 'text':
          toolsRef.current.text.createTextInput(event.nativeEvent, pageNumber);
          break;
        case 'line':
          // Line tool uses two-click approach
          // Update cursor position on click
          setCursorPosition({ x, y });

          console.log('🔵 LINE - handlePointerDown, isActive:', toolsRef.current.line.isActive(), 'coords:', { x, y });

          if (!toolsRef.current.line.isActive()) {
            // First click - start line
            console.log('🔵 LINE - First click, calling startDrawing');
            toolsRef.current.line.startDrawing(event.nativeEvent);
            forceUpdate(prev => prev + 1);
          } else {
            // Second click - complete line
            console.log('🔵 LINE - Second click, calling stopDrawing, pageNumber:', pageNumber);
            toolsRef.current.line.stopDrawing(event.nativeEvent, pageNumber);
            forceUpdate(prev => prev + 1);
          }
          break;
      }
    },
    [currentTool, toolsInitialized, pageNumber, getTextAnnotationAtPoint, isDisabled, onToolChange]
  );

  const handlePointerMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      if (isDisabled) return;
      if (!toolsInitialized) return;

      // CRITICAL: Block drawing during multi-finger gestures
      if (activePointerIds.current.size >= 2) {
        // Cancel any active drawing
        if (isDrawingRef.current) {
          const allPointerIds = Array.from(activePointerIds.current).join(', ');
          console.log(`🚫 MOVE: Canceling drawing - ${activePointerIds.current.size} fingers active. IDs: [${allPointerIds}]`);
          isDrawingRef.current = false;
          if (toolsRef.current.pen && toolsRef.current.pen.isActive()) {
            toolsRef.current.pen.cancel();
            console.log('🚫 MOVE: Canceled pen drawing');
          }
          if (toolsRef.current.eraser && toolsRef.current.eraser.isActive()) {
            toolsRef.current.eraser.cancel();
            setToolActive('eraser', false);
            console.log('🚫 MOVE: Canceled eraser');
          }
          if (toolsRef.current.line && toolsRef.current.line.isActive()) {
            toolsRef.current.line.cancel();
            console.log('🚫 MOVE: Canceled line drawing');
          }
        }
        return; // Don't process move events during multi-finger gestures
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

      // Update cursor position for line tool
      if (currentTool === 'line') {
        setCursorPosition({ x, y });
      } else {
        setCursorPosition(null);
      }

      // For line tool, ALWAYS update preview when active
      if (currentTool === 'line' && toolsRef.current.line) {
        if (toolsRef.current.line.isActive()) {
          toolsRef.current.line.draw(event.nativeEvent);
          forceUpdate(prev => prev + 1);
        }
        return;
      }

      // For other tools, only draw if isDrawingRef is true
      if (!isDrawingRef.current) return;

      switch (currentTool) {
        case 'pen':
          if (toolsRef.current.pen) {
            toolsRef.current.pen.draw(event.nativeEvent);
            forceUpdate(prev => prev + 1);
          }
          break;
        case 'eraser':
          if (toolsRef.current.eraser) {
            toolsRef.current.eraser.erase(event.nativeEvent);
            if (toolsRef.current.eraser.isActive()) {
              const point = { x, y };
              const toErase = toolsRef.current.eraser.checkAnnotationsForErasure(point, annotations);
              toErase.forEach(onAnnotationRemove);
            }
          }
          break;
      }
    },
    [currentTool, toolsInitialized, annotations, onAnnotationRemove, isDisabled]
  );

  const handlePointerUp = useCallback(
    (event: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      // Remove pointer ID from active set (only for touch input)
      if ('pointerId' in event) {
        const wasDeleted = activePointerIds.current.delete(event.pointerId);
        if (wasDeleted) {
          const allPointerIds = Array.from(activePointerIds.current).join(', ');
          console.log(`👆 Pointer up: ${event.pointerId}, remaining active: ${activePointerIds.current.size}, IDs: [${allPointerIds}]`);
        }
      }

      if (!toolsRef.current.pen || !toolsRef.current.eraser || !toolsRef.current.line) return;

      // CRITICAL: Line tool uses click-based approach, completely skip
      if (currentTool === 'line') {
        return;
      }

      // For other tools, reset drawing state
      isDrawingRef.current = false;

      switch (currentTool) {
        case 'pen':
          toolsRef.current.pen.stopDrawing(pageNumber);
          // Force update to show pending annotation immediately
          forceUpdate(prev => prev + 1);
          break;
        case 'eraser':
          toolsRef.current.eraser.stopErasing();
          setToolActive('eraser', false); // Stop tracking eraser tool activity
          break;
      }
    },
    [currentTool, toolsInitialized, pageNumber]
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
    // Clear all active pointer IDs when leaving canvas
    if (activePointerIds.current.size > 0) {
      console.log(`👆 Pointer leave: clearing all ${activePointerIds.current.size} active pointers`);
      activePointerIds.current.clear();
    }

    // Clear cursor position when leaving canvas
    setCursorPosition(null);

    if (!toolsRef.current.pen || !toolsRef.current.eraser || !toolsRef.current.line) return;

    // CRITICAL FIX: Don't cancel pen drawing on pointer leave for touch pens
    // Touch pens often trigger pointer leave events during normal drawing
    if (isPenActive()) {
      return;
    }

    // CRITICAL FIX: Don't cancel line tool - it uses click-based approach
    if (currentTool === 'line') {
      return;
    }

    isDrawingRef.current = false;

    // Stop tracking tool activities
    setToolActive('eraser', false);
    setToolActive('line', false);

    // Cancel active operations when pointer leaves canvas (but not for active pen or line tool)
    toolsRef.current.pen.cancel();
    toolsRef.current.eraser.cancel();

    forceUpdate(prev => prev + 1); // Update to clear any temporary drawing
  }, [toolsInitialized, currentTool]);

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
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