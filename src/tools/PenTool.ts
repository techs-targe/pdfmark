import { Point, PenAnnotation } from '../types';
import { generateId, getRelativePosition, smoothPath, screenPointsToNormalized } from '../utils/helpers';

export class PenTool {
  private canvas: HTMLCanvasElement;
  private isDrawing: boolean = false;
  private currentPath: Point[] = [];
  private color: string = '#000000';
  private lineWidth: number = 2;
  private onAnnotationComplete?: (annotation: PenAnnotation) => void;

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
    this.lineWidth = width;
  }

  startDrawing(event: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    this.currentPath = [];
    
    const point = getRelativePosition(event, this.canvas);
    this.currentPath.push(point);
    
    // Don't draw directly to canvas - let the annotation layer handle it
    // this.ctx.beginPath();
    // this.ctx.moveTo(point.x, point.y);
    // this.ctx.strokeStyle = this.color;
    // this.ctx.lineWidth = this.lineWidth;
    // this.ctx.lineCap = 'round';
    // this.ctx.lineJoin = 'round';
  }

  draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    
    const point = getRelativePosition(event, this.canvas);
    this.currentPath.push(point);
    
    // Don't draw directly to canvas - let the annotation layer handle it
    // this.ctx.lineTo(point.x, point.y);
    // this.ctx.stroke();
  }

  stopDrawing(pageNumber: number): void {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    if (this.currentPath.length > 1 && this.onAnnotationComplete) {
      // Smooth the path first
      const smoothedPath = smoothPath(this.currentPath);
      
      // Convert to normalized coordinates (0-1)
      const normalizedPoints = screenPointsToNormalized(
        smoothedPath,
        this.canvas.width,
        this.canvas.height
      );
      
      const annotation: PenAnnotation = {
        id: generateId(),
        type: 'pen',
        points: normalizedPoints,
        color: this.color,
        width: this.lineWidth,
        timestamp: Date.now(),
        pageNumber,
      };
      
      this.onAnnotationComplete(annotation);
    }
    
    this.currentPath = [];
  }

  cancel(): void {
    this.isDrawing = false;
    this.currentPath = [];
  }

  isActive(): boolean {
    return this.isDrawing;
  }

  getCurrentPath(): { points: Point[], color: string, lineWidth: number } | null {
    if (!this.isDrawing || this.currentPath.length === 0) return null;
    return {
      points: this.currentPath,
      color: this.color,
      lineWidth: this.lineWidth
    };
  }
}