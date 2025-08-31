import React, { useState, useCallback, useRef } from 'react';
import { Tab } from '../../types';
import { ZOOM_PRESETS } from '../../types';
import { isPDFFile } from '../../utils/helpers';

interface WindowPaneHeaderProps {
  activeTab: Tab;
  totalPages?: number;
  loadedFiles?: File[];
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number | 'fit-width' | 'fit-page') => void;
  onFileUpload?: (file: File) => void;
  onFileOpenInNewTab?: (file: File) => void;
  onSaveAnnotations?: () => void;
  onLoadAnnotations?: () => void;
  pageInputRef?: (ref: HTMLInputElement | null) => void;
}

export const WindowPaneHeader: React.FC<WindowPaneHeaderProps> = ({
  activeTab,
  totalPages = 0,
  loadedFiles = [],
  onPageChange,
  onZoomChange,
  onFileUpload,
  onFileOpenInNewTab,
  onSaveAnnotations,
  onLoadAnnotations,
  pageInputRef,
}) => {
  const [showPageJump, setShowPageJump] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePageJump = useCallback(() => {
    const pageNum = parseInt(pageJumpValue);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setShowPageJump(false);
      setPageJumpValue('');
    }
  }, [pageJumpValue, totalPages, onPageChange]);

  const handlePrevPage = useCallback(() => {
    if (activeTab.currentPage > 1) {
      onPageChange(activeTab.currentPage - 1);
    }
  }, [activeTab.currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (activeTab.currentPage < totalPages) {
      onPageChange(activeTab.currentPage + 1);
    }
  }, [activeTab.currentPage, totalPages, onPageChange]);

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

  return (
    <div className="bg-gray-800 text-white text-xs border-b border-gray-600 overflow-x-auto">
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
          <button
            onClick={handlePrevPage}
            disabled={activeTab.currentPage <= 1}
            className="px-1 py-0.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs"
            title="Previous Page"
          >
            ◀
          </button>
          
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
                className="px-1 py-0.5 hover:bg-gray-700 rounded text-xs min-w-12"
                title="Click to jump to page"
              >
                {activeTab.currentPage}
              </button>
            )}
          </div>
          
          <span className="text-gray-400">/</span>
          <span className="text-gray-300">{totalPages}</span>
          
          <button
            onClick={handleNextPage}
            disabled={activeTab.currentPage >= totalPages}
            className="px-1 py-0.5 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs"
            title="Next Page"
          >
            ▶
          </button>
        </div>

        {/* Zoom control */}
        <div className="relative">
          <button
            onClick={() => setShowZoomMenu(!showZoomMenu)}
            className="px-2 py-0.5 hover:bg-gray-700 rounded text-xs min-w-16"
            title="Zoom Level"
          >
            {typeof activeTab.zoomLevel === 'number'
              ? `${Math.round(activeTab.zoomLevel * 100)}%`
              : activeTab.zoomLevel === 'fit-width'
              ? 'Fit W'
              : 'Fit P'}
            ▼
          </button>
          
          {showZoomMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowZoomMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 min-w-24">
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      onZoomChange(preset.value);
                      setShowZoomMenu(false);
                    }}
                    className="block w-full px-2 py-1 text-left hover:bg-gray-600 text-xs first:rounded-t last:rounded-b"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};