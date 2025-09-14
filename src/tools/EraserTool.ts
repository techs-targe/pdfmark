import { Point, Annotation } from '../types';
import { getRelativePosition, distance, normalizedToScreen, normalizedPointsToScreen } from '../utils/helpers';
import { setToolActive } from '../utils/penDetection';

export class EraserTool {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _isErasing: boolean = false;
  private eraserSize: number = 20;

  // Defensive getter/setter to track all changes to isErasing
  private get isErasing(): boolean {
    return this._isErasing;
  }

  private set isErasing(value: boolean) {
    if (this._isErasing !== value) {
      const stack = new Error().stack;
      console.log(`🔧 EraserTool.isErasing - CHANGED from ${this._isErasing} to ${value}`);
      console.log(`🔧 EraserTool.isErasing - STACK TRACE:`);
      console.log(stack);
      this._isErasing = value;
    }
  }

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    _onErase?: (annotationIds: string[]) => void
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  setEraserSize(size: number): void {
    this.eraserSize = size;
  }

  startErasing(event: MouseEvent | TouchEvent): void {
    const eventType = (event as PointerEvent).pointerType || 'unknown';
    console.log(`🧹 EraserTool.startErasing - Event type: ${eventType}, isErasing: ${this.isErasing}`);
    this.isErasing = true;
    setToolActive('eraser', true); // 確実にツール追跡を開始
    console.log(`🧹 EraserTool.startErasing - Set isErasing to true and activated tool tracking`);
    this.erase(event);
  }

  erase(event: MouseEvent | TouchEvent): void {
    const eventType = (event as PointerEvent).pointerType || 'unknown';

    if (!this.isErasing) {
      console.log(`🧹 EraserTool.erase - NOT ERASING (Event type: ${eventType})`);
      return;
    }

    const point = getRelativePosition(event, this.canvas);
    console.log(`🧹 EraserTool.erase - Erasing at (${point.x}, ${point.y}) with ${eventType}`);

    // Clear a circular area
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, this.eraserSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Show eraser cursor outline
    this.showEraserCursor(point);
  }

  stopErasing(): void {
    console.log(`🧹 EraserTool.stopErasing - isErasing: ${this.isErasing}`);
    console.trace('🧹 EraserTool.stopErasing - STACK TRACE:'); // スタックトレースで呼び出し元を特定
    this.isErasing = false;
    setToolActive('eraser', false); // 確実にツール追跡を停止
    console.log(`🧹 EraserTool.stopErasing - Set isErasing to false and deactivated tool tracking`);
    this.hideEraserCursor();
  }

  cancel(): void {
    console.log(`🚫 EraserTool.cancel - CANCELLING ERASING! isErasing was: ${this.isErasing}`);
    console.trace('🚫 EraserTool.cancel - STACK TRACE:'); // スタックトレースで呼び出し元を特定
    this.isErasing = false;
    this.hideEraserCursor();
    console.log(`🚫 EraserTool.cancel - Cancelled and cleared eraser state`);
  }

  isActive(): boolean {
    return this.isErasing;
  }

  // Check if annotations should be erased based on position
  checkAnnotationsForErasure(
    point: Point,
    annotations: Annotation[]
  ): string[] {
    const erasedIds: string[] = [];
    const eraserRadius = this.eraserSize / 2;

    for (const annotation of annotations) {
      let shouldErase = false;

      if (annotation.type === 'pen') {
        // Convert normalized points to screen coordinates
        const screenPoints = normalizedPointsToScreen(
          annotation.points,
          this.canvas.width,
          this.canvas.height
        );
        
        // Check if any point in the path is within eraser radius
        for (const p of screenPoints) {
          if (distance(point, p) <= eraserRadius) {
            shouldErase = true;
            break;
          }
        }
      } else if (annotation.type === 'line') {
        // Convert normalized start/end to screen coordinates
        const screenStart = normalizedToScreen(
          annotation.start,
          this.canvas.width,
          this.canvas.height
        );
        const screenEnd = normalizedToScreen(
          annotation.end,
          this.canvas.width,
          this.canvas.height
        );
        
        // Check if any point in the line is within eraser radius
        const points = [screenStart, screenEnd];
        for (const p of points) {
          if (distance(point, p) <= eraserRadius) {
            shouldErase = true;
            break;
          }
        }
      } else if (annotation.type === 'text') {
        // Convert normalized position to screen coordinates
        const screenPosition = normalizedToScreen(
          annotation.position,
          this.canvas.width,
          this.canvas.height
        );
        
        // Check if text position is within eraser radius
        if (distance(point, screenPosition) <= eraserRadius) {
          shouldErase = true;
        }
      }

      if (shouldErase) {
        erasedIds.push(annotation.id);
      }
    }

    return erasedIds;
  }

  private showEraserCursor(point: Point): void {
    // Draw eraser cursor outline
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, this.eraserSize / 2, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private hideEraserCursor(): void {
    // Cursor will be cleared on next redraw
  }
}