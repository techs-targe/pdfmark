import React, { useState, useRef } from 'react';
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
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools = [
    { id: 'pen', icon: '✏️', label: 'Pen Tool (1)' },
    { id: 'eraser', icon: '🧹', label: 'Eraser Tool (2)' },
    { id: 'text', icon: '📝', label: 'Text Tool (3)' },
    { id: 'line', icon: '📏', label: 'Line Tool (4)' },
    { id: 'select', icon: '👆', label: 'Select Tool (5)' },
  ];

  return (
    <div className="h-toolbar bg-toolbar-bg text-white border-b border-gray-700 overflow-x-auto">
      <div className="flex items-center px-4 gap-4 min-w-fit">
        {/* Tools */}
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id as ToolType)}
            className={clsx('toolbar-button', {
              active: currentTool === tool.id,
            })}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Color picker */}
      {(currentTool === 'pen' || currentTool === 'line' || currentTool === 'text') && (
        <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
          <span className="text-sm">Color:</span>
          <div className="flex gap-1">
            {COLOR_PRESETS.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => onColorChange(presetColor)}
                className={clsx('color-swatch', {
                  active: color === presetColor,
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
      {(currentTool === 'pen' || currentTool === 'line') && (
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
      {currentTool === 'text' && (
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
      {currentTool === 'eraser' && (
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
      <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="toolbar-button disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩️
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="toolbar-button disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          ↪️
        </button>
      </div>


      {/* View Mode */}
      {onWindowLayoutChange && (
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

      {/* Clear all */}
      <div className="ml-auto">
        <button
          onClick={() => {
            if (confirm('Clear all annotations? This cannot be undone.')) {
              onClearAll();
            }
          }}
          className="toolbar-button bg-red-600 hover:bg-red-700"
          title="Clear All Annotations"
        >
          🗑️ Clear All
        </button>
      </div>
      </div>
    </div>
  );
};