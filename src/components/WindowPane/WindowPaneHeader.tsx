import React, { useState, useCallback, useRef } from 'react';
import { Tab } from '../../types';
import { isPDFFile } from '../../utils/helpers';

interface WindowPaneHeaderProps {
  activeTab: Tab;
  totalPages?: number;
  actualScale?: number; // Actual calculated zoom scale for fit-width/fit-page modes
  loadedFiles?: File[];
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number | 'fit-width' | 'fit-page') => void;
  onFileUpload?: (file: File) => void;
  onFileOpenInNewTab?: (file: File) => void;
  onSaveAnnotations?: () => void;
  onLoadAnnotations?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  pageInputRef?: (ref: HTMLInputElement | null) => void;
  paneId?: string;
  onScrollbarsToggle?: () => void;
  showScrollbars?: boolean;
  isMaximized?: boolean;
  onMaximizeToggle?: () => void;
}

export const WindowPaneHeader: React.FC<WindowPaneHeaderProps> = ({
  activeTab,
  totalPages: _totalPages = 0,
  actualScale = 1,
  loadedFiles = [],
  onPageChange: _onPageChange,
  onZoomChange,
  onFileUpload,
  onFileOpenInNewTab,
  onSaveAnnotations,
  onLoadAnnotations,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  pageInputRef: _pageInputRef,
  paneId,
  onScrollbarsToggle,
  showScrollbars = false,
  isMaximized = false,
  onMaximizeToggle,
}) => {
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isPDFFile(file) && onFileUpload) {
      onFileUpload(file);
    } else if (file && !isPDFFile(file)) {
      alert('Please select a valid PDF file');
    }
    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileUpload]);

  const handleJsonLoad = useCallback(() => {
    // Simply trigger the load function from the parent
    if (onLoadAnnotations) {
      onLoadAnnotations();
    }
  }, [onLoadAnnotations]);

  // Get current zoom as percentage (5-800)
  const getCurrentZoomPercent = useCallback(() => {
    if (typeof activeTab.zoomLevel === 'number') {
      return Math.round(activeTab.zoomLevel * 100);
    }
    // For fit-width and fit-page, use actualScale
    return Math.round(actualScale * 100);
  }, [activeTab.zoomLevel, actualScale]);

  // Handle zoom slider change
  const handleZoomSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseInt(e.target.value);
    const zoom = percent / 100;
    onZoomChange(zoom);
  }, [onZoomChange]);

  return (
    <>
    <div className="bg-gray-800 text-white text-xs border-b border-gray-600 overflow-x-auto relative">
      <div className="flex items-center justify-between px-2 py-1 min-w-fit">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Left side - File controls */}
      <div className="flex items-center gap-3">
        {onFileUpload && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs"
              title="Open new PDF file"
            >
              📂
            </button>
            {loadedFiles.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowFileSelector(prev => !prev);
                  }}
                  className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs"
                  title="Select from loaded files"
                >
                  📁
                </button>
                {showFileSelector && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowFileSelector(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 min-w-48 max-h-48 overflow-y-auto">
                      <div className="text-gray-400 text-xs px-2 py-1 border-b border-gray-600">📂 Open PDFs</div>
                      {loadedFiles.map((file, index) => {
                        const isCurrent = file.name === activeTab.fileName;
                        return (
                          <button
                            type="button"
                            key={index}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Skip if current file
                              if (isCurrent) {
                                setShowFileSelector(false);
                                return;
                              }
                              
                              // Always prefer onFileOpenInNewTab for opening from list
                              if (onFileOpenInNewTab) {
                                onFileOpenInNewTab(file);
                              } else if (onFileUpload) {
                                onFileUpload(file);
                              }
                              
                              setShowFileSelector(false);
                            }}
                            className={`block w-full px-2 py-1 text-left text-xs flex items-center gap-1 ${
                              isCurrent 
                                ? 'bg-blue-600 text-white' 
                                : 'hover:bg-gray-600'
                            }`}
                            style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                            title={file.name}
                          >
                            {isCurrent && <span className="text-yellow-300">★</span>}
                            <span className="truncate">{file.name}</span>
                            {isCurrent && <span className="text-xs text-blue-200 ml-auto">(current)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {/* JSON Save/Load buttons */}
        {onSaveAnnotations && (
          <button
            onClick={onSaveAnnotations}
            className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs"
            title="Save annotations to JSON"
          >
            💾
          </button>
        )}
        {onLoadAnnotations && (
          <button
            onClick={handleJsonLoad}
            className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs"
            title="Load annotations from JSON"
          >
            📥
          </button>
        )}
        {/* Undo/Redo buttons */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`px-1 py-0.5 rounded text-xs ${
              canUndo ? 'hover:bg-gray-700' : 'opacity-30 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`px-1 py-0.5 rounded text-xs ${
              canRedo ? 'hover:bg-gray-700' : 'opacity-30 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
        )}
        {activeTab.fileName && (
          <>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300 truncate max-w-32" title={activeTab.fileName}>
              {activeTab.fileName}
            </span>
          </>
        )}
      </div>

      {/* Right side - Zoom controls */}
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          {/* Zoom percentage button */}
          <button
            onClick={() => setShowZoomSlider(!showZoomSlider)}
            className="px-2 py-0.5 hover:bg-gray-700 rounded text-xs min-w-16"
            title="Click to show zoom slider"
          >
            {typeof activeTab.zoomLevel === 'number'
              ? `${Math.round(activeTab.zoomLevel * 100)}%`
              : activeTab.zoomLevel === 'fit-width'
              ? 'Fit W'
              : 'Fit P'}
          </button>

          {/* Page fit button */}
          <button
            onClick={() => onZoomChange('fit-page')}
            className={`px-1 py-0.5 hover:bg-gray-700 rounded text-xs ${
              activeTab.zoomLevel === 'fit-page' ? 'bg-blue-600' : ''
            }`}
            title="Fit page"
          >
            ⊡
          </button>

          {/* Width fit button */}
          <button
            onClick={() => onZoomChange('fit-width')}
            className={`px-1 py-0.5 hover:bg-gray-700 rounded text-xs ${
              activeTab.zoomLevel === 'fit-width' ? 'bg-blue-600' : ''
            }`}
            title="Fit width"
          >
            ⬌
          </button>
        </div>

        {/* Scrollbars toggle button */}
        {onScrollbarsToggle && (
          <button
            onClick={() => {
              console.log('🔵 WindowPaneHeader: Scrollbars button clicked! Current state:', showScrollbars);
              onScrollbarsToggle();
            }}
            className={`px-1 py-0.5 hover:bg-gray-700 rounded text-xs ${
              showScrollbars ? 'bg-blue-600' : ''
            }`}
            title="Toggle scrollbars"
          >
            ⊞
          </button>
        )}

        {/* Maximize button */}
        {onMaximizeToggle && (
          <button
            onClick={onMaximizeToggle}
            className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs"
            title={isMaximized ? "Restore window" : "Maximize window"}
          >
            {isMaximized ? '🗗' : '🗖'}
          </button>
        )}
      </div>
      </div>
    </div>

    {/* Zoom slider on window left edge (positioned relative to parent container) */}
    {showZoomSlider && paneId && (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowZoomSlider(false)}
        />
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 p-3 flex flex-col items-center gap-2"
          style={{ width: '60px' }}
          id={`zoom-slider-${paneId}`}
        >
          {/* Min label (5%) - at top */}
          <div className="text-xs text-gray-300 font-mono">5%</div>

          {/* Vertical slider (rotated and flipped) */}
          <div className="relative h-64 flex items-center justify-center">
            <input
              type="range"
              min="5"
              max="800"
              value={getCurrentZoomPercent()}
              onChange={handleZoomSliderChange}
              className="absolute vertical-slider"
              style={{
                width: '256px', // height of slider in rotated state
                transform: 'rotate(-90deg) scaleX(-1)', // Rotate and flip to make top=max, bottom=min
                transformOrigin: 'center',
              }}
            />
          </div>

          {/* Max label (800%) - at bottom */}
          <div className="text-xs text-gray-300 font-mono">800%</div>

          {/* Current zoom value */}
          <div className="text-sm text-white font-bold mt-2">
            {getCurrentZoomPercent()}%
          </div>
        </div>
      </>
    )}
    </>
  );
};