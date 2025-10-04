import React, { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx';

const PRESET_TIMES = [
  { label: '5分', minutes: 5 },
  { label: '15分', minutes: 15 },
  { label: '45分', minutes: 45 },
  { label: '90分', minutes: 90 },
  { label: '120分', minutes: 120 },
  { label: '150分', minutes: 150 },
  { label: '180分', minutes: 180 },
  { label: '240分', minutes: 240 },
];

interface StatusBarProps {
  className?: string;
  pdfFileName?: string;
  pdfFileSize?: string;
  currentPage?: number;
  totalPages?: number;
  windowLayout?: string;
  lastAutoSaveTime?: number;
  tabName?: string;
  zoomLevel?: number | string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  className,
  pdfFileName,
  pdfFileSize,
  currentPage,
  totalPages,
  windowLayout,
  lastAutoSaveTime,
  tabName,
  zoomLevel,
}) => {
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isTimerActive && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            showTimeUpNotification();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isTimerActive, remainingSeconds]);

  const showTimeUpNotification = useCallback(() => {
    // Show popup notification
    alert('⏰ タイマー終了！\n\n設定した時間が経過しました。');

    // Try to play sound if audio is supported
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Silently fail if audio can't be played
      });
    }
  }, []);

  const startTimer = useCallback((minutes: number) => {
    setRemainingSeconds(minutes * 60);
    setIsTimerActive(true);
    setShowPresets(false);
    setShowCustomInput(false);
  }, []);

  const stopTimer = useCallback(() => {
    setIsTimerActive(false);
    setRemainingSeconds(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const handleCustomTimer = useCallback(() => {
    const minutes = parseInt(customMinutes, 10);
    if (minutes > 0 && minutes <= 999) {
      startTimer(minutes);
      setCustomMinutes('');
    } else {
      alert('1〜999の数値を入力してください');
    }
  }, [customMinutes, startTimer]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className={clsx('flex items-center gap-4 px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm', className)}>
      {/* Timer display and controls */}
      <div className="flex items-center gap-2 relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPresets(!showPresets);
          }}
          className={clsx(
            "flex items-center gap-2 px-3 py-1 rounded transition-colors",
            isTimerActive
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-700 hover:bg-gray-600"
          )}
          title="タイマーを設定"
        >
          <span>⏱️</span>
          <span className="text-white min-w-[60px]">
            {remainingSeconds > 0 ? formatTime(remainingSeconds) : 'タイマー'}
          </span>
        </button>

        {remainingSeconds > 0 && (
          <button
            onClick={stopTimer}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-xs"
            title="タイマーを停止"
          >
            停止
          </button>
        )}

        {/* Preset time selection dropdown */}
        {showPresets && remainingSeconds === 0 && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-700 border border-gray-600 rounded-lg shadow-lg p-2 z-50">
            <div className="text-white text-xs font-semibold mb-2 px-2">時間を選択</div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              {PRESET_TIMES.map((preset) => (
                <button
                  key={preset.minutes}
                  onClick={() => startTimer(preset.minutes)}
                  className="px-3 py-2 bg-gray-600 hover:bg-blue-600 text-white rounded transition-colors text-left"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-600 pt-2">
              {showCustomInput ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCustomTimer();
                      }
                    }}
                    placeholder="分"
                    className="w-20 px-2 py-1 bg-gray-800 text-white rounded text-sm"
                    min="1"
                    max="999"
                    autoFocus
                  />
                  <button
                    onClick={handleCustomTimer}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomMinutes('');
                    }}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full px-3 py-2 bg-gray-600 hover:bg-blue-600 text-white rounded transition-colors text-left"
                >
                  カスタム...
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for notification sound */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBGF3w+3fmz8MEU6k5PGtYBwGN47Y88p5KwUnd8bw35FAChRet+vrrFYVCkanB"
        preload="auto"
      />

      {/* File information */}
      {pdfFileName && (
        <div className="flex items-center gap-4 text-xs">
          <span className="truncate max-w-xs">{pdfFileName}</span>
          {pdfFileSize && (
            <>
              <span className="text-gray-400">|</span>
              <span>{pdfFileSize}</span>
            </>
          )}
          {currentPage !== undefined && totalPages !== undefined && (
            <>
              <span className="text-gray-400">|</span>
              <span>Page {currentPage} of {totalPages}</span>
            </>
          )}
          {windowLayout && windowLayout !== 'single' && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-yellow-400">Layout: {windowLayout}</span>
            </>
          )}
          {lastAutoSaveTime && lastAutoSaveTime > 0 && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-green-400">
                Auto-saved: {new Date(lastAutoSaveTime).toLocaleTimeString()}
              </span>
            </>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tab and zoom info */}
      <div className="flex items-center gap-4 text-xs">
        {tabName && (
          <>
            <span>Tab: {tabName}</span>
            <span className="text-gray-400">|</span>
          </>
        )}
        {zoomLevel !== undefined && (
          <span>
            Zoom: {typeof zoomLevel === 'number' ? `${Math.round(zoomLevel * 100)}%` : zoomLevel}
          </span>
        )}
        <span className="text-gray-400">|</span>
        <span className="text-gray-400">PDFMark v1.0.3</span>
      </div>
    </div>
  );
};
