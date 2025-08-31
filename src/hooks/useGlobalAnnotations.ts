import { useState, useCallback } from 'react';
import { Annotation } from '../types';

interface UseGlobalAnnotationsReturn {
  fileAnnotations: Record<string, Record<string, Annotation[]>>;
  setAllAnnotations: (annotations: Record<string, Record<string, Annotation[]>>) => void;
  addAnnotation: (fileName: string, pageNumber: number, annotation: Annotation) => void;
  removeAnnotation: (fileName: string, pageNumber: number, annotationId: string) => void;
  updateAnnotation: (fileName: string, annotationId: string, updates: Partial<Annotation>) => void;
  clearAllAnnotations: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: (fileName: string) => boolean;
  markAsSaved: (fileName: string) => void;
}

export function useGlobalAnnotations(): UseGlobalAnnotationsReturn {
  const [fileAnnotations, setFileAnnotations] = useState<Record<string, Record<string, Annotation[]>>>({});
  const [history, setHistory] = useState<Record<string, Record<string, Annotation[]>>[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [savedAnnotations, setSavedAnnotations] = useState<Record<string, Record<string, Annotation[]>>>({});

  const addToHistory = useCallback((newAnnotations: Record<string, Record<string, Annotation[]>>) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newAnnotations))); // Deep clone
      // Limit history to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const addAnnotation = useCallback(
    (fileName: string, pageNumber: number, annotation: Annotation) => {
      const pageKey = `page_${pageNumber}`;
      const newAnnotations = {
        ...fileAnnotations,
        [fileName]: {
          ...(fileAnnotations[fileName] || {}),
          [pageKey]: [...((fileAnnotations[fileName]?.[pageKey]) || []), annotation],
        },
      };
      setFileAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    },
    [fileAnnotations, addToHistory]
  );

  const removeAnnotation = useCallback(
    (fileName: string, pageNumber: number, annotationId: string) => {
      const pageKey = `page_${pageNumber}`;
      const fileAnns = fileAnnotations[fileName] || {};
      const pageAnnotations = fileAnns[pageKey] || [];
      
      const newAnnotations = {
        ...fileAnnotations,
        [fileName]: {
          ...fileAnns,
          [pageKey]: pageAnnotations.filter((a) => a.id !== annotationId),
        },
      };
      setFileAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    },
    [fileAnnotations, addToHistory]
  );

  const updateAnnotation = useCallback(
    (fileName: string, annotationId: string, updates: Partial<Annotation>) => {
      const fileAnns = fileAnnotations[fileName] || {};
      const updatedFileAnns = { ...fileAnns };
      let updated = false;
      
      // Find and update the annotation
      for (const pageKey in updatedFileAnns) {
        const pageAnnotations = updatedFileAnns[pageKey];
        const annotationIndex = pageAnnotations.findIndex(a => a.id === annotationId);
        if (annotationIndex !== -1) {
          updatedFileAnns[pageKey] = [
            ...pageAnnotations.slice(0, annotationIndex),
            { ...pageAnnotations[annotationIndex], ...updates },
            ...pageAnnotations.slice(annotationIndex + 1)
          ];
          updated = true;
          break;
        }
      }
      
      if (updated) {
        const newAnnotations = {
          ...fileAnnotations,
          [fileName]: updatedFileAnns
        };
        setFileAnnotations(newAnnotations);
        addToHistory(newAnnotations);
      }
    },
    [fileAnnotations, addToHistory]
  );

  const setAllAnnotations = useCallback((annotations: Record<string, Record<string, Annotation[]>>) => {
    setFileAnnotations(annotations);
    addToHistory(annotations);
  }, [addToHistory]);

  const clearAllAnnotations = useCallback(() => {
    const newAnnotations = {};
    setFileAnnotations(newAnnotations);
    addToHistory(newAnnotations);
  }, [addToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setFileAnnotations(JSON.parse(JSON.stringify(history[newIndex]))); // Deep clone
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setFileAnnotations(JSON.parse(JSON.stringify(history[newIndex]))); // Deep clone
    }
  }, [history, historyIndex]);

  const hasUnsavedChanges = useCallback((fileName: string) => {
    const currentFileAnnotations = fileAnnotations[fileName] || {};
    const savedFileAnnotations = savedAnnotations[fileName] || {};
    
    // Deep comparison of annotations
    return JSON.stringify(currentFileAnnotations) !== JSON.stringify(savedFileAnnotations);
  }, [fileAnnotations, savedAnnotations]);

  const markAsSaved = useCallback((fileName: string) => {
    if (fileAnnotations[fileName]) {
      setSavedAnnotations(prev => ({
        ...prev,
        [fileName]: JSON.parse(JSON.stringify(fileAnnotations[fileName]))
      }));
    }
  }, [fileAnnotations]);

  return {
    fileAnnotations,
    setAllAnnotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearAllAnnotations,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    hasUnsavedChanges,
    markAsSaved,
  };
}