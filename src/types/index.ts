// Annotation types
export type AnnotationType = 'pen' | 'text' | 'line' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  timestamp: number;
  pageNumber: number;
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen';
  points: Point[];
  color: string;
  width: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  position: Point;
  content: string;
  fontSize: number;
  color: string;
  width?: number;  // Normalized width (0-1)
  height?: number; // Normalized height (0-1)
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  start: Point;
  end: Point;
  color: string;
  width: number;
}

export type Annotation = PenAnnotation | TextAnnotation | LineAnnotation;

// Tool types
export type ToolType = 'pen' | 'text' | 'line' | 'eraser' | 'select';

export interface ToolSettings {
  currentTool: ToolType;
  color: string;
  lineWidth: number;
  fontSize: number;
  eraserSize: number;
}

// Tab types
export interface Tab {
  id: string;
  name: string;
  file?: File;
  fileName?: string;
  currentPage: number;
  zoomLevel: number | 'fit-width' | 'fit-page';
  scrollPosition?: { x: number; y: number };
  lastUpdated?: number; // For forcing re-renders
}

// Split view types
export type SplitMode = 'none' | 'vertical' | 'horizontal';

export interface ViewSettings {
  splitMode: SplitMode;
  splitRatio: number;
}

// Window Layout modes
export type WindowLayout = 'single' | 'vertical' | 'horizontal' | 'tile-2x2' | 'tile-3x2' | 'tile-4x2';

// Window/Pane definition
export interface WindowPane {
  id: string;
  tabs: Tab[];
  activeTabId: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Window management state
export interface WindowState {
  layout: WindowLayout;
  panes: WindowPane[];
  activePaneId: string;
}

// Storage types
export interface StorageData {
  version: string;
  pdfInfo: {
    fileName: string;
    fileHash: string;
    totalPages: number;
  };
  annotations: Record<string, Record<string, Annotation[]>>;  // fileName -> pageKey -> annotations
  tabs: Tab[];
  viewSettings: ViewSettings;
}

// PDF types
export interface PDFDocument {
  file: File | null;
  url: string | null;
  totalPages: number;
  currentPage: number;
  zoomLevel: number;
}

// Color presets
export const COLOR_PRESETS = [
  '#000000', // Black
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
] as const;

// Line width presets
export const LINE_WIDTH_PRESETS = [1, 2, 3, 5, 8] as const;

// Font size presets
export const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 24] as const;

// Eraser size presets
export const ERASER_SIZE_PRESETS = [
  { name: 'Small', size: 10 },
  { name: 'Medium', size: 20 },
  { name: 'Large', size: 40 },
] as const;

// Zoom level presets
export const ZOOM_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '250%', value: 2.5 },
  { label: '300%', value: 3 },
  { label: '400%', value: 4 },
  { label: '500%', value: 5 },
  { label: '600%', value: 6 },
  { label: '800%', value: 8 },
  { label: 'Fit Width', value: 'fit-width' },
  { label: 'Fit Page', value: 'fit-page' },
] as const;

// Auto-save types
export interface AutoSaveEntry {
  id: string;
  fileHash: string;
  fileName: string;
  timestamp: number;
  annotations: Record<string, Annotation[]>; // pageKey -> annotations
  tabs: Tab[];
  annotationCount: number;
  lastModified: number;
}

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // milliseconds (default: 30000)
  maxAutoSaves: number; // maximum number of auto-saves to keep per file (default: 5)
  retentionDays: number; // days to keep auto-saves (default: 7)
}

export interface RecoveryDialogData {
  autoSaveEntry: AutoSaveEntry;
  currentAnnotationCount: number;
  timeDifference: number; // milliseconds since auto-save
}

// Default auto-save configuration
export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  maxAutoSaves: 5,
  retentionDays: 7,
};