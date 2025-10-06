import React, { useState, useCallback } from 'react';
import { Tab } from '../../types';
import clsx from 'clsx';

interface TabManagerProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabAdd: () => void;
  onTabRemove: (tabId: string) => void;
  onTabRename: (tabId: string, newName: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  onFileSelect?: (tabId: string) => void;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabAdd,
  onTabRemove,
  onTabRename,
  onTabReorder,
  onFileSelect: _onFileSelect,
}) => {
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  const handleStartEdit = useCallback((tab: Tab) => {
    setEditingTab(tab.id);
    setEditName(tab.name);
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (editingTab && editName.trim()) {
      onTabRename(editingTab, editName.trim());
    }
    setEditingTab(null);
    setEditName('');
  }, [editingTab, editName, onTabRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditingTab(null);
      setEditName('');
    }
  }, [handleFinishEdit]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedTabIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTabIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTabIndex !== null && draggedTabIndex !== index && onTabReorder) {
      onTabReorder(draggedTabIndex, index);
    }
    setDraggedTabIndex(null);
    setDragOverTabIndex(null);
  }, [draggedTabIndex, onTabReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedTabIndex(null);
    setDragOverTabIndex(null);
  }, []);

  return (
    <div className="flex items-center bg-tab-bg border-b border-gray-700 h-tabs overflow-x-auto">
      <div className="flex items-center">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable={editingTab !== tab.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={clsx('tab-item relative group', {
              active: tab.id === activeTabId,
              'opacity-50': draggedTabIndex === index,
              'border-l-2 border-blue-500': dragOverTabIndex === index && draggedTabIndex !== index,
              'cursor-move': editingTab !== tab.id,
              'cursor-default': editingTab === tab.id,
            })}
            onClick={() => onTabChange(tab.id)}
            title={editingTab !== tab.id ? 'Drag to reorder tabs' : undefined}
          >
            {editingTab === tab.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div
                  className="flex items-center gap-2 overflow-hidden"
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  onDoubleClick={() => handleStartEdit(tab)}
                >
                  <span className="text-sm text-white whitespace-nowrap">
                    {tab.currentPage}
                  </span>
                  <span className="text-sm text-gray-400">-</span>
                  <div className="overflow-hidden max-w-[150px]">
                    <span
                      className={clsx(
                        "text-sm text-white whitespace-nowrap inline-block",
                        hoveredTab === tab.id && "animate-scroll"
                      )}
                    >
                      {tab.name}
                    </span>
                  </div>
                </div>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabRemove(tab.id);
                    }}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        
        {tabs.length < 10 && (
          <button
            onClick={onTabAdd}
            className="px-4 py-2 hover:bg-gray-600 transition-colors"
            title="Add new tab (Max 10)"
          >
            +
          </button>
        )}
      </div>
      
      <div className="ml-auto px-4 text-xs text-gray-400">
        {tabs.length}/10 tabs
      </div>
    </div>
  );
};