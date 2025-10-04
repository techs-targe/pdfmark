import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { WindowManager } from './components/WindowManager/WindowManager';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RecoveryDialog } from './components/AutoSave/RecoveryDialog';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useGlobalAnnotations } from './hooks/useGlobalAnnotations';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { isPenActive, isAnyDrawingToolActive, getActiveToolType } from './utils/penDetection';
import { StorageManager } from './utils/storage';
import { autoSaveManager } from './utils/autoSaveManager';
import { isPDFFile, formatFileSize, generateId } from './utils/helpers';
import { ToolType, ToolSettings, Tab, WindowLayout, AutoSaveEntry, RecoveryDialogData } from './types';
import './styles/index.css';

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'tab_1', name: 'Main', currentPage: 1, zoomLevel: 'fit-width' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab_1');
  const [windowLayout, setWindowLayout] = useState<WindowLayout>('single');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    currentTool: 'pen',
    color: '#000000',
    lineWidth: 2,
    fontSize: 16,
    eraserSize: 20,
  });

  // Auto-save state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryData, setRecoveryData] = useState<RecoveryDialogData | null>(null);
  const [availableAutoSaves, setAvailableAutoSaves] = useState<AutoSaveEntry[]>([]);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number>(0);

  // Protected tool change function
  const handleToolChange = useCallback((newTool: ToolType, source: string) => {
    console.log(`🔧 handleToolChange - Attempting to change tool to "${newTool}" from ${source}`);
    console.log(`🔧 handleToolChange - Current tool: "${toolSettings.currentTool}"`);

    // CRITICAL: Block ALL tool changes when ANY drawing tool is actively being used
    const anyToolActive = isAnyDrawingToolActive();
    const activeToolType = getActiveToolType();

    if (anyToolActive && activeToolType === toolSettings.currentTool) {
      console.log(`🚫 handleToolChange - BLOCKED! ${activeToolType} is active, refusing to change from ${toolSettings.currentTool} to ${newTool}`);
      return;
    }

    console.log(`✅ handleToolChange - Changing tool from "${toolSettings.currentTool}" to "${newTool}" (source: ${source})`);
    setToolSettings((prev) => ({ ...prev, currentTool: newTool }));
  }, [toolSettings.currentTool]);

  const storage = StorageManager.getInstance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const windowManagerRef = useRef<any>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AutoSaveManager on app startup
  useEffect(() => {
    const initAutoSave = async () => {
      try {
        await autoSaveManager.initialize();
        autoSaveManager.startAutoSave();
        console.log('💾 AutoSaveManager initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize AutoSaveManager:', error);
      }
    };

    initAutoSave();

    // Setup periodic auto-save check (every 30 seconds)
    autoSaveIntervalRef.current = setInterval(async () => {
      console.log('⏰ Periodic auto-save check triggered (30s interval)');
      await checkAndPerformAutoSave();
    }, 30000);

    console.log('🚀 Auto-save system initialized: 30s intervals + change-based triggers');

    // Cleanup on unmount
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      autoSaveManager.destroy();
    };
  }, []);

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

  // Get current file name for unsaved changes check
  const currentFileName = useMemo(() => {
    return pdfFile?.name || activeTab?.file?.name || activeTab?.fileName || null;
  }, [pdfFile, activeTab]);

  // Check if current file has unsaved changes
  const currentFileHasUnsavedChanges = useMemo(() => {
    return currentFileName ? hasUnsavedChanges(currentFileName) : false;
  }, [currentFileName, hasUnsavedChanges]);

  // Debug: Track app state (only when file info changes)
  useEffect(() => {
    if (pdfFile?.name || currentFileHash || currentFileName) {
      console.log(`📊 APP STATE: pdfFile=${pdfFile?.name || 'null'}, fileHash=${currentFileHash?.substring(0, 8) || 'null'}, fileName=${currentFileName || 'null'}, hasChanges=${currentFileHasUnsavedChanges}`);
    }
  }, [pdfFile?.name, currentFileHash, currentFileName, currentFileHasUnsavedChanges]);

  // Add beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log(`🚨 beforeunload triggered: hasUnsavedChanges=${currentFileHasUnsavedChanges} for file=${currentFileName}`);

      // Only show warning if we actually have unsaved changes and a file is loaded
      if (currentFileHasUnsavedChanges && currentFileName) {
        console.log(`⚠️ Showing leave warning for ${currentFileName}`);
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.returnValue = message; // For older browsers
        return message; // For modern browsers
      }
    };

    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentFileHasUnsavedChanges, currentFileName]);

  // Check for auto-save and perform if needed
  const checkAndPerformAutoSave = useCallback(async () => {
    const fileHashDisplay = currentFileHash?.substring(0, 8) || 'null';
    console.log(`🔍 Auto-save check: fileHash=${fileHashDisplay}..., fileName=${currentFileName || 'none'}`);

    if (!currentFileHash || !currentFileName) {
      console.log(`⏭️ Skipping auto-save: missing fileHash(${!!currentFileHash}) or fileName(${!!currentFileName})`);
      return;
    }

    try {
      // Get current annotations for active file
      const currentAnnotations = fileAnnotations[currentFileName] || {};
      const annotationCount = Object.values(currentAnnotations).reduce((count, pageAnnotations) => count + pageAnnotations.length, 0);

      console.log(`📊 Current annotations: ${annotationCount} total for ${currentFileName}`);

      // Check if auto-save should be triggered
      const shouldTrigger = autoSaveManager.shouldTriggerAutoSave(currentAnnotations);
      console.log(`🎯 Should trigger auto-save: ${shouldTrigger}`);

      if (shouldTrigger) {
        await autoSaveManager.saveAutoSave(
          currentFileHash,
          currentFileName,
          currentAnnotations,
          tabs
        );
        setLastAutoSaveTime(Date.now());
        console.log(`💾 ✅ Auto-saved ${annotationCount} annotations for ${currentFileName}`);
      } else {
        console.log(`💾 ⏭️ No changes detected, skipping auto-save`);
      }
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
    }
  }, [currentFileHash, currentFileName, fileAnnotations, tabs]);

  // Trigger auto-save when annotations change
  useEffect(() => {
    console.log(`📝 Annotation change detected: hasUnsavedChanges=${currentFileHasUnsavedChanges} for ${currentFileName}, lastAutoSave=${lastAutoSaveTime ? new Date(lastAutoSaveTime).toLocaleTimeString() : 'never'}`);

    if (currentFileHasUnsavedChanges && currentFileName && Date.now() - lastAutoSaveTime > 5000) {
      // Debounce auto-save: only save if 5 seconds have passed since last save
      console.log('⏳ Scheduling auto-save in 2 seconds...');
      const timeoutId = setTimeout(() => {
        console.log('🎯 Change-triggered auto-save executing now');
        checkAndPerformAutoSave();
      }, 2000);

      return () => {
        console.log('⏳ Cancelled scheduled auto-save (new changes detected)');
        clearTimeout(timeoutId);
      };
    }
  }, [currentFileHasUnsavedChanges, currentFileName, checkAndPerformAutoSave, lastAutoSaveTime]);

  // Check for auto-save recovery when loading PDF
  const checkForAutoSaveRecovery = useCallback(async (file: File) => {
    try {
      const fileHash = await storage.generateFileHash(file);
      setCurrentFileHash(fileHash);

      // Look for auto-saves for this file
      const autoSaves = await autoSaveManager.findAutoSavesForFile(fileHash);

      if (autoSaves.length > 0) {
        const latestAutoSave = autoSaves[0];
        const currentAnnotations = fileAnnotations[file.name] || {};
        const currentAnnotationCount = Object.values(currentAnnotations).reduce(
          (count, pageAnnotations) => count + pageAnnotations.length,
          0
        );

        const recoveryData: RecoveryDialogData = {
          autoSaveEntry: latestAutoSave,
          currentAnnotationCount,
          timeDifference: Date.now() - latestAutoSave.timestamp
        };

        setRecoveryData(recoveryData);
        setAvailableAutoSaves(autoSaves);
        setShowRecoveryDialog(true);

        console.log(`🔍 Found ${autoSaves.length} auto-save(s) for ${file.name}`);
        return true; // Indicate that recovery dialog will be shown
      }

      console.log(`📝 No auto-saves found for ${file.name}`);
      return false;
    } catch (error) {
      console.error('❌ Failed to check for auto-save recovery:', error);
      return false;
    }
  }, [storage, fileAnnotations]);

  // Handle auto-save recovery
  const handleRecoveryRestore = useCallback(async (autoSaveEntry: AutoSaveEntry) => {
    try {
      console.log(`🔄 Starting auto-save restoration...`);
      console.log(`📂 AutoSave entry:`, JSON.stringify(autoSaveEntry, null, 2));

      // Restore annotations from auto-save
      const fileName = pdfFile?.name || autoSaveEntry.fileName;
      console.log(`📁 Target fileName: "${fileName}"`);
      console.log(`📁 pdfFile?.name: "${pdfFile?.name}"`);
      console.log(`📁 autoSaveEntry.fileName: "${autoSaveEntry.fileName}"`);

      // Log the annotations structure before restoration
      console.log(`📝 Auto-save annotations structure:`, JSON.stringify(autoSaveEntry.annotations, null, 2));

      // Check current annotations state before restoration
      const currentAnnotations = fileAnnotations[fileName] || {};
      const currentCount = Object.values(currentAnnotations).reduce((count, pageAnnotations) => count + pageAnnotations.length, 0);
      console.log(`📝 Current annotations count before restore: ${currentCount}`);
      console.log(`📝 Current annotations structure:`, JSON.stringify(currentAnnotations, null, 2));

      // Restore annotations using the setAllAnnotations hook function
      console.log(`🔄 Calling setAllAnnotations with proper structure...`);
      const restoredAnnotationsStructure = {
        ...fileAnnotations,
        [fileName]: autoSaveEntry.annotations
      };
      console.log(`🔄 Final annotations structure for setAllAnnotations:`, JSON.stringify(restoredAnnotationsStructure, null, 2));
      setAllAnnotations(restoredAnnotationsStructure);

      // Wait a bit for state to update and check if restoration worked
      setTimeout(() => {
        const restoredAnnotations = fileAnnotations[fileName] || {};
        const restoredCount = Object.values(restoredAnnotations).reduce((count, pageAnnotations) => count + pageAnnotations.length, 0);
        console.log(`📝 Annotations count after restore: ${restoredCount}`);
        console.log(`📝 Restored annotations structure:`, JSON.stringify(restoredAnnotations, null, 2));

        if (restoredCount === 0) {
          console.error(`❌ RESTORATION FAILED: No annotations found after setAllAnnotations call!`);
          console.error(`❌ Expected ${autoSaveEntry.annotationCount} annotations but got ${restoredCount}`);
        } else {
          console.log(`✅ RESTORATION SUCCESS: ${restoredCount} annotations restored`);
        }
      }, 100);

      // Restore tabs from auto-save
      console.log(`📑 Restoring ${autoSaveEntry.tabs.length} tabs...`);
      setTabs(autoSaveEntry.tabs);
      if (autoSaveEntry.tabs.length > 0) {
        console.log(`📑 Setting active tab to: ${autoSaveEntry.tabs[0].id}`);
        setActiveTabId(autoSaveEntry.tabs[0].id);
      }

      console.log(`✅ Restored auto-save from ${new Date(autoSaveEntry.timestamp).toLocaleString()}`);
      console.log(`📝 Restored ${autoSaveEntry.annotationCount} annotations`);

      setShowRecoveryDialog(false);
      setRecoveryData(null);
      setAvailableAutoSaves([]);

      // Initialize storage with restored data
      if (currentFileHash && pdfFile) {
        const storageData = {
          version: '1.0.0',
          pdfInfo: {
            fileName: pdfFile.name,
            fileHash: currentFileHash,
            totalPages: 0,
          },
          annotations: autoSaveEntry.annotations,
          tabs: autoSaveEntry.tabs,
          viewSettings: {
            splitMode: 'none' as const,
            splitRatio: 0.5,
          },
        };
        storage.save(storageData);
        console.log(`✅ Updated storage with restored data for ${pdfFile.name}`);
      }

      // IMPORTANT: Clean up the restored auto-save AFTER successful restoration
      console.log(`🗑️  Deleting auto-save entry with ID: ${autoSaveEntry.id}`);
      await autoSaveManager.deleteAutoSave(autoSaveEntry.id);
      console.log(`✅ Cleaned up auto-save entry after successful restoration`);

      // Mark as saved after successful restoration
      markAsSaved(fileName);
      console.log(`✅ Marked ${fileName} as saved after auto-save restoration`);
    } catch (error) {
      console.error('❌ Failed to restore auto-save:', error);
      console.error('❌ Error details:', error.stack || error);
      alert('Failed to restore auto-save. Please try again.');
    }
  }, [pdfFile, setAllAnnotations, currentFileHash, storage, markAsSaved, fileAnnotations]);

  const handleRecoverySkip = useCallback(async () => {
    setShowRecoveryDialog(false);
    setRecoveryData(null);
    setAvailableAutoSaves([]);
    console.log('🚫 User skipped auto-save recovery');

    // Continue with normal file loading after skipping recovery (avoid infinite loop)
    if (pdfFile) {
      console.log('🔄 Continuing normal file loading process after skipping recovery');

      // Set up tabs for the file
      const mainTab: Tab = {
        id: 'tab_1',
        name: 'Main',
        file: pdfFile,
        fileName: pdfFile.name,
        currentPage: 1,
        zoomLevel: 'fit-width'
      };
      setTabs([mainTab]);
      setActiveTabId('tab_1');

      // Initialize storage
      if (currentFileHash) {
        const storageData = {
          version: '1.0.0',
          pdfInfo: {
            fileName: pdfFile.name,
            fileHash: currentFileHash,
            totalPages: 0,
          },
          annotations: {},
          tabs: [mainTab],
          viewSettings: {
            splitMode: 'none' as const,
            splitRatio: 0.5,
          },
        };
        storage.save(storageData);
        console.log(`✅ Initialized storage for ${pdfFile.name} after skipping recovery`);

        // Mark as saved after skipping recovery
        markAsSaved(pdfFile.name);
        console.log(`✅ Marked ${pdfFile.name} as saved after skipping auto-save recovery`);
      }
    }
  }, [pdfFile, currentFileHash, storage, markAsSaved]);

  const handleRecoveryClose = useCallback(() => {
    setShowRecoveryDialog(false);
    setRecoveryData(null);
    setAvailableAutoSaves([]);
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File, targetTabId?: string) => {
    console.log(`📁 handleFileUpload called with file: ${file.name}, targetTabId: ${targetTabId}`);

    if (!isPDFFile(file)) {
      alert('Please select a valid PDF file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit');
      return;
    }

    // 🔧 FIX: Generate file hash FIRST for auto-save recovery
    const fileHash = await storage.generateFileHash(file);
    setCurrentFileHash(fileHash);
    console.log(`📁 Generated file hash: ${fileHash.substring(0, 8)}... for ${file.name}`);

    // Check for auto-save recovery with the correct file hash
    const hasAutoSave = await checkForAutoSaveRecovery(file);
    console.log(`🔍 Auto-save recovery check result: ${hasAutoSave}`);

    // If auto-save dialog is shown, wait for user decision
    if (hasAutoSave) {
      console.log('⏸️ Auto-save dialog shown, waiting for user decision...');
      setPdfFile(file);
      return; // Don't continue with normal file loading until user decides
    }

    // Normal file loading process
    console.log(`📁 Normal file loading process - targetTabId: ${targetTabId}`);

    if (targetTabId) {
      // Update existing tab with new file
      console.log(`📁 Updating existing tab ${targetTabId} with file ${file.name}`);
      setTabs(tabs.map(t =>
        t.id === targetTabId
          ? { ...t, file, fileName: file.name, currentPage: 1, zoomLevel: 'fit-width' }
          : t
      ));
    } else {
      // Set as main file if no tabs have files yet
      const hasFiles = tabs.some(t => t.file);
      console.log(`📁 hasFiles: ${hasFiles}, tabs count: ${tabs.length}`);

      if (!hasFiles) {
        console.log(`📁 Setting as main PDF file and creating main tab`);
        setPdfFile(file);
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
        console.log(`📁 Created main tab:`, mainTab);
      } else {
        // Create new tab for the file
        console.log(`📁 Creating new tab for file ${file.name}`);
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
        console.log(`📁 Created new tab:`, newTab);
      }
    }

    // Initialize storage for new PDF
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
    console.log(`✅ Initialized storage for ${file.name}`);

    // Mark as saved to prevent false unsaved changes warning
    markAsSaved(file.name);
    console.log(`✅ Marked ${file.name} as saved (initial load)`);
  }, [storage, tabs, checkForAutoSaveRecovery, markAsSaved]);

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

  // Toggle fullscreen mode
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      appContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
    onToolChange: (tool: ToolType) => handleToolChange(tool, 'keyboard'),
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
      console.log('🎯 DROP EVENT DETECTED!');
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      console.log(`🎯 Dropped files count: ${files.length}`, files.map(f => f.name));

      const pdfFile = files.find((file) => isPDFFile(file));
      console.log(`🎯 PDF file found: ${pdfFile?.name || 'none'}`);

      if (pdfFile) {
        console.log(`🎯 Calling handleFileUpload with: ${pdfFile.name}`);
        handleFileUpload(pdfFile);
      }
    },
    [handleFileUpload]
  );

  // Don't need flat array anymore, will pass fileAnnotations instead

  return (
    <ErrorBoundary>
      <div
        ref={appContainerRef}
        className="flex flex-col h-screen bg-gray-900"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          console.log('🎯 FILE INPUT CHANGE EVENT!');
          const file = e.target.files?.[0];
          console.log(`🎯 Selected file: ${file?.name || 'none'}`);
          if (file) {
            console.log(`🎯 Calling handleFileUpload with: ${file.name}`);
            handleFileUpload(file);
          }
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
        isFullscreen={isFullscreen}
        onToolChange={(tool) => handleToolChange(tool, 'toolbar')}
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
        onToggleFullscreen={handleToggleFullscreen}
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
          onToolChange={(tool) => handleToolChange(tool, 'windowManager')}
        />
      </div>

      {/* Status bar with timer */}
      <StatusBar
        pdfFileName={pdfFile?.name}
        pdfFileSize={pdfFile ? formatFileSize(pdfFile.size) : undefined}
        currentPage={activeTab.currentPage}
        totalPages={pdfDoc?.numPages || 0}
        windowLayout={windowLayout}
        lastAutoSaveTime={lastAutoSaveTime}
        tabName={activeTab.name}
        zoomLevel={activeTab.zoomLevel}
      />

      {/* Auto-save Recovery Dialog */}
      <RecoveryDialog
        isOpen={showRecoveryDialog}
        recoveryData={recoveryData}
        availableAutoSaves={availableAutoSaves}
        onRecover={handleRecoveryRestore}
        onSkip={handleRecoverySkip}
        onClose={handleRecoveryClose}
      />
    </div>
    </ErrorBoundary>
  );
}

export default App;