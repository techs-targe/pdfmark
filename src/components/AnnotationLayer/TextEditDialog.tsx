import React, { useState, useEffect, useRef } from 'react';
import { TextAnnotation } from '../../types';
import { COLOR_PRESETS, FONT_SIZE_PRESETS } from '../../types';
import { normalizedToScreen } from '../../utils/helpers';

interface TextEditDialogProps {
  annotation: TextAnnotation;
  canvasWidth: number;
  canvasHeight: number;
  onSave: (updates: Partial<TextAnnotation>) => void;
  onCancel: () => void;
}

export const TextEditDialog: React.FC<TextEditDialogProps> = ({
  annotation,
  canvasWidth,
  canvasHeight,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(annotation.content);
  const [color, setColor] = useState(annotation.color);
  const [fontSize, setFontSize] = useState(annotation.fontSize);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    onSave({
      content,
      color,
      fontSize,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Calculate position for the dialog
  const screenPos = normalizedToScreen(
    annotation.position,
    canvasWidth,
    canvasHeight
  );

  return (
    <div
      className="absolute bg-gray-800 rounded-lg shadow-xl p-3 z-50 min-w-[200px]"
      style={{
        left: `${Math.min(screenPos.x, canvasWidth - 220)}px`,
        top: `${Math.min(screenPos.y + annotation.fontSize + 10, canvasHeight - 200)}px`,
      }}
    >
      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 bg-gray-700 text-white rounded mb-2 text-sm"
        placeholder="Enter text..."
      />

      {/* Color selection */}
      <div className="mb-2">
        <label className="text-xs text-gray-400 mb-1 block">Color</label>
        <div className="flex gap-1 flex-wrap">
          {COLOR_PRESETS.map((presetColor) => (
            <button
              key={presetColor}
              onClick={() => setColor(presetColor)}
              className={`w-6 h-6 rounded border-2 ${
                color === presetColor ? 'border-blue-400' : 'border-transparent'
              } hover:border-gray-400 transition-colors`}
              style={{ backgroundColor: presetColor }}
            />
          ))}
        </div>
      </div>

      {/* Font size selection */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">Size</label>
        <div className="flex gap-1">
          {FONT_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`px-2 py-1 text-xs rounded ${
                fontSize === size
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } transition-colors`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};