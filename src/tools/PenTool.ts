import { Point, PenAnnotation } from '../types';
import { generateId, getRelativePosition, screenPointsToNormalized } from '../utils/helpers';

interface SmoothPoint extends Point {
  pressure: number;
  timestamp: number;
}

export class PenTool {
  private canvas: HTMLCanvasElement;
  private isDrawing: boolean = false;
  private currentPath: SmoothPoint[] = [];
  private color: string = '#000000';
  private baseLineWidth: number = 2;
  private onAnnotationComplete?: (annotation: PenAnnotation) => void;
  
  // Simple, smooth settings to prevent spiky drawing
  private readonly MIN_DISTANCE = 1.5; // Reasonable sampling distance
  private readonly PRESSURE_SMOOTHING = 0.3; // Moderate pressure smoothing

  constructor(
    canvas: HTMLCanvasElement,
    _ctx: CanvasRenderingContext2D,
    onAnnotationComplete?: (annotation: PenAnnotation) => void
  ) {
    this.canvas = canvas;
    this.onAnnotationComplete = onAnnotationComplete;
  }

  setColor(color: string): void {
    this.color = color;
  }

  setLineWidth(width: number): void {
    this.baseLineWidth = width;
  }

  private getPressure(event: any): number {
    // Simple pressure detection
    if (event.pressure !== undefined && event.pressure > 0) {
      return Math.max(0.3, Math.min(1.0, event.pressure));
    }
    if (event.touches && event.touches[0] && event.touches[0].force !== undefined) {
      return Math.max(0.3, Math.min(1.0, event.touches[0].force));
    }
    return 0.7; // Default pressure
  }

  private shouldAddPoint(newPoint: SmoothPoint): boolean {
    if (this.currentPath.length === 0) return true;
    
    const lastPoint = this.currentPath[this.currentPath.length - 1];
    const distance = Math.sqrt(
      Math.pow(newPoint.x - lastPoint.x, 2) + 
      Math.pow(newPoint.y - lastPoint.y, 2)
    );
    
    return distance >= this.MIN_DISTANCE;
  }

  private smoothPressure(newPressure: number): number {
    if (this.currentPath.length === 0) return newPressure;
    
    const lastPoint = this.currentPath[this.currentPath.length - 1];
    const lastPressure = lastPoint.pressure;
    
    // Simple exponential smoothing
    return lastPressure + this.PRESSURE_SMOOTHING * (newPressure - lastPressure);
  }

  private createSmoothPath(): SmoothPoint[] {
    if (this.currentPath.length < 3) return this.currentPath;
    
    const smoothed: SmoothPoint[] = [];
    smoothed.push(this.currentPath[0]); // Keep first point
    
    // Simple averaging for smoothness without complexity
    for (let i = 1; i < this.currentPath.length - 1; i++) {
      const prev = this.currentPath[i - 1];
      const curr = this.currentPath[i];
      const next = this.currentPath[i + 1];
      
      // Average position for smooth curves
      const smoothedPoint: SmoothPoint = {
        x: (prev.x + curr.x + next.x) / 3,
        y: (prev.y + curr.y + next.y) / 3,
        pressure: (prev.pressure + curr.pressure + next.pressure) / 3,
        timestamp: curr.timestamp
      };
      
      smoothed.push(smoothedPoint);
    }
    
    smoothed.push(this.currentPath[this.currentPath.length - 1]); // Keep last point
    return smoothed;
  }

  startDrawing(event: MouseEvent | TouchEvent | PointerEvent): void {
    const eventType = (event as PointerEvent).pointerType || 'unknown';
    console.log(`🟢 PenTool.startDrawing - Event type: ${eventType}, isDrawing: ${this.isDrawing}`);

    this.isDrawing = true;
    this.currentPath = [];

    const point = getRelativePosition(event, this.canvas);
    const pressure = this.getPressure(event);

    console.log(`🟢 PenTool.startDrawing - Point: (${point.x}, ${point.y}), Pressure: ${pressure}`);

    this.currentPath.push({
      x: point.x,
      y: point.y,
      pressure,
      timestamp: performance.now()
    });

    console.log(`🟢 PenTool.startDrawing - Path length: ${this.currentPath.length}`);
  }

  draw(event: MouseEvent | TouchEvent | PointerEvent): void {
    const eventType = (event as PointerEvent).pointerType || 'unknown';

    if (!this.isDrawing) {
      console.log(`🔴 PenTool.draw - NOT DRAWING (Event type: ${eventType})`);
      return;
    }

    const point = getRelativePosition(event, this.canvas);
    const rawPressure = this.getPressure(event);
    const pressure = this.smoothPressure(rawPressure);

    const newPoint: SmoothPoint = {
      x: point.x,
      y: point.y,
      pressure,
      timestamp: performance.now()
    };

    if (this.shouldAddPoint(newPoint)) {
      this.currentPath.push(newPoint);
      console.log(`🟡 PenTool.draw - Added point (${eventType}), Path length: ${this.currentPath.length}`);
    } else {
      console.log(`🟡 PenTool.draw - Skipped point (${eventType}), too close`);
    }
  }

  stopDrawing(pageNumber: number): void {
    console.log(`🔴 PenTool.stopDrawing - isDrawing: ${this.isDrawing}, Path length: ${this.currentPath.length}, Page: ${pageNumber}`);

    if (!this.isDrawing) {
      console.log(`🔴 PenTool.stopDrawing - NOT DRAWING, returning early`);
      return;
    }

    this.isDrawing = false;
    console.log(`🔴 PenTool.stopDrawing - Set isDrawing to false`);

    if (this.currentPath.length > 1 && this.onAnnotationComplete) {
      console.log(`🔴 PenTool.stopDrawing - Creating annotation with ${this.currentPath.length} points`);

      // Create smooth path for final annotation
      const smoothPath = this.createSmoothPath();
      console.log(`🔴 PenTool.stopDrawing - Smoothed path has ${smoothPath.length} points`);

      // Convert to normalized coordinates
      const normalizedPoints = screenPointsToNormalized(
        smoothPath.map(p => ({ x: p.x, y: p.y })),
        this.canvas.width,
        this.canvas.height
      );
      console.log(`🔴 PenTool.stopDrawing - Normalized points: ${normalizedPoints.length}`);

      const annotation: PenAnnotation = {
        id: generateId(),
        type: 'pen',
        points: normalizedPoints,
        color: this.color,
        width: this.baseLineWidth,
        timestamp: Date.now(),
        pageNumber,
      };

      console.log(`🔥 PenTool.stopDrawing - CALLING onAnnotationComplete with annotation ID: ${annotation.id}`);
      this.onAnnotationComplete(annotation);
      console.log(`🔥 PenTool.stopDrawing - onAnnotationComplete CALLED successfully`);
    } else {
      console.log(`🔴 PenTool.stopDrawing - NOT creating annotation - Path length: ${this.currentPath.length}, onAnnotationComplete exists: ${!!this.onAnnotationComplete}`);
    }

    this.currentPath = [];
    console.log(`🔴 PenTool.stopDrawing - Cleared currentPath`);
  }

  cancel(): void {
    console.log(`🚫 PenTool.cancel - CANCELLING DRAWING! Path length was: ${this.currentPath.length}`);
    console.trace('🚫 PenTool.cancel - STACK TRACE:'); // スタックトレースで呼び出し元を特定
    this.isDrawing = false;
    this.currentPath = [];
    console.log(`🚫 PenTool.cancel - Cancelled and cleared path`);
  }

  isActive(): boolean {
    return this.isDrawing;
  }

  getCurrentPath(): { 
    points: Point[]; 
    color: string; 
    lineWidth: number; 
    pressurePoints?: SmoothPoint[];
  } | null {
    if (!this.isDrawing || this.currentPath.length === 0) return null;
    
    // Create smooth path for preview
    const smoothPath = this.createSmoothPath();
    
    return {
      points: smoothPath.map(p => ({ x: p.x, y: p.y })),
      color: this.color,
      lineWidth: this.baseLineWidth,
      pressurePoints: smoothPath
    };
  }
}