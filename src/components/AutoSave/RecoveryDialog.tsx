import React, { useState } from 'react';
import { AutoSaveEntry, RecoveryDialogData } from '../../types';

interface RecoveryDialogProps {
  isOpen: boolean;
  recoveryData: RecoveryDialogData | null;
  availableAutoSaves: AutoSaveEntry[];
  onRecover: (autoSaveEntry: AutoSaveEntry) => void;
  onSkip: () => void;
  onClose: () => void;
}

export const RecoveryDialog: React.FC<RecoveryDialogProps> = ({
  isOpen,
  recoveryData,
  availableAutoSaves,
  onRecover,
  onSkip,
  onClose
}) => {
  const [selectedAutoSave, setSelectedAutoSave] = useState<AutoSaveEntry | null>(
    recoveryData?.autoSaveEntry || (availableAutoSaves.length > 0 ? availableAutoSaves[0] : null)
  );

  if (!isOpen || !recoveryData) return null;

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeDifference = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  };

  const handleRecover = () => {
    if (selectedAutoSave) {
      onRecover(selectedAutoSave);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Auto-save Recovery</h2>
              <p className="text-sm text-gray-600">We found unsaved work for this PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              We found auto-saved annotations for "{recoveryData.autoSaveEntry.fileName}".
              Would you like to restore your previous work?
            </p>

            {/* Current vs Auto-save comparison */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Comparison</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Current annotations:</span>
                  <span className="ml-2 font-medium">{recoveryData.currentAnnotationCount}</span>
                </div>
                <div>
                  <span className="text-gray-600">Auto-saved annotations:</span>
                  <span className="ml-2 font-medium">{selectedAutoSave?.annotationCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Auto-save selection */}
            {availableAutoSaves.length > 1 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Available Auto-saves</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableAutoSaves.map((autoSave) => (
                    <div
                      key={autoSave.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAutoSave?.id === autoSave.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedAutoSave(autoSave)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={selectedAutoSave?.id === autoSave.id}
                            onChange={() => setSelectedAutoSave(autoSave)}
                            className="text-blue-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatTimestamp(autoSave.timestamp)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatTimeDifference(Date.now() - autoSave.timestamp)} • {autoSave.annotationCount} annotations
                            </p>
                          </div>
                        </div>
                        {selectedAutoSave?.id === autoSave.id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected auto-save details */}
            {selectedAutoSave && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Selected Auto-save Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-700">Saved:</span>
                    <span className="ml-2 text-blue-900">{formatTimestamp(selectedAutoSave.timestamp)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Annotations:</span>
                    <span className="ml-2 text-blue-900">{selectedAutoSave.annotationCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Tabs:</span>
                    <span className="ml-2 text-blue-900">{selectedAutoSave.tabs.length}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Age:</span>
                    <span className="ml-2 text-blue-900">{formatTimeDifference(Date.now() - selectedAutoSave.timestamp)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warning if current has more annotations */}
          {recoveryData.currentAnnotationCount > (selectedAutoSave?.annotationCount || 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Warning</p>
                  <p className="text-sm text-yellow-700">
                    You currently have more annotations ({recoveryData.currentAnnotationCount}) than the auto-save ({selectedAutoSave?.annotationCount || 0}).
                    Restoring will replace your current work.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Skip Recovery
          </button>
          <button
            onClick={handleRecover}
            disabled={!selectedAutoSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Restore Auto-save
          </button>
        </div>
      </div>
    </div>
  );
};