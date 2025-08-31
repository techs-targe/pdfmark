import { useEffect, useCallback } from 'react';
import { ToolType } from '../types';

interface ShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onOpen?: () => void;
  onToolChange?: (tool: ToolType) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
  onFocusPageInput?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Tool shortcuts (1-5)
      if (!isModifier && /^[1-5]$/.test(key)) {
        const tools: ToolType[] = ['pen', 'eraser', 'text', 'line', 'select'];
        const toolIndex = parseInt(key) - 1;
        if (handlers.onToolChange && tools[toolIndex]) {
          event.preventDefault();
          handlers.onToolChange(tools[toolIndex]);
        }
        return;
      }

      // Ctrl/Cmd shortcuts
      if (isModifier) {
        switch (key.toLowerCase()) {
          case 'z':
            event.preventDefault();
            if (shiftKey && handlers.onRedo) {
              handlers.onRedo();
            } else if (!shiftKey && handlers.onUndo) {
              handlers.onUndo();
            }
            break;
          case 'y':
            if (handlers.onRedo) {
              event.preventDefault();
              handlers.onRedo();
            }
            break;
          case 's':
            if (handlers.onSave) {
              event.preventDefault();
              handlers.onSave();
            }
            break;
          case 'o':
            if (handlers.onOpen) {
              event.preventDefault();
              handlers.onOpen();
            }
            break;
          case '=':
          case '+':
            if (handlers.onZoomIn) {
              event.preventDefault();
              handlers.onZoomIn();
            }
            break;
          case '-':
          case '_':
            if (handlers.onZoomOut) {
              event.preventDefault();
              handlers.onZoomOut();
            }
            break;
        }
      }

      // Navigation shortcuts (not affected by modifiers)
      switch (key) {
        case 'ArrowLeft':
          if (!isModifier) {
            if (shiftKey && handlers.onScrollLeft) {
              event.preventDefault();
              handlers.onScrollLeft();
            } else if (!shiftKey && handlers.onPrevPage) {
              event.preventDefault();
              handlers.onPrevPage();
            }
          }
          break;
        case 'ArrowRight':
          if (!isModifier) {
            if (shiftKey && handlers.onScrollRight) {
              event.preventDefault();
              handlers.onScrollRight();
            } else if (!shiftKey && handlers.onNextPage) {
              event.preventDefault();
              handlers.onNextPage();
            }
          }
          break;
        case 'ArrowUp':
          if (handlers.onScrollUp) {
            event.preventDefault();
            handlers.onScrollUp();
          }
          break;
        case 'ArrowDown':
          if (handlers.onScrollDown) {
            event.preventDefault();
            handlers.onScrollDown();
          }
          break;
        case 'Enter':
          if (handlers.onFocusPageInput) {
            event.preventDefault();
            handlers.onFocusPageInput();
          }
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Export keyboard shortcut descriptions for UI
export const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+Y', description: 'Redo' },
  { keys: 'Ctrl+S', description: 'Save' },
  { keys: 'Ctrl+O', description: 'Open' },
  { keys: 'Ctrl++', description: 'Zoom In' },
  { keys: 'Ctrl+-', description: 'Zoom Out' },
  { keys: '1', description: 'Pen Tool' },
  { keys: '2', description: 'Eraser Tool' },
  { keys: '3', description: 'Text Tool' },
  { keys: '4', description: 'Line Tool' },
  { keys: '5', description: 'Select Tool' },
  { keys: '←', description: 'Previous Page' },
  { keys: '→', description: 'Next Page' },
  { keys: '↑', description: 'Scroll Up' },
  { keys: '↓', description: 'Scroll Down' },
  { keys: 'Shift+←', description: 'Scroll Left' },
  { keys: 'Shift+→', description: 'Scroll Right' },
  { keys: 'Enter', description: 'Focus Page Input' },
];