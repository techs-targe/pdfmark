import { Point, LineAnnotation } from '../types';
import { generateId, getRelativePosition, screenToNormalized } from '../utils/helpers';

export class LineTool {
  private canvas: HTMLCanvasElement;
  private isDrawing: boolean = false;
  private hasStartPoint: boolean = false;
  private startPoint: Point | null = null;
  private color: string = '#000000';
  private lineWidth: number = 2;
  private onAnnotationComplete?: (annotation: LineAnnotation) => void;
  private currentEndPoint: Point | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    _ctx: CanvasRenderingContext2D,
    onAnnotationComplete?: (annotation: LineAnnotation) => void
  ) {
    this.canvas = canvas;
    this.onAnnotationComplete = onAnnotationComplete;
  }


  setColor(color: string): void {
    this.color = color;
  }

  setLineWidth(width: number): void {
    this.lineWidth = width;
  }

  startDrawing(event: MouseEvent | TouchEvent): void {
    const point = getRelativePosition(event, this.canvas);

    if (!this.hasStartPoint) {
      // First click - set start point
      this.hasStartPoint = true;
      this.isDrawing = true;
      this.startPoint = point;
      this.currentEndPoint = point;
    } else {
      // Second click - complete the line
      this.stopDrawing(event, 1); // pageNumber will be passed properly from AnnotationLayer
    }
  }

  draw(event: MouseEvent | TouchEvent): void {
    if (!this.hasStartPoint || !this.startPoint) {
      return;
    }

    // Update preview line endpoint as mouse moves
    const rawEndPoint = getRelativePosition(event, this.canvas);

    // Check if Shift key is pressed (allow free drawing)
    const isShiftPressed = 'shiftKey' in event && event.shiftKey;

    if (!isShiftPressed) {
      // Auto-snap to horizontal or vertical line
      const dx = Math.abs(rawEndPoint.x - this.startPoint.x);
      const dy = Math.abs(rawEndPoint.y - this.startPoint.y);

      // If horizontal movement is greater, make it horizontal
      if (dx > dy) {
        this.currentEndPoint = { x: rawEndPoint.x, y: this.startPoint.y };
      } else {
        // Otherwise, make it vertical
        this.currentEndPoint = { x: this.startPoint.x, y: rawEndPoint.y };
      }
    } else {
      // Shift key pressed: allow free drawing
      this.currentEndPoint = rawEndPoint;
    }
    // Don't draw directly - let annotation layer handle it
  }

  stopDrawing(event: MouseEvent | TouchEvent, pageNumber: number): void {
    if (!this.hasStartPoint || !this.startPoint) {
      return;
    }

    const rawEndPoint = getRelativePosition(event, this.canvas);

    // Check if Shift key is pressed (allow free drawing)
    const isShiftPressed = 'shiftKey' in event && event.shiftKey;

    let endPoint: Point;
    if (!isShiftPressed) {
      // Auto-snap to horizontal or vertical line
      const dx = Math.abs(rawEndPoint.x - this.startPoint.x);
      const dy = Math.abs(rawEndPoint.y - this.startPoint.y);

      // If horizontal movement is greater, make it horizontal
      if (dx > dy) {
        endPoint = { x: rawEndPoint.x, y: this.startPoint.y };
      } else {
        // Otherwise, make it vertical
        endPoint = { x: this.startPoint.x, y: rawEndPoint.y };
      }
    } else {
      // Shift key pressed: allow free drawing
      endPoint = rawEndPoint;
    }

    // Only complete if we have both points
    if (this.hasStartPoint && this.onAnnotationComplete) {
      // Convert to normalized coordinates (0-1)
      const normalizedStart = screenToNormalized(
        this.startPoint,
        this.canvas.width,
        this.canvas.height
      );
      const normalizedEnd = screenToNormalized(
        endPoint,
        this.canvas.width,
        this.canvas.height
      );

      const annotation: LineAnnotation = {
        id: generateId(),
        type: 'line',
        start: normalizedStart,
        end: normalizedEnd,
        color: this.color,
        width: this.lineWidth,
        timestamp: Date.now(),
        pageNumber,
      };

      this.onAnnotationComplete(annotation);
    }

    // Reset state
    this.hasStartPoint = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.currentEndPoint = null;
  }

  cancel(): void {
    this.hasStartPoint = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.currentEndPoint = null;
  }

  isActive(): boolean {
    return this.hasStartPoint || this.isDrawing;
  }

  getState(): 'waiting-first' | 'waiting-second' {
    return this.hasStartPoint ? 'waiting-second' : 'waiting-first';
  }

  updateCanvasSize(_width: number, _height: number): void {
    // No longer needed
  }

  getCurrentLine(): { start: Point, end: Point, color: string, lineWidth: number } | null {
    if (!this.hasStartPoint || !this.startPoint || !this.currentEndPoint) {
      return null;
    }
    return {
      start: this.startPoint,
      end: this.currentEndPoint,
      color: this.color,
      lineWidth: this.lineWidth
    };
  }
}