import { Point } from '../types';

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate distance between two points
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Check if point is within bounds
export function isPointInBounds(point: Point, bounds: DOMRect): boolean {
  return (
    point.x >= 0 &&
    point.x <= bounds.width &&
    point.y >= 0 &&
    point.y <= bounds.height
  );
}

// Get mouse/touch position relative to element
export function getRelativePosition(
  event: MouseEvent | TouchEvent,
  element: HTMLElement
): Point {
  const rect = element.getBoundingClientRect();
  
  if ('touches' in event && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top,
    };
  }
  
  const mouseEvent = event as MouseEvent;
  return {
    x: mouseEvent.clientX - rect.left,
    y: mouseEvent.clientY - rect.top,
  };
}

// Smooth path points for better drawing
export function smoothPath(points: Point[], tension: number = 0.3): Point[] {
  if (points.length < 3) return points;

  const smoothed: Point[] = [];
  smoothed.push(points[0]);

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    const cp1x = p1.x - (p2.x - p0.x) * tension;
    const cp1y = p1.y - (p2.y - p0.y) * tension;
    const cp2x = p1.x + (p2.x - p0.x) * tension;
    const cp2y = p1.y + (p2.y - p0.y) * tension;

    smoothed.push({ x: cp1x, y: cp1y });
    smoothed.push(p1);
    smoothed.push({ x: cp2x, y: cp2y });
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if file is PDF
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Convert screen coordinates to normalized PDF coordinates (0-1)
export function screenToNormalized(
  point: Point,
  canvasWidth: number,
  canvasHeight: number
): Point {
  return {
    x: point.x / canvasWidth,
    y: point.y / canvasHeight,
  };
}

// Convert normalized PDF coordinates (0-1) to screen coordinates
export function normalizedToScreen(
  point: Point,
  canvasWidth: number,
  canvasHeight: number
): Point {
  return {
    x: point.x * canvasWidth,
    y: point.y * canvasHeight,
  };
}

// Convert array of points
export function screenPointsToNormalized(
  points: Point[],
  canvasWidth: number,
  canvasHeight: number
): Point[] {
  return points.map(p => screenToNormalized(p, canvasWidth, canvasHeight));
}

// Convert array of normalized points to screen
export function normalizedPointsToScreen(
  points: Point[],
  canvasWidth: number,
  canvasHeight: number
): Point[] {
  return points.map(p => normalizedToScreen(p, canvasWidth, canvasHeight));
}