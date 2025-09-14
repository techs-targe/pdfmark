import React, { useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { WindowLayout, WindowPane, Tab, Annotation, ToolSettings, ToolType } from '../../types';
import { TabManager } from '../TabManager/TabManager';
import { SimplePDFViewer } from '../PDFViewer/SimplePDFViewer';
import { WindowPaneHeader } from '../WindowPane/WindowPaneHeader';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { generateId } from '../../utils/helpers';

interface WindowManagerProps {
  layout: WindowLayout;
  pdfFile: File | null;
  pdfDoc: PDFDocumentProxy | null;
  fileAnnotations: Record<string, Record<string, Annotation[]>>;
  toolSettings: ToolSettings;
  onLayoutChange: (layout: WindowLayout) => void;
  onAnnotationAdd: (fileName: string, annotation: Annotation) => void;
  onAnnotationRemove: (fileName: string, annotationId: string, pageNumber: number) => void;
  onAnnotationUpdate: (fileName: string, annotationId: string, updates: Partial<Annotation>) => void;
  onDocumentLoad: (doc: PDFDocumentProxy) => void;
  onFileUpload: (file: File) => void;
  onSaveAnnotations?: () => void;
  onLoadAnnotations?: () => void;
  hasUnsavedChanges?: (fileName: string) => boolean;
  markAsSaved?: (fileName: string) => void;
  onToolChange?: (tool: ToolType) => void;
}

export const WindowManager = forwardRef<any, WindowManagerProps>(({
  layout,
  pdfFile,
  pdfDoc,
  fileAnnotations,
  toolSettings,
  onLayoutChange: _onLayoutChange,  // Currently unused - layout is controlled externally
  onAnnotationAdd,
  onAnnotationRemove,
  onAnnotationUpdate,
  onDocumentLoad,
  onFileUpload: _onFileUpload,  // Currently unused
  onSaveAnnotations,
  onLoadAnnotations,
  hasUnsavedChanges,
  markAsSaved: _markAsSaved,  // Currently unused
  onToolChange,
}, ref) => {
  // Initialize with single pane, and set initial file if available
  const [panes, setPanes] = useState<WindowPane[]>([
    {
      id: 'pane_1',
      tabs: [{ 
        id: 'tab_1', 
        name: pdfFile ? pdfFile.name.replace('.pdf', '').slice(0, 20) : 'Main', 
        file: pdfFile ?? undefined,
        fileName: pdfFile?.name,
        currentPage: 1, 
        zoomLevel: 'fit-width',
        lastUpdated: Date.now()
      }],
      activeTabId: 'tab_1',
    }
  ]);
  
  // Update tabs when main file changes
  React.useEffect(() => {
    if (pdfFile && panes.length > 0 && panes[0].tabs.length > 0 && panes[0].tabs[0].file !== pdfFile) {
      setPanes(prevPanes => prevPanes.map((pane, index) => 
        index === 0 
          ? {
              ...pane,
              tabs: pane.tabs.map((tab, tabIndex) => 
                tabIndex === 0 
                  ? { ...tab, file: pdfFile, fileName: pdfFile.name }
                  : tab
              )
            }
          : pane
      ));
    }
  }, [pdfFile]); // Only depend on pdfFile
  const [activePaneId, setActivePaneId] = useState('pane_1');
  
  // Split ratio state (0.1 to 0.9, default 0.5 = 50/50 split)
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [splitRatioH, setSplitRatioH] = useState(0.5); // Horizontal split for tile mode
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [isDraggingDividerH, setIsDraggingDividerH] = useState(false); // Horizontal divider for tile mode
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    paneId: string;
    tabId: string;
    fileName: string;
  }>({
    isOpen: false,
    paneId: '',
    tabId: '',
    fileName: '',
  });
  
  // Refs for PDF viewers
  const pdfViewerRefs = useRef<Map<string, any>>(new Map());
  const pageInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  
  // Handle page change for specific tab - moved up to be available for useImperativeHandle
  const handlePageChange = useCallback((paneId: string, tabId: string, page: number) => {
    setPanes(prevPanes => prevPanes.map(pane => {
      if (pane.id === paneId) {
        return {
          ...pane,
          tabs: pane.tabs.map(tab => 
            tab.id === tabId 
              ? { ...tab, currentPage: page }
              : tab
          ),
        };
      }
      return pane;
    }));
  }, []);
  
  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    scrollActivePane: (deltaX: number, deltaY: number) => {
      const activePane = panes.find(p => p.id === activePaneId);
      if (!activePane) return;
      
      const viewerKey = `${activePane.id}_${activePane.activeTabId}`;
      const viewer = pdfViewerRefs.current.get(viewerKey);
      if (viewer?.containerRef?.current) {
        viewer.containerRef.current.scrollBy(deltaX, deltaY);
      }
    },
    focusPageInput: () => {
      const activePane = panes.find(p => p.id === activePaneId);
      if (!activePane) return;
      
      // Force show the page input first by clicking the page button
      const pageButtonClass = 'page-jump-button-' + activePane.id;
      const pageButton = document.querySelector('.' + pageButtonClass);
      if (pageButton) {
        (pageButton as HTMLElement).click();
        // Then focus the input after a small delay
        setTimeout(() => {
          const inputRef = pageInputRefs.current.get(activePane.id);
          if (inputRef) {
            inputRef.focus();
            inputRef.select();
          }
        }, 50);
      }
    },
    navigateNextPage: () => {
      // For single layout, ensure we use the first pane
      const effectivePaneId = layout === 'single' ? 'pane_1' : activePaneId;
      const activePane = panes.find(p => p.id === effectivePaneId) || panes[0];
      
      if (!activePane) return;
      
      const activeTab = activePane.tabs.find(t => t.id === activePane.activeTabId) || activePane.tabs[0];
      if (!activeTab) return;
      
      // Try multiple ways to get total pages
      let totalPages = 0;
      
      // Method 1: Check viewer ref with current key
      const viewerKey = `${activePane.id}_${activeTab.id}`;
      const viewer = pdfViewerRefs.current.get(viewerKey);
      if (viewer?.totalPages) {
        totalPages = viewer.totalPages;
      }
      
      // Method 2: Check if there's any viewer ref (for cases where key might be different)
      if (!totalPages && pdfViewerRefs.current.size > 0) {
        const firstViewer = Array.from(pdfViewerRefs.current.values())[0];
        if (firstViewer?.totalPages) {
          totalPages = firstViewer.totalPages;
        }
      }
      
      // Method 3: Use pdfDoc if available
      if (!totalPages && pdfDoc?.numPages) {
        totalPages = pdfDoc.numPages;
      }
      
      if (totalPages > 0 && activeTab.currentPage < totalPages) {
        handlePageChange(activePane.id, activeTab.id, activeTab.currentPage + 1);
      }
    },
    navigatePrevPage: () => {
      // For single layout, ensure we use the first pane
      const effectivePaneId = layout === 'single' ? 'pane_1' : activePaneId;
      const activePane = panes.find(p => p.id === effectivePaneId) || panes[0];
      
      if (!activePane) return;
      
      const activeTab = activePane.tabs.find(t => t.id === activePane.activeTabId) || activePane.tabs[0];
      if (!activeTab) return;
      
      if (activeTab.currentPage > 1) {
        handlePageChange(activePane.id, activeTab.id, activeTab.currentPage - 1);
      }
    }
  }), [panes, activePaneId, handlePageChange, pdfDoc, layout]);

  // Get all loaded files from all panes
  const loadedFiles = React.useMemo(() => {
    const filesMap = new Map<string, File>();
    panes.forEach(pane => {
      pane.tabs.forEach(tab => {
        if (tab.file) {
          filesMap.set(tab.fileName || tab.file.name, tab.file);
        }
      });
    });
    // Also include the main file if it exists
    if (pdfFile) {
      filesMap.set(pdfFile.name, pdfFile);
    }
    return Array.from(filesMap.values());
  }, [panes, pdfFile]);

  // Handle tab operations for specific pane
  const handleTabAdd = useCallback((paneId: string) => {
    setPanes(prevPanes => {
      // Find the active tab in the clicked pane
      const clickedPane = prevPanes.find(p => p.id === paneId);
      if (!clickedPane) return prevPanes;
      
      const activeTab = clickedPane.tabs.find(t => t.id === clickedPane.activeTabId) || clickedPane.tabs[0];
      const timestamp = Date.now();
      
      // Create base tab with copied properties
      const newTabBase = {
        name: `Tab ${clickedPane.tabs.length + 1}`,
        file: activeTab.file,
        fileName: activeTab.fileName,
        currentPage: activeTab.currentPage,
        zoomLevel: activeTab.zoomLevel,
        scrollPosition: activeTab.scrollPosition || { x: 0, y: 0 },
        lastUpdated: timestamp
      };
      
      // Add the tab to all panes
      return prevPanes.map(pane => {
        if (pane.tabs.length >= 10) {
          if (pane.id === paneId) {
            alert('Maximum 10 tabs per window reached');
          }
          return pane;
        }
        
        const newTab: Tab = {
          ...newTabBase,
          id: `${generateId()}_${pane.id}`,
        };
        
        return {
          ...pane,
          tabs: [...pane.tabs, newTab],
          activeTabId: pane.id === paneId ? newTab.id : pane.activeTabId,
        };
      });
    });
  }, []);

  const handleTabRemove = useCallback((paneId: string, tabId: string) => {
    // Find the tab to check for unsaved changes
    const pane = panes.find(p => p.id === paneId);
    const tab = pane?.tabs.find(t => t.id === tabId);
    
    if (tab?.fileName && hasUnsavedChanges && hasUnsavedChanges(tab.fileName)) {
      // Show confirm dialog for unsaved changes
      setConfirmDialog({
        isOpen: true,
        paneId,
        tabId,
        fileName: tab.fileName,
      });
    } else {
      // No unsaved changes, proceed with removal
      setPanes(prevPanes => prevPanes.map(pane => {
        if (pane.id === paneId && pane.tabs.length > 1) {
          const newTabs = pane.tabs.filter(t => t.id !== tabId);
          const newActiveTabId = pane.activeTabId === tabId 
            ? newTabs[0].id 
            : pane.activeTabId;
          return {
            ...pane,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        }
        return pane;
      }));
    }
  }, [panes, hasUnsavedChanges]);

  const handleTabChange = useCallback((paneId: string, tabId: string) => {
    setPanes(prevPanes => prevPanes.map(pane => 
      pane.id === paneId 
        ? { ...pane, activeTabId: tabId }
        : pane
    ));
  }, []);

  const handleTabRename = useCallback((paneId: string, tabId: string, newName: string) => {
    setPanes(prevPanes => prevPanes.map(pane => {
      if (pane.id === paneId) {
        return {
          ...pane,
          tabs: pane.tabs.map(tab => 
            tab.id === tabId 
              ? { ...tab, name: newName }
              : tab
          ),
        };
      }
      return pane;
    }));
  }, []);

  // Handle zoom change for specific tab
  const handleZoomChange = useCallback((paneId: string, tabId: string, zoom: number | 'fit-width' | 'fit-page') => {
    setPanes(prevPanes => prevPanes.map(pane => {
      if (pane.id === paneId) {
        return {
          ...pane,
          tabs: pane.tabs.map(tab => 
            tab.id === tabId 
              ? { ...tab, zoomLevel: zoom }
              : tab
          ),
        };
      }
      return pane;
    }));
  }, []);

  // Update layout when it changes externally
  React.useEffect(() => {
    // Clean up old viewer refs when layout changes
    pdfViewerRefs.current.clear();
    
    setPanes(prevPanes => {
      let newPanes: WindowPane[] = [...prevPanes];
      
      // Get all unique tabs from all panes
      const allUniqueTabs = new Map<string, Tab>();
      prevPanes.forEach(pane => {
        pane.tabs.forEach(tab => {
          if (tab.fileName) {
            // Use fileName as key to identify unique tabs
            const existingTab = allUniqueTabs.get(tab.fileName);
            if (!existingTab || tab.lastUpdated! > (existingTab.lastUpdated || 0)) {
              allUniqueTabs.set(tab.fileName, tab);
            }
          }
        });
      });
      
      // Convert Map to array
      const uniqueTabs = Array.from(allUniqueTabs.values());
      
      switch (layout) {
        case 'single':
          // Preserve all tabs in single pane
          const singlePaneTabs = uniqueTabs.length > 0 ? uniqueTabs.map((tab, index) => ({
            ...tab,
            id: `tab_single_${index}`
          })) : prevPanes[0].tabs;
          
          newPanes = [{
            ...prevPanes[0],
            id: 'pane_1', // Ensure pane_1 ID for single layout
            tabs: singlePaneTabs,
            activeTabId: singlePaneTabs.length > 0 ? singlePaneTabs[0].id : 'tab_single_0'
          }];
          break;
          
        case 'vertical':
        case 'horizontal':
          if (prevPanes.length < 2) {
            // Create second pane with same tabs
            const timestamp = Date.now();
            const sharedTabs = uniqueTabs.length > 0 ? uniqueTabs : prevPanes[0].tabs;
            
            newPanes = [
              {
                ...prevPanes[0],
                tabs: sharedTabs.map((tab, index) => ({
                  ...tab,
                  id: `tab_p1_${index}`,
                  lastUpdated: timestamp
                }))
              },
              {
                id: 'pane_2',
                tabs: sharedTabs.map((tab, index) => ({
                  ...tab,
                  id: `tab_p2_${index}`,
                  lastUpdated: timestamp
                })),
                activeTabId: `tab_p2_0`,
              }
            ];
          } else {
            // Keep existing panes but ensure they have all tabs
            newPanes = prevPanes.slice(0, 2).map((pane, paneIndex) => ({
              ...pane,
              tabs: uniqueTabs.length > 0 ? uniqueTabs.map((tab, index) => ({
                ...tab,
                id: `tab_p${paneIndex + 1}_${index}`
              })) : pane.tabs
            }));
          }
          break;
          
        case 'tile':
          // Create 4 panes with all tabs
          const tileTimestamp = Date.now();
          const tileTabs = uniqueTabs.length > 0 ? uniqueTabs : prevPanes[0].tabs;
          
          newPanes = [];
          for (let i = 0; i < 4; i++) {
            const paneId = `pane_${i + 1}`;
            const pane = prevPanes[i] || { id: paneId, activeTabId: '' };
            
            const paneTabs = tileTabs.map((tab, index) => ({
              ...tab,
              id: `tab_p${i + 1}_${index}`,
              lastUpdated: tileTimestamp
            }));
            
            newPanes.push({
              ...pane,
              id: paneId,
              tabs: paneTabs,
              activeTabId: paneTabs[0]?.id || pane.activeTabId,
            });
          }
          break;
      }
      
      return newPanes;
    });
    
    // Reset active pane ID to pane_1 for single layout
    if (layout === 'single') {
      setActivePaneId('pane_1');
    }
  }, [layout]); // Only depend on layout

  // Handle Ctrl+wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent, paneId: string, tabId: string) => {
    if (e.ctrlKey || e.metaKey) {
      // Prevent browser zoom completely
      e.preventDefault();
      e.stopPropagation();
      
      setPanes(prevPanes => {
        const pane = prevPanes.find(p => p.id === paneId);
        const tab = pane?.tabs.find(t => t.id === tabId);
        if (!tab) return prevPanes;
        
        const delta = e.deltaY < 0 ? 0.1 : -0.1; // Zoom in/out
        let newZoom: number | 'fit-width' | 'fit-page';
        
        if (typeof tab.zoomLevel === 'number') {
          newZoom = Math.max(0.25, Math.min(3, tab.zoomLevel + delta));
        } else {
          newZoom = 1 + delta;
        }
        
        return prevPanes.map(p => {
          if (p.id === paneId) {
            return {
              ...p,
              tabs: p.tabs.map(t => 
                t.id === tabId 
                  ? { ...t, zoomLevel: newZoom }
                  : t
              ),
            };
          }
          return p;
        });
      });
    }
  }, []);

  // Block browser zoom completely except in PDF areas
  React.useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as Element;
        const isInPDFArea = target.closest('.pdf-viewer');
        
        // Always prevent browser zoom, PDF viewer will handle its own zoom
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block all browser zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Use capture phase to ensure we get events first
    document.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
    document.addEventListener('keydown', handleKeyDown, { passive: false, capture: true });
    
    return () => {
      document.removeEventListener('wheel', handleGlobalWheel, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Render single pane
  const renderPane = (pane: WindowPane, isActive: boolean) => {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId) || pane.tabs[0];
    
    return (
      <div 
        key={pane.id}
        className={`flex flex-col h-full ${isActive ? 'ring-2 ring-blue-500' : ''}`}
        onClick={() => setActivePaneId(pane.id)}
      >
        <TabManager
          tabs={pane.tabs}
          activeTabId={pane.activeTabId}
          onTabChange={(tabId) => handleTabChange(pane.id, tabId)}
          onTabAdd={() => handleTabAdd(pane.id)}
          onTabRemove={(tabId) => handleTabRemove(pane.id, tabId)}
          onTabRename={(tabId, newName) => handleTabRename(pane.id, tabId, newName)}
        />
        
        <WindowPaneHeader
          activeTab={activeTab}
          totalPages={pdfDoc?.numPages}
          loadedFiles={loadedFiles}
          onPageChange={(page) => handlePageChange(pane.id, activeTab.id, page)}
          onZoomChange={(zoom) => handleZoomChange(pane.id, activeTab.id, zoom)}
          onSaveAnnotations={onSaveAnnotations}
          onLoadAnnotations={onLoadAnnotations}
          pageInputRef={(ref) => pageInputRefs.current.set(pane.id, ref)}
          paneId={pane.id}
          onFileOpenInNewTab={(file) => {
            // Always create a new tab when selecting from loaded files
            const timestamp = Date.now();
            
            setPanes(prevPanes => {
              const newTabBase = {
                name: file.name.replace('.pdf', '').slice(0, 20),
                file: file,
                fileName: file.name,
                currentPage: 1,
                zoomLevel: 'fit-width' as const,
                scrollPosition: { x: 0, y: 0 },
                lastUpdated: timestamp
              };
              
              return prevPanes.map(p => {
                // Only add to the current pane
                if (p.id !== pane.id) return p;
                
                // Check if we're at tab limit
                if (p.tabs.length >= 10) {
                  alert('Maximum 10 tabs per window reached');
                  return p;
                }
                
                // Create new tab
                const newTab: Tab = {
                  ...newTabBase,
                  id: `${generateId()}_${p.id}`,
                };
                
                return {
                  ...p,
                  tabs: [...p.tabs, newTab],
                  activeTabId: newTab.id,
                };
              });
            });
          }}
          onFileUpload={(file) => {
            const timestamp = Date.now();
            
            setPanes(prevPanes => {
              // Create a new tab for all panes
              const newTabBase = {
                name: file.name.replace('.pdf', '').slice(0, 20),
                file: file,
                fileName: file.name,
                currentPage: 1,
                zoomLevel: 'fit-width' as const,
                scrollPosition: { x: 0, y: 0 },
                lastUpdated: timestamp
              };
              
              const updatedPanes = prevPanes.map(p => {
                const currentActiveTab = p.tabs.find(t => t.id === p.activeTabId);
                
                // If current tab has no file in the clicked pane, update it
                if (p.id === pane.id && currentActiveTab && !currentActiveTab.file) {
                  return {
                    ...p,
                    tabs: p.tabs.map(t => {
                      if (t.id === p.activeTabId) {
                        return {
                          ...t,
                          ...newTabBase,
                          id: t.id, // Keep the same ID
                        };
                      }
                      return t;
                    })
                  };
                }
                
                // Check if we already have this file open in this pane
                const existingTab = p.tabs.find(t => t.fileName === file.name);
                if (existingTab) {
                  // Switch to existing tab
                  return {
                    ...p,
                    activeTabId: existingTab.id
                  };
                }
                
                // Otherwise create new tab if not at limit
                if (p.tabs.length >= 10) {
                  if (p.id === pane.id) {
                    alert('Maximum 10 tabs per window reached');
                  }
                  return p;
                }
                
                // Create unique tab ID for each pane
                const newTab: Tab = {
                  ...newTabBase,
                  id: `${generateId()}_${p.id}`,
                };
                
                return {
                  ...p,
                  tabs: [...p.tabs, newTab],
                  activeTabId: p.id === pane.id ? newTab.id : p.activeTabId,
                };
              });
              
              return updatedPanes;
            });
          }}
        />
        
        <div className="flex-1 overflow-hidden pdf-viewer">
          {activeTab && (() => {
            // More unique key to force re-render
            const componentKey = `${pane.id}-${activeTab.id}-${activeTab.lastUpdated || Date.now()}`;
            
            
            // Only render if we have a file
            const fileToUse = activeTab.file || pdfFile;
            
            if (!fileToUse) {
              return (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <p>No PDF loaded in this tab</p>
                    <p className="text-sm mt-2">Use the 📂 button to open a file</p>
                  </div>
                </div>
              );
            }
            
            // Get annotations for this specific file
            const fileName = activeTab.fileName || fileToUse.name;
            const fileAnns = fileAnnotations[fileName] || {};
            const pageKey = `page_${activeTab.currentPage}`;
            const pageAnnotations = fileAnns[pageKey] || [];
            
            
            return (
              <SimplePDFViewer
                ref={(viewerRef) => {
                  const viewerKey = `${pane.id}_${activeTab.id}`;
                  if (viewerRef) {
                    pdfViewerRefs.current.set(viewerKey, viewerRef);
                  } else {
                    pdfViewerRefs.current.delete(viewerKey);
                  }
                }}
                key={componentKey}
                file={fileToUse}
                currentPage={activeTab.currentPage}
                zoomLevel={activeTab.zoomLevel}
                scrollPosition={activeTab.scrollPosition}
                annotations={pageAnnotations}
                currentTool={toolSettings.currentTool}
                toolSettings={toolSettings}
                onPageChange={(page) => handlePageChange(pane.id, activeTab.id, page)}
                onZoomChange={(zoom) => handleZoomChange(pane.id, activeTab.id, zoom)}
                onScrollChange={(pos) => {
                  setPanes(prevPanes => prevPanes.map(p => {
                    if (p.id === pane.id) {
                      return {
                        ...p,
                        tabs: p.tabs.map(t => 
                          t.id === activeTab.id 
                            ? { ...t, scrollPosition: pos }
                            : t
                        ),
                      };
                    }
                    return p;
                  }));
                }}
                onDocumentLoad={onDocumentLoad}
                onAnnotationAdd={(annotation) => {
                  onAnnotationAdd(fileName, annotation);
                }}
                onAnnotationRemove={(annotationId) => {
                  // Find the annotation to get its page number
                  const pageNum = activeTab.currentPage;
                  onAnnotationRemove(fileName, annotationId, pageNum);
                }}
                onAnnotationUpdate={(annotationId, updates) => {
                  onAnnotationUpdate(fileName, annotationId, updates);
                }}
                onToolChange={onToolChange}
              />
            );
          })()}
        </div>
      </div>
    );
  };

  // Render based on layout
  // Handle confirm dialog actions
  const handleConfirmSave = useCallback(() => {
    // Save annotations and then close tab
    if (onSaveAnnotations) {
      onSaveAnnotations();
    }
    
    // Close the tab after saving
    const { paneId, tabId } = confirmDialog;
    setPanes(prevPanes => prevPanes.map(pane => {
      if (pane.id === paneId && pane.tabs.length > 1) {
        const newTabs = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId 
          ? newTabs[0].id 
          : pane.activeTabId;
        return {
          ...pane,
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      }
      return pane;
    }));
    
    setConfirmDialog({ isOpen: false, paneId: '', tabId: '', fileName: '' });
  }, [confirmDialog, onSaveAnnotations]);

  const handleConfirmDiscard = useCallback(() => {
    // Close tab without saving
    const { paneId, tabId } = confirmDialog;
    setPanes(prevPanes => prevPanes.map(pane => {
      if (pane.id === paneId && pane.tabs.length > 1) {
        const newTabs = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId 
          ? newTabs[0].id 
          : pane.activeTabId;
        return {
          ...pane,
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      }
      return pane;
    }));
    
    setConfirmDialog({ isOpen: false, paneId: '', tabId: '', fileName: '' });
  }, [confirmDialog]);

  const handleConfirmCancel = useCallback(() => {
    // Cancel the close operation
    setConfirmDialog({ isOpen: false, paneId: '', tabId: '', fileName: '' });
  }, []);

  // Handle divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  }, []);

  const handleDividerHMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDividerH(true);
  }, []);

  // Handle divider touch events for mobile
  const handleDividerTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  }, []);

  const handleDividerHTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingDividerH(true);
  }, []);

  const handleDividerMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingDivider && !isDraggingDividerH) return;
    
    const container = document.querySelector('.window-manager-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    let newRatio: number;
    
    if (isDraggingDivider) {
      if (layout === 'vertical' || layout === 'tile') {
        newRatio = (e.clientX - rect.left) / rect.width;
        setSplitRatio(Math.max(0.1, Math.min(0.9, newRatio)));
      } else if (layout === 'horizontal') {
        newRatio = (e.clientY - rect.top) / rect.height;
        setSplitRatio(Math.max(0.1, Math.min(0.9, newRatio)));
      }
    }
    
    if (isDraggingDividerH && layout === 'tile') {
      newRatio = (e.clientY - rect.top) / rect.height;
      setSplitRatioH(Math.max(0.1, Math.min(0.9, newRatio)));
    }
  }, [isDraggingDivider, isDraggingDividerH, layout]);

  const handleDividerMouseUp = useCallback(() => {
    setIsDraggingDivider(false);
    setIsDraggingDividerH(false);
  }, []);

  // Touch event handlers for mobile
  const handleDividerTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingDivider && !isDraggingDividerH) return;
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const container = document.querySelector('.window-manager-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    let newRatio: number;
    
    if (isDraggingDivider) {
      if (layout === 'vertical' || layout === 'tile') {
        newRatio = (touch.clientX - rect.left) / rect.width;
        setSplitRatio(Math.max(0.1, Math.min(0.9, newRatio)));
      } else if (layout === 'horizontal') {
        newRatio = (touch.clientY - rect.top) / rect.height;
        setSplitRatio(Math.max(0.1, Math.min(0.9, newRatio)));
      }
    }
    
    if (isDraggingDividerH && layout === 'tile') {
      newRatio = (touch.clientY - rect.top) / rect.height;
      setSplitRatioH(Math.max(0.1, Math.min(0.9, newRatio)));
    }
  }, [isDraggingDivider, isDraggingDividerH, layout]);

  const handleDividerTouchEnd = useCallback(() => {
    setIsDraggingDivider(false);
    setIsDraggingDividerH(false);
  }, []);

  // Set up and tear down mouse and touch event listeners for divider dragging
  React.useEffect(() => {
    if (isDraggingDivider || isDraggingDividerH) {
      // Mouse events
      document.addEventListener('mousemove', handleDividerMouseMove);
      document.addEventListener('mouseup', handleDividerMouseUp);
      
      // Touch events for mobile
      document.addEventListener('touchmove', handleDividerTouchMove, { passive: false });
      document.addEventListener('touchend', handleDividerTouchEnd);
      document.addEventListener('touchcancel', handleDividerTouchEnd);
      
      if (isDraggingDivider) {
        document.body.style.cursor = (layout === 'vertical' || layout === 'tile') ? 'col-resize' : 'row-resize';
      } else if (isDraggingDividerH) {
        document.body.style.cursor = 'row-resize';
      }
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleDividerMouseMove);
        document.removeEventListener('mouseup', handleDividerMouseUp);
        document.removeEventListener('touchmove', handleDividerTouchMove);
        document.removeEventListener('touchend', handleDividerTouchEnd);
        document.removeEventListener('touchcancel', handleDividerTouchEnd);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      };
    }
  }, [isDraggingDivider, isDraggingDividerH, handleDividerMouseMove, handleDividerMouseUp, handleDividerTouchMove, handleDividerTouchEnd, layout]);

  const renderLayout = () => {
    switch (layout) {
      case 'single':
        return (
          <div className="h-full">
            {renderPane(panes[0], activePaneId === panes[0].id)}
          </div>
        );
        
      case 'vertical':
        return (
          <div className="h-full flex relative">
            <div 
              className="border-r border-gray-700"
              style={{ width: `${splitRatio * 100}%` }}
            >
              {renderPane(panes[0], activePaneId === panes[0].id)}
            </div>
            
            {/* Draggable divider */}
            <div
              className="absolute top-0 bottom-0 w-2 hover:w-3 bg-gray-600 hover:bg-blue-500 cursor-col-resize z-20 transition-all touch-none"
              style={{ 
                left: `calc(${splitRatio * 100}% - 4px)`,
                transition: isDraggingDivider ? 'none' : 'all 0.2s'
              }}
              onMouseDown={handleDividerMouseDown}
              onTouchStart={handleDividerTouchStart}
              title="Drag to resize panes"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-6 bg-gray-400"></div>
                  <div className="w-0.5 h-6 bg-gray-400"></div>
                </div>
              </div>
            </div>
            
            <div 
              style={{ width: `${(1 - splitRatio) * 100}%` }}
            >
              {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
            </div>
          </div>
        );
        
      case 'horizontal':
        return (
          <div className="h-full flex flex-col relative">
            <div 
              className="border-b border-gray-700"
              style={{ height: `${splitRatio * 100}%` }}
            >
              {renderPane(panes[0], activePaneId === panes[0].id)}
            </div>
            
            {/* Draggable divider */}
            <div
              className="absolute left-0 right-0 h-2 hover:h-3 bg-gray-600 hover:bg-blue-500 cursor-row-resize z-20 transition-all"
              style={{ 
                top: `calc(${splitRatio * 100}% - 4px)`,
                transition: isDraggingDivider ? 'none' : 'all 0.2s'
              }}
              onMouseDown={handleDividerMouseDown}
              onTouchStart={handleDividerTouchStart}
              title="Drag to resize panes"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col gap-0.5">
                  <div className="h-0.5 w-6 bg-gray-400"></div>
                  <div className="h-0.5 w-6 bg-gray-400"></div>
                </div>
              </div>
            </div>
            
            <div 
              style={{ height: `${(1 - splitRatio) * 100}%` }}
            >
              {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
            </div>
          </div>
        );
        
      case 'tile':
        return (
          <div className="h-full flex flex-col relative">
            <div className="flex" style={{ height: `${splitRatioH * 100}%` }}>
              <div 
                className="border-r border-b border-gray-700"
                style={{ width: `${splitRatio * 100}%` }}
              >
                {renderPane(panes[0], activePaneId === panes[0].id)}
              </div>
              <div 
                className="border-b border-gray-700"
                style={{ width: `${(1 - splitRatio) * 100}%` }}
              >
                {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
              </div>
            </div>
            
            {/* Horizontal divider for tile mode */}
            <div
              className="absolute left-0 right-0 h-2 hover:h-3 bg-gray-600 hover:bg-blue-500 cursor-row-resize z-20 transition-all"
              style={{ 
                top: `calc(${splitRatioH * 100}% - 4px)`,
                transition: isDraggingDividerH ? 'none' : 'all 0.2s'
              }}
              onMouseDown={handleDividerHMouseDown}
              onTouchStart={handleDividerHTouchStart}
              title="Drag to resize panes"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col gap-0.5">
                  <div className="h-0.5 w-6 bg-gray-400"></div>
                  <div className="h-0.5 w-6 bg-gray-400"></div>
                </div>
              </div>
            </div>
            
            {/* Vertical divider for tile mode */}
            <div
              className="absolute top-0 bottom-0 w-2 hover:w-3 bg-gray-600 hover:bg-blue-500 cursor-col-resize z-20 transition-all"
              style={{ 
                left: `calc(${splitRatio * 100}% - 4px)`,
                transition: isDraggingDivider ? 'none' : 'all 0.2s'
              }}
              onMouseDown={handleDividerMouseDown}
              onTouchStart={handleDividerTouchStart}
              title="Drag to resize panes"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-6 bg-gray-400"></div>
                  <div className="w-0.5 h-6 bg-gray-400"></div>
                </div>
              </div>
            </div>
            
            <div className="flex" style={{ height: `${(1 - splitRatioH) * 100}%` }}>
              <div 
                className="border-r border-gray-700"
                style={{ width: `${splitRatio * 100}%` }}
              >
                {panes[2] && renderPane(panes[2], activePaneId === panes[2]?.id)}
              </div>
              <div 
                style={{ width: `${(1 - splitRatio) * 100}%` }}
              >
                {panes[3] && renderPane(panes[3], activePaneId === panes[3]?.id)}
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-gray-900 window-manager-container">
      {renderLayout()}
      
      {/* Confirm dialog for unsaved changes */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Unsaved Changes"
        message={`You have unsaved changes in "${confirmDialog.fileName}". Do you want to save before closing?`}
        confirmText="Save"
        cancelText="Cancel"
        discardText="Discard"
        showDiscard={true}
        onConfirm={handleConfirmSave}
        onCancel={handleConfirmCancel}
        onDiscard={handleConfirmDiscard}
      />
    </div>
  );
});

WindowManager.displayName = 'WindowManager';