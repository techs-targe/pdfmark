import React from 'react';
import { APP_INFO } from '../../config/version';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Tools', items: [
      { key: '1', description: 'Pen Tool' },
      { key: '2', description: 'Eraser Tool' },
      { key: '3', description: 'Text Tool' },
      { key: '4', description: 'Line Tool' },
      { key: '5', description: 'Select Tool' },
      { key: 'Right Click', description: 'Toggle Pen ⇔ Eraser' },
    ]},
    { category: 'Navigation', items: [
      { key: 'PageUp / ←', description: 'Previous Page' },
      { key: 'PageDown / →', description: 'Next Page' },
      { key: 'Home', description: 'First Page' },
      { key: 'End', description: 'Last Page' },
      { key: '3-finger Double Tap', description: 'Page Navigation (Top=Prev, Bottom=Next)' },
    ]},
    { category: 'Zoom', items: [
      { key: 'Ctrl + +', description: 'Zoom In' },
      { key: 'Ctrl + -', description: 'Zoom Out' },
      { key: 'Ctrl + 0', description: 'Reset Zoom' },
      { key: '4-finger Pinch', description: 'Zoom In/Out (Center-based)' },
      { key: '5-finger Double Tap', description: 'Fit to Width' },
    ]},
    { category: 'PDF Movement', items: [
      { key: '↑↓←→', description: 'Scroll' },
      { key: 'Select Tool + Drag', description: 'Move PDF' },
      { key: '3-finger Swipe', description: 'Move PDF (Any Mode)' },
    ]},
    { category: 'Edit', items: [
      { key: 'Ctrl + Z', description: 'Undo' },
      { key: 'Ctrl + Y', description: 'Redo' },
      { key: 'Ctrl + S', description: 'Save' },
      { key: 'Ctrl + O', description: 'Load' },
      { key: 'Delete', description: 'Delete Selected Annotation' },
    ]},
    { category: 'Display', items: [
      { key: 'F11 / ⛶ Button', description: 'Fullscreen Mode' },
      { key: 'Tab', description: 'Focus Page Number Input' },
    ]},
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[80vh] overflow-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{APP_INFO.name} Help - Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-500 mt-1">
              Version {APP_INFO.version} • Build {APP_INFO.buildDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {shortcuts.map((category) => (
              <div key={category.category} className="space-y-3">
                <h3 className="text-lg font-medium text-blue-800 border-b border-blue-200 pb-1">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.items.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 flex-1">{shortcut.description}</span>
                      <kbd className="ml-4 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-800 whitespace-nowrap">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">💡 Stylus Pen Usage Tips</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• To prevent accidental operations while drawing with a stylus pen, navigation and zoom gestures require 3+ fingers</li>
                <li>• 2-finger pinch is disabled, use 4-finger pinch for zooming instead</li>
                <li>• Right-click to quickly switch between pen and eraser tools</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">📋 Application Information</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Tool Name:</span>
                  <span className="font-mono">{APP_INFO.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="font-mono">v{APP_INFO.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Build Date:</span>
                  <span className="font-mono">{APP_INFO.buildDate}</span>
                </div>
                <div className="pt-2 border-t border-gray-300 text-center">
                  <span className="text-xs text-gray-500">{APP_INFO.description}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};