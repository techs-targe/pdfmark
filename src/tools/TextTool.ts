import { TextAnnotation } from '../types';
import { generateId, getRelativePosition, screenToNormalized } from '../utils/helpers';

export class TextTool {
  private canvas: HTMLCanvasElement;
  // private ctx: CanvasRenderingContext2D;
  private color: string = '#000000';
  private fontSize: number = 16;
  private onAnnotationComplete?: (annotation: TextAnnotation) => void;
  private activeInput: HTMLInputElement | null = null;
  private isInputFocused: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    _ctx: CanvasRenderingContext2D,
    onAnnotationComplete?: (annotation: TextAnnotation) => void
  ) {
    this.canvas = canvas;
    // this.ctx = ctx;
    this.onAnnotationComplete = onAnnotationComplete;
  }

  setColor(color: string): void {
    this.color = color;
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  createTextInput(event: MouseEvent | TouchEvent, pageNumber: number): void {
    // Remove any existing input
    this.removeActiveInput();
    
    const point = getRelativePosition(event, this.canvas);
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'absolute border-2 border-blue-500 bg-white rounded px-2 py-1 z-50';
    input.style.left = `${point.x}px`;
    input.style.top = `${point.y - this.fontSize / 2}px`;
    input.style.fontSize = `${this.fontSize}px`;
    input.style.color = this.color;
    input.style.minWidth = '150px';
    
    // Add input to canvas parent
    const canvasParent = this.canvas.parentElement;
    if (canvasParent) {
      canvasParent.style.position = 'relative';
      canvasParent.appendChild(input);
    }
    
    this.activeInput = input;
    this.isInputFocused = true;
    
    // Set focus after a small delay to ensure proper event handling
    setTimeout(() => {
      input.focus();
      input.select();
    }, 10);
    
    // Handle input completion
    const completeText = () => {
      const text = input.value.trim();
      if (text && this.onAnnotationComplete) {
        // Convert to normalized coordinates (0-1)
        const normalizedPosition = screenToNormalized(
          point,
          this.canvas.width,
          this.canvas.height
        );
        
        // Calculate initial text width and height based on content
        // Use a fixed normalized size based on the font size and text length
        // This ensures consistent sizing regardless of zoom level
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        let normalizedWidth = 0.2; // Default width
        let normalizedHeight = 0.03; // Default height
        
        if (tempCtx) {
          tempCtx.font = `${this.fontSize}px sans-serif`;
          const metrics = tempCtx.measureText(text);
          
          // Calculate normalized size based on the text metrics
          // Use a base canvas size of 800x600 for normalization (typical PDF page aspect)
          const baseCanvasWidth = 800;
          const baseCanvasHeight = 600;
          const textWidth = metrics.width;
          const textHeight = this.fontSize * 1.5; // Line height multiplier
          
          // Normalize against base size, not current canvas size
          normalizedWidth = Math.min(0.8, textWidth / baseCanvasWidth);
          normalizedHeight = Math.min(0.2, textHeight / baseCanvasHeight);
          
          // Ensure minimum size
          normalizedWidth = Math.max(0.1, normalizedWidth);
          normalizedHeight = Math.max(0.02, normalizedHeight);
        }
        
        const annotation: TextAnnotation = {
          id: generateId(),
          type: 'text',
          position: normalizedPosition,
          content: text,
          fontSize: this.fontSize,
          color: this.color,
          width: normalizedWidth,
          height: normalizedHeight,
          timestamp: Date.now(),
          pageNumber,
        };
        
        this.onAnnotationComplete(annotation);
        
        // Note: Don't draw text here since it's in normalized coords
        // The annotation layer will handle drawing with proper transformation
      }
      
      this.removeActiveInput();
    };
    
    // Event listeners
    input.addEventListener('focus', () => {
      this.isInputFocused = true;
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        completeText();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.removeActiveInput();
      }
    });
    
    input.addEventListener('blur', () => {
      this.isInputFocused = false;
      // Only complete text if not clicking within the input or if actually losing focus
      setTimeout(() => {
        if (!this.isInputFocused && this.activeInput) {
          completeText();
        }
      }, 200);
    });
  }

  // No longer used - drawing is handled by AnnotationLayer with coordinate transformation
  // drawText(annotation: TextAnnotation): void {
  //   this.ctx.save();
  //   this.ctx.font = `${annotation.fontSize}px sans-serif`;
  //   this.ctx.fillStyle = annotation.color;
  //   this.ctx.textBaseline = 'top';
  //   this.ctx.fillText(annotation.content, annotation.position.x, annotation.position.y);
  //   this.ctx.restore();
  // }

  removeActiveInput(): void {
    if (this.activeInput) {
      this.activeInput.remove();
      this.activeInput = null;
      this.isInputFocused = false;
    }
  }

  cancel(): void {
    this.removeActiveInput();
  }

  isActive(): boolean {
    return this.activeInput !== null;
  }
}