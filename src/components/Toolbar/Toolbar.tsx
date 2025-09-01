import React, { useState, useRef, useEffect } from 'react';
import {
  ToolType,
  COLOR_PRESETS,
  LINE_WIDTH_PRESETS,
  FONT_SIZE_PRESETS,
  ERASER_SIZE_PRESETS,
  WindowLayout,
} from '../../types';
import clsx from 'clsx';

interface ToolbarProps {
  currentTool: ToolType;
  color: string;
  lineWidth: number;
  fontSize: number;
  eraserSize: number;
  windowLayout?: WindowLayout;
  canUndo: boolean;
  canRedo: boolean;
  isFullscreen?: boolean;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
  onEraserSizeChange: (size: number) => void;
  onWindowLayoutChange?: (layout: WindowLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClearAll: () => void;
  onToggleFullscreen?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  color,
  lineWidth,
  fontSize,
  eraserSize,
  windowLayout = 'single',
  canUndo,
  canRedo,
  isFullscreen = false,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onFontSizeChange,
  onEraserSizeChange,
  onWindowLayoutChange,
  onUndo,
  onRedo,
  onSave,
  onLoad,
  onClearAll,
  onToggleFullscreen,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tools = [
    { id: 'pen', icon: '✏️', label: 'Pen Tool (1)' },
    { id: 'eraser', icon: '🧹', label: 'Eraser Tool (2)' },
    { id: 'text', icon: '📝', label: 'Text Tool (3)' },
    { id: 'line', icon: '📏', label: 'Line Tool (4)' },
    { id: 'select', icon: '👆', label: 'Select Tool (5)' },
  ];

  // Minimal toolbar for fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => onToolChange(tool.id as ToolType)}
                className={clsx('p-1.5 rounded text-xs', {
                  'bg-blue-600 text-white': currentTool === tool.id,
                  'text-gray-300 hover:bg-gray-700': currentTool !== tool.id,
                })}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}
          </div>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded text-gray-300 hover:bg-gray-700"
              title="Exit Fullscreen"
            >
              ❌
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-toolbar-bg text-white border-b border-gray-700 overflow-x-auto', {
      'h-toolbar': !isMobile,
      'h-12': isMobile,
    })}>
      <div className={clsx('flex items-center gap-4 min-w-fit h-full', {
        'px-4': !isMobile,
        'px-2 gap-2': isMobile,
      })}>
        {/* Tools */}
        <div className={clsx('flex items-center border-r border-gray-600', {
          'gap-2 pr-4': !isMobile,
          'gap-1 pr-2': isMobile,
        })}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id as ToolType)}
            className={clsx({
              'toolbar-button': !isMobile,
              'p-1.5 rounded text-sm': isMobile,
              'active': currentTool === tool.id && !isMobile,
              'bg-blue-600': currentTool === tool.id && isMobile,
            })}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Color picker */}
      {(currentTool === 'pen' || currentTool === 'line' || currentTool === 'text') && (
        <div className={clsx('flex items-center border-r border-gray-600', {
          'gap-2 pr-4': !isMobile,
          'gap-1 pr-2': isMobile,
        })}>
          {!isMobile && <span className="text-sm">Color:</span>}
          <div className="flex gap-1">
            {COLOR_PRESETS.slice(0, isMobile ? 4 : COLOR_PRESETS.length).map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => onColorChange(presetColor)}
                className={clsx({
                  'color-swatch': !isMobile,
                  'w-5 h-5 rounded border-2': isMobile,
                  'active': color === presetColor && !isMobile,
                  'border-white': color === presetColor && isMobile,
                  'border-transparent': color !== presetColor && isMobile,
                })}
                style={{ backgroundColor: presetColor }}
                title={presetColor}
              />
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="toolbar-button"
              title="Custom Color"
            >
              🎨
            </button>
            {showColorPicker && (
              <div className="dropdown-menu">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    onColorChange(e.target.value);
                    setShowColorPicker(false);
                  }}
                  className="w-full h-10"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Line width */}
      {(currentTool === 'pen' || currentTool === 'line') && !isMobile && (
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
          <span className="text-sm">Width:</span>
          {LINE_WIDTH_PRESETS.map((width) => (
            <button
              key={width}
              onClick={() => onLineWidthChange(width)}
              className={clsx('toolbar-button px-3 py-1', {
                active: lineWidth === width,
              })}
            >
              {width}px
            </button>
          ))}
        </div>
      )}

      {/* Font size */}
      {currentTool === 'text' && !isMobile && (
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
          <span className="text-sm">Font:</span>
          <select
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="bg-gray-700 rounded px-2 py-1"
          >
            {FONT_SIZE_PRESETS.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Eraser size */}
      {currentTool === 'eraser' && !isMobile && (
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
          <span className="text-sm">Size:</span>
          {ERASER_SIZE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onEraserSizeChange(preset.size)}
              className={clsx('toolbar-button px-3 py-1', {
                active: eraserSize === preset.size,
              })}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      {/* Undo/Redo */}
      <div className={clsx('flex items-center border-r border-gray-600', {
        'gap-2 pr-4': !isMobile,
        'gap-1 pr-2': isMobile,
      })}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={clsx('disabled:opacity-50 disabled:cursor-not-allowed', {
            'toolbar-button': !isMobile,
            'p-1.5 rounded text-sm': isMobile,
          })}
          title="Undo (Ctrl+Z)"
        >
          ↩️
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={clsx('disabled:opacity-50 disabled:cursor-not-allowed', {
            'toolbar-button': !isMobile,
            'p-1.5 rounded text-sm': isMobile,
          })}
          title="Redo (Ctrl+Y)"
        >
          ↪️
        </button>
      </div>


      {/* View Mode */}
      {onWindowLayoutChange && !isMobile && (
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
          <span className="text-sm">Layout:</span>
          <button
            onClick={() => {
              if (windowLayout === 'single') onWindowLayoutChange('vertical');
              else if (windowLayout === 'vertical') onWindowLayoutChange('horizontal');
              else if (windowLayout === 'horizontal') onWindowLayoutChange('tile');
              else onWindowLayoutChange('single');
            }}
            className={`px-3 py-1 rounded text-sm ${
              windowLayout === 'single' 
                ? 'bg-gray-600 text-white' 
                : windowLayout === 'vertical'
                ? 'bg-blue-600 text-white'
                : windowLayout === 'horizontal'
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 text-white'
            }`}
          >
            {windowLayout === 'single' ? '◻ Single' : 
             windowLayout === 'vertical' ? '⬛ Vertical' : 
             windowLayout === 'horizontal' ? '⬜ Horizontal' :
             '⬚ Tile'}
          </button>
        </div>
      )}

      {/* Fullscreen button */}
      {onToggleFullscreen && (
        <div className={clsx('border-r border-gray-600', {
          'pr-4': !isMobile,
          'pr-2': isMobile,
        })}>
          <button
            onClick={onToggleFullscreen}
            className={clsx({
              'toolbar-button': !isMobile,
              'p-1.5 rounded text-sm': isMobile,
            })}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? '❌' : '⛶'}
          </button>
        </div>
      )}

      {/* Clear all */}
      <div className="ml-auto">
        <button
          onClick={() => {
            if (confirm('Clear all annotations? This cannot be undone.')) {
              onClearAll();
            }
          }}
          className={clsx('bg-red-600 hover:bg-red-700', {
            'toolbar-button': !isMobile,
            'p-1.5 rounded text-sm': isMobile,
          })}
          title="Clear All Annotations"
        >
          {isMobile ? '🗑️' : '🗑️ Clear All'}
        </button>
      </div>
      </div>
    </div>
  );
};