import React, { useState, useCallback } from 'react';
import { WindowLayout, WindowPane, Tab, Annotation, ToolSettings } from '../../types';
import { TabManager } from '../TabManager/TabManager';
import { SimplePDFViewer } from '../PDFViewer/SimplePDFViewer';
import { WindowPaneHeader } from '../WindowPane/WindowPaneHeader';
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
}

export const WindowManager: React.FC<WindowManagerProps> = ({
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
}) => {
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
  }, []);

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

  // Handle page change for specific tab
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
          newPanes = [{
            ...prevPanes[0],
            tabs: uniqueTabs.length > 0 ? uniqueTabs.map((tab, index) => ({
              ...tab,
              id: `tab_single_${index}`
            })) : prevPanes[0].tabs
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
              />
            );
          })()}
        </div>
      </div>
    );
  };

  // Render based on layout
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
          <div className="h-full flex">
            <div className="w-1/2 border-r border-gray-700">
              {renderPane(panes[0], activePaneId === panes[0].id)}
            </div>
            <div className="w-1/2">
              {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
            </div>
          </div>
        );
        
      case 'horizontal':
        return (
          <div className="h-full flex flex-col">
            <div className="h-1/2 border-b border-gray-700">
              {renderPane(panes[0], activePaneId === panes[0].id)}
            </div>
            <div className="h-1/2">
              {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
            </div>
          </div>
        );
        
      case 'tile':
        return (
          <div className="h-full flex flex-col">
            <div className="h-1/2 flex">
              <div className="w-1/2 border-r border-b border-gray-700">
                {renderPane(panes[0], activePaneId === panes[0].id)}
              </div>
              <div className="w-1/2 border-b border-gray-700">
                {panes[1] && renderPane(panes[1], activePaneId === panes[1]?.id)}
              </div>
            </div>
            <div className="h-1/2 flex">
              <div className="w-1/2 border-r border-gray-700">
                {panes[2] && renderPane(panes[2], activePaneId === panes[2]?.id)}
              </div>
              <div className="w-1/2">
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
    <div className="h-full bg-gray-900">
      {renderLayout()}
    </div>
  );
};