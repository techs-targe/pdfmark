import React, { useState, useCallback, useRef, useMemo } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { WindowManager } from './components/WindowManager/WindowManager';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useGlobalAnnotations } from './hooks/useGlobalAnnotations';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { StorageManager } from './utils/storage';
import { isPDFFile, formatFileSize, generateId } from './utils/helpers';
import { ToolType, ToolSettings, Tab, WindowLayout } from './types';
import './styles/index.css';

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'tab_1', name: 'Main', currentPage: 1, zoomLevel: 'fit-width' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab_1');
  const [windowLayout, setWindowLayout] = useState<WindowLayout>('single');
  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    currentTool: 'pen',
    color: '#000000',
    lineWidth: 2,
    fontSize: 16,
    eraserSize: 20,
  });

  const storage = StorageManager.getInstance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const windowManagerRef = useRef<any>(null);

  // Get active tab
  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // Use global annotations hook for all files with undo/redo support
  const {
    fileAnnotations,
    setAllAnnotations,
    addAnnotation: globalAddAnnotation,
    removeAnnotation: globalRemoveAnnotation,
    updateAnnotation: globalUpdateAnnotation,
    clearAllAnnotations,
    undo,
    redo,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    markAsSaved,
  } = useGlobalAnnotations();

  // Handle file upload

  const handleFileUpload = useCallback(async (file: File, targetTabId?: string) => {
    if (!isPDFFile(file)) {
      alert('Please select a valid PDF file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit');
      return;
    }

    if (targetTabId) {
      // Update existing tab with new file
      setTabs(tabs.map(t => 
        t.id === targetTabId 
          ? { ...t, file, fileName: file.name, currentPage: 1, zoomLevel: 'fit-width' }
          : t
      ));
    } else {
      // Set as main file if no tabs have files yet
      const hasFiles = tabs.some(t => t.file);
      if (!hasFiles) {
        if (!pdfFile) {
        setPdfFile(file);
      }
        const mainTab: Tab = { 
          id: 'tab_1', 
          name: 'Main',
          file,
          fileName: file.name,
          currentPage: 1, 
          zoomLevel: 'fit-width'
        };
        setTabs([mainTab]);
        setActiveTabId('tab_1');
      } else {
        // Create new tab for the file
        const newTab: Tab = {
          id: generateId(),
          name: `Tab ${tabs.length + 1}`,
          file,
          fileName: file.name,
          currentPage: 1,
          zoomLevel: 'fit-width',
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
      }
    }

    // Initialize storage for new PDF
    const fileHash = await storage.generateFileHash(file);
    const storageData = {
      version: '1.0.0',
      pdfInfo: {
        fileName: file.name,
        fileHash,
        totalPages: 0,
      },
      annotations: {},
      tabs: tabs,
      viewSettings: {
        splitMode: 'none' as const,
        splitRatio: 0.5,
      },
    };
    storage.save(storageData);
  }, [storage, tabs]);

  // Handle PDF document load
  const handleDocumentLoad = useCallback(
    (doc: PDFDocumentProxy) => {
      setPdfDoc(doc);
      
      // Update storage with total pages
      const data = storage.load();
      if (data && pdfFile) {
        data.pdfInfo.totalPages = doc.numPages;
        storage.save(data);
      }
    },
    [pdfFile, storage]
  );

  // Tab operations are now handled by WindowManager
  // const handleTabAdd = useCallback(() => {}, []);
  // const handleTabRemove = useCallback((_tabId: string) => {}, []);
  // const handleTabRename = useCallback((_tabId: string, _newName: string) => {}, []);
  // const handleTabChange = useCallback((_tabId: string) => {}, []);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setTabs(tabs.map(t => 
      t.id === activeTabId 
        ? { ...t, currentPage: page }
        : t
    ));
  }, [tabs, activeTabId]);

  const handleZoomChange = useCallback((zoom: number | 'fit-width' | 'fit-page') => {
    setTabs(tabs.map(t => 
      t.id === activeTabId 
        ? { ...t, zoomLevel: zoom }
        : t
    ));
  }, [tabs, activeTabId]);

  // Scroll handling is now managed by WindowManager
  // const handleScrollChange = useCallback((_position: { x: number; y: number }) => {}, []);

  // Handle split view
  // const toggleSplitMode = useCallback(() => {
  //   if (splitMode === 'none') {
  //     setSplitMode('vertical');
  //   } else if (splitMode === 'vertical') {
  //     setSplitMode('horizontal');
  //   } else {
  //     setSplitMode('none');
  //   }
  // }, [splitMode]);

  // Annotations are now handled by WindowManager

  // Handle save annotations
  const handleSave = useCallback(() => {
    // Check for any annotations to save
    const hasAnnotations = Object.keys(fileAnnotations).length > 0;
    
    // If there are annotations, we can save them
    if (!hasAnnotations) {
      alert('No annotations to save');
      return;
    }
    
    // Try to find any file name from annotations
    let fileName = Object.keys(fileAnnotations)[0];
    
    // Fallback to other sources if needed
    if (!fileName) {
      if (pdfFile) {
        fileName = pdfFile.name;
      } else if (activeTab.file) {
        fileName = activeTab.file.name;
      } else if (activeTab.fileName) {
        fileName = activeTab.fileName;
      } else {
        fileName = 'annotations.json';
      }
    }
    
    // Create storage data with current annotations
    const data = {
      version: '1.0.0',
      pdfInfo: {
        fileName: fileName,
        fileHash: '', // You can add hash if needed
        totalPages: pdfDoc?.numPages || 1,
      },
      annotations: fileAnnotations,
      tabs: tabs,
      viewSettings: {
        splitMode: 'none' as const,
        splitRatio: 0.5,
      }
    };
    
    storage.exportToFile(data);
    
    // Mark all files as saved
    Object.keys(fileAnnotations).forEach(file => {
      markAsSaved(file);
    });
  }, [storage, tabs, fileAnnotations, pdfFile, pdfDoc, activeTab.file, activeTab.fileName, markAsSaved]);

  // Handle load annotations
  const handleLoad = useCallback(async () => {
    jsonInputRef.current?.click();
  }, []);

  const handleJsonImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const data = await storage.importFromFile(file);
        
        // Load annotations into global state
        if (data.annotations) {
          setAllAnnotations(data.annotations);
        }
        
        // Restore tabs and view settings
        if (data.tabs && data.tabs.length > 0) {
          setTabs(data.tabs);
          setActiveTabId(data.tabs[0].id);
        }
        
        // Save to storage for persistence
        storage.save(data);
        
        alert('Annotations loaded successfully');
      } catch (error) {
        alert('Failed to import file: ' + (error as Error).message);
      }
      
      // Reset input
      if (jsonInputRef.current) {
        jsonInputRef.current.value = '';
      }
    },
    [storage, setAllAnnotations]
  );

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    const currentZoom = activeTab.zoomLevel;
    if (typeof currentZoom === 'number') {
      handleZoomChange(Math.min(currentZoom + 0.25, 3));
    } else {
      handleZoomChange(1.25);
    }
  }, [activeTab.zoomLevel, handleZoomChange]);

  const handleZoomOut = useCallback(() => {
    const currentZoom = activeTab.zoomLevel;
    if (typeof currentZoom === 'number') {
      handleZoomChange(Math.max(currentZoom - 0.25, 0.25));
    } else {
      handleZoomChange(0.75);
    }
  }, [activeTab.zoomLevel, handleZoomChange]);

  // Handle page navigation through WindowManager
  const handleNextPage = useCallback(() => {
    if (windowManagerRef.current) {
      windowManagerRef.current.navigateNextPage();
    }
  }, []);

  const handlePrevPage = useCallback(() => {
    if (windowManagerRef.current) {
      windowManagerRef.current.navigatePrevPage();
    }
  }, []);

  // Handle scroll operations
  const handleScrollUp = useCallback(() => {
    // Scroll the active PDF viewer up
    const scrollAmount = 100;
    if (windowManagerRef.current) {
      windowManagerRef.current.scrollActivePane(0, -scrollAmount);
    }
  }, []);

  const handleScrollDown = useCallback(() => {
    // Scroll the active PDF viewer down
    const scrollAmount = 100;
    if (windowManagerRef.current) {
      windowManagerRef.current.scrollActivePane(0, scrollAmount);
    }
  }, []);

  const handleScrollLeft = useCallback(() => {
    // Scroll the active PDF viewer left
    const scrollAmount = 100;
    if (windowManagerRef.current) {
      windowManagerRef.current.scrollActivePane(-scrollAmount, 0);
    }
  }, []);

  const handleScrollRight = useCallback(() => {
    // Scroll the active PDF viewer right
    const scrollAmount = 100;
    if (windowManagerRef.current) {
      windowManagerRef.current.scrollActivePane(scrollAmount, 0);
    }
  }, []);

  const handleFocusPageInput = useCallback(() => {
    // Focus the page input field in the active pane
    if (windowManagerRef.current) {
      windowManagerRef.current.focusPageInput();
    }
  }, []);

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSave: handleSave,
    onOpen: () => fileInputRef.current?.click(),
    onToolChange: (tool: ToolType) =>
      setToolSettings((prev) => ({ ...prev, currentTool: tool })),
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onNextPage: handleNextPage,
    onPrevPage: handlePrevPage,
    onScrollUp: handleScrollUp,
    onScrollDown: handleScrollDown,
    onScrollLeft: handleScrollLeft,
    onScrollRight: handleScrollRight,
    onFocusPageInput: handleFocusPageInput,
  });

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const pdfFile = files.find((file) => isPDFFile(file));
      
      if (pdfFile) {
        handleFileUpload(pdfFile);
      }
    },
    [handleFileUpload]
  );

  // Don't need flat array anymore, will pass fileAnnotations instead

  return (
    <ErrorBoundary>
      <div
        className="flex flex-col h-screen bg-gray-900"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className="hidden"
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        onChange={handleJsonImport}
        className="hidden"
      />

      <Toolbar
        currentTool={toolSettings.currentTool}
        color={toolSettings.color}
        lineWidth={toolSettings.lineWidth}
        fontSize={toolSettings.fontSize}
        eraserSize={toolSettings.eraserSize}
        windowLayout={windowLayout}
        canUndo={canUndo}
        canRedo={canRedo}
        onToolChange={(tool) =>
          setToolSettings((prev) => ({ ...prev, currentTool: tool }))
        }
        onColorChange={(color) =>
          setToolSettings((prev) => ({ ...prev, color }))
        }
        onLineWidthChange={(width) =>
          setToolSettings((prev) => ({ ...prev, lineWidth: width }))
        }
        onFontSizeChange={(size) =>
          setToolSettings((prev) => ({ ...prev, fontSize: size }))
        }
        onEraserSizeChange={(size) =>
          setToolSettings((prev) => ({ ...prev, eraserSize: size }))
        }
        onWindowLayoutChange={setWindowLayout}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        onLoad={handleLoad}
        onClearAll={clearAllAnnotations}
      />

      {/* Window Manager - handles all views with tabs */}
      <div className="flex-1 overflow-hidden">
        <WindowManager
          ref={windowManagerRef}
          layout={windowLayout}
          pdfFile={pdfFile}
          pdfDoc={pdfDoc}
          fileAnnotations={fileAnnotations}
          toolSettings={toolSettings}
          onLayoutChange={setWindowLayout}
          onSaveAnnotations={handleSave}
          onLoadAnnotations={handleLoad}
          onAnnotationAdd={(fileName, annotation) => {
            if (fileName) {
              globalAddAnnotation(fileName, annotation.pageNumber, annotation);
            }
          }}
          onAnnotationRemove={(fileName, id, pageNumber) => {
            if (fileName) {
              globalRemoveAnnotation(fileName, pageNumber, id);
            }
          }}
          onAnnotationUpdate={(fileName, annotationId, updates) => {
            if (fileName) {
              globalUpdateAnnotation(fileName, annotationId, updates);
            }
          }}
          onDocumentLoad={handleDocumentLoad}
          onFileUpload={handleFileUpload}
          hasUnsavedChanges={hasUnsavedChanges}
          markAsSaved={markAsSaved}
        />
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="flex items-center gap-4">
          {pdfFile && (
            <>
              <span className="truncate max-w-xs">{pdfFile.name}</span>
              <span className="text-gray-400">|</span>
              <span>{formatFileSize(pdfFile.size)}</span>
              <span className="text-gray-400">|</span>
              <span>
                Page {activeTab.currentPage} of {pdfDoc?.numPages || 0}
              </span>
              {windowLayout !== 'single' && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-yellow-400">
                    Layout: {windowLayout}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Tab: {activeTab.name}</span>
          <span className="text-gray-400">|</span>
          <span>Zoom: {typeof activeTab.zoomLevel === 'number' ? `${Math.round(activeTab.zoomLevel * 100)}%` : activeTab.zoomLevel}</span>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default App;