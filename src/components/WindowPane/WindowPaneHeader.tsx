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
  pageInputRef?: (ref: HTMLInputElement | null) => void;
  paneId?: string;
  onPanStart?: () => void;
  onPanMove?: (deltaX: number, deltaY: number) => void;
  onPanEnd?: () => void;
  isMaximized?: boolean;
  onMaximizeToggle?: () => void;
}

export const WindowPaneHeader: React.FC<WindowPaneHeaderProps> = ({
  activeTab,
  totalPages = 0,
  actualScale = 1,
  loadedFiles = [],
  onPageChange,
  onZoomChange,
  onFileUpload,
  onFileOpenInNewTab,
  onSaveAnnotations,
  onLoadAnnotations,
  pageInputRef,
  paneId,
  onPanStart,
  onPanMove,
  onPanEnd,
  isMaximized = false,
  onMaximizeToggle,
}) => {
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pan gesture state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePageJump = useCallback(() => {
    const pageNum = parseInt(pageJumpValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setShowPageJump(false);
      setPageJumpValue('');
    }
  }, [pageJumpValue, totalPages, onPageChange]);

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

  // Pan gesture handlers
  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    setIsPanning(true);
    if (onPanStart) onPanStart();
  }, [onPanStart]);

  const handlePanPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current || !onPanMove) return;

    const deltaX = panStartRef.current.x - e.clientX;
    const deltaY = panStartRef.current.y - e.clientY;

    onPanMove(deltaX, deltaY);

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY
    };
  }, [isPanning, onPanMove]);

  const handlePanPointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
    if (onPanEnd) onPanEnd();
  }, [onPanEnd]);

  // Global pointer move/up listeners for pan gesture
  React.useEffect(() => {
    if (isPanning) {
      const handleMove = (e: PointerEvent) => {
        const syntheticEvent = {
          clientX: e.clientX,
          clientY: e.clientY,
        } as React.PointerEvent;
        handlePanPointerMove(syntheticEvent);
      };
      const handleUp = () => handlePanPointerUp();

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);

      return () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
    }
  }, [isPanning, handlePanPointerMove, handlePanPointerUp]);

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
      
      {/* Left side - Tab and File info */}
      <div className="flex items-center gap-3">
        <span className="font-medium text-blue-400">
          {activeTab.name}
        </span>
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
        {activeTab.fileName && (
          <>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300 truncate max-w-32" title={activeTab.fileName}>
              {activeTab.fileName}
            </span>
          </>
        )}
      </div>

      {/* Right side - Page and Zoom controls */}
      <div className="flex items-center gap-3">
        {/* Page controls */}
        <div className="flex items-center gap-1">
          <div className="relative">
            {showPageJump ? (
              <div className="flex items-center gap-1">
                <input
                  ref={pageInputRef}
                  type="number"
                  value={pageJumpValue}
                  onChange={(e) => setPageJumpValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePageJump();
                    if (e.key === 'Escape') {
                      setShowPageJump(false);
                      setPageJumpValue('');
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowPageJump(false);
                      setPageJumpValue('');
                    }, 200);
                  }}
                  className="w-12 px-1 py-0.5 bg-gray-700 border border-gray-500 rounded text-center text-xs"
                  placeholder={activeTab.currentPage.toString()}
                  min="1"
                  max={totalPages}
                  autoFocus
                />
                <button
                  onClick={handlePageJump}
                  className="px-1 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                >
                  Go
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPageJump(true)}
                className={`px-1 py-0.5 hover:bg-gray-700 rounded text-xs min-w-12 ${paneId ? `page-jump-button-${paneId}` : ''}`}
                title="Click to jump to page"
              >
                {activeTab.currentPage}
              </button>
            )}
          </div>

          <span className="text-gray-400">/</span>
          <span className="text-gray-300">{totalPages}</span>
        </div>

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

        {/* Pan (move) button */}
        {onPanMove && (
          <button
            onPointerDown={handlePanPointerDown}
            className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs select-none"
            title="Drag to pan view"
          >
            ✋
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

    {/* Zoom slider on window right edge */}
    {showZoomSlider && paneId && (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowZoomSlider(false)}
        />
        <div
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 p-3 flex flex-col items-center gap-2"
          style={{ width: '60px' }}
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