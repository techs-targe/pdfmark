import { useState, useCallback, useEffect } from 'react';
import { Annotation } from '../types';
import { StorageManager } from '../utils/storage';

interface UseAnnotationsReturn {
  annotations: Record<string, Annotation[]>;
  addAnnotation: (pageNumber: number, annotation: Annotation) => void;
  removeAnnotation: (pageNumber: number, annotationId: string) => void;
  clearPageAnnotations: (pageNumber: number) => void;
  clearAllAnnotations: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useAnnotations(
  pdfFileName?: string,
  autoSave: boolean = true
): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({});
  const [history, setHistory] = useState<Record<string, Annotation[]>[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const storage = StorageManager.getInstance();

  // Load annotations from storage
  useEffect(() => {
    if (pdfFileName) {
      const data = storage.load();
      if (data && data.pdfInfo.fileName === pdfFileName) {
        setAnnotations(data.annotations);
        setHistory([data.annotations]);
        setHistoryIndex(0);
      }
    }
  }, [pdfFileName]);

  // Auto-save annotations
  useEffect(() => {
    if (autoSave && pdfFileName) {
      const data = storage.load();
      if (data) {
        storage.autoSave({
          ...data,
          annotations,
        });
      }
    }
  }, [annotations, autoSave, pdfFileName]);

  const addToHistory = useCallback((newAnnotations: Record<string, Annotation[]>) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newAnnotations);
      // Limit history to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const addAnnotation = useCallback(
    (pageNumber: number, annotation: Annotation) => {
      const pageKey = `page_${pageNumber}`;
      const newAnnotations = {
        ...annotations,
        [pageKey]: [...(annotations[pageKey] || []), annotation],
      };
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    },
    [annotations, addToHistory]
  );

  const removeAnnotation = useCallback(
    (pageNumber: number, annotationId: string) => {
      const pageKey = `page_${pageNumber}`;
      const pageAnnotations = annotations[pageKey] || [];
      const newAnnotations = {
        ...annotations,
        [pageKey]: pageAnnotations.filter((a) => a.id !== annotationId),
      };
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    },
    [annotations, addToHistory]
  );

  const clearPageAnnotations = useCallback(
    (pageNumber: number) => {
      const pageKey = `page_${pageNumber}`;
      const newAnnotations = {
        ...annotations,
        [pageKey]: [],
      };
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    },
    [annotations, addToHistory]
  );

  const clearAllAnnotations = useCallback(() => {
    const newAnnotations = {};
    setAnnotations(newAnnotations);
    addToHistory(newAnnotations);
  }, [addToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  }, [history, historyIndex]);

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    clearPageAnnotations,
    clearAllAnnotations,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}