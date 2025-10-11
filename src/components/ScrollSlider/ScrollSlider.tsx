import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ScrollSliderProps {
  containerRef: React.RefObject<HTMLDivElement>;
  orientation: 'vertical' | 'horizontal';
  show: boolean;
  renderTrigger?: number; // CRITICAL: Trigger recalculation when PDF renders
}

export const ScrollSlider: React.FC<ScrollSliderProps> = ({
  containerRef,
  orientation,
  show,
  renderTrigger = 0
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [thumbSize, setThumbSize] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Update scroll ratio and thumb size when container scrolls or resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScrollState = () => {
      if (orientation === 'vertical') {
        const maxScroll = container.scrollHeight - container.clientHeight;
        const hasScroll = maxScroll > 0;
        setCanScroll(hasScroll);

        if (hasScroll) {
          setScrollRatio(container.scrollTop / maxScroll);
          // Thumb size proportional to visible area
          const visibleRatio = container.clientHeight / container.scrollHeight;
          setThumbSize(Math.max(visibleRatio, 0.1)); // Minimum 10% of track
        }
      } else {
        const maxScroll = container.scrollWidth - container.clientWidth;
        const hasScroll = maxScroll > 0;
        setCanScroll(hasScroll);

        if (hasScroll) {
          setScrollRatio(container.scrollLeft / maxScroll);
          // Thumb size proportional to visible area
          const visibleRatio = container.clientWidth / container.scrollWidth;
          setThumbSize(Math.max(visibleRatio, 0.1)); // Minimum 10% of track
        }
      }
    };

    container.addEventListener('scroll', updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);
    updateScrollState(); // Initial update

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [containerRef, orientation]);

  // CRITICAL: Recalculate when PDF content is rendered
  // This is triggered by renderTrigger changing (PDF render complete signal)
  useEffect(() => {
    if (!show || !containerRef.current) return;

    const container = containerRef.current;
    const updateScrollState = () => {
      if (orientation === 'vertical') {
        const maxScroll = container.scrollHeight - container.clientHeight;
        const hasScroll = maxScroll > 0;
        setCanScroll(hasScroll);

        if (hasScroll) {
          setScrollRatio(container.scrollTop / maxScroll);
          const visibleRatio = container.clientHeight / container.scrollHeight;
          setThumbSize(Math.max(visibleRatio, 0.1));
        } else {
          // Even if not scrollable, set default values
          setScrollRatio(0);
          setThumbSize(0.5);
        }
      } else {
        const maxScroll = container.scrollWidth - container.clientWidth;
        const hasScroll = maxScroll > 0;
        setCanScroll(hasScroll);

        if (hasScroll) {
          setScrollRatio(container.scrollLeft / maxScroll);
          const visibleRatio = container.clientWidth / container.scrollWidth;
          setThumbSize(Math.max(visibleRatio, 0.1));
        } else {
          // Even if not scrollable, set default values
          setScrollRatio(0);
          setThumbSize(0.5);
        }
      }
    };

    // CRITICAL FIX: Use requestAnimationFrame to ensure DOM is updated
    // After PDF renders, we need to wait one frame for layout to complete
    requestAnimationFrame(() => {
      updateScrollState();
    });
  }, [show, renderTrigger, containerRef, orientation]); // renderTrigger dependency is CRITICAL!

  // Handle slider drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sliderRef.current || !containerRef.current) return;

    const slider = sliderRef.current;
    const container = containerRef.current;
    const rect = slider.getBoundingClientRect();

    if (orientation === 'vertical') {
      const relativeY = e.clientY - rect.top;
      const trackHeight = rect.height;
      const thumbHeight = trackHeight * thumbSize;
      const availableTrack = trackHeight - thumbHeight;
      const ratio = Math.max(0, Math.min(1, relativeY / availableTrack));
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTop = ratio * maxScroll;
    } else {
      const relativeX = e.clientX - rect.left;
      const trackWidth = rect.width;
      const thumbWidth = trackWidth * thumbSize;
      const availableTrack = trackWidth - thumbWidth;
      const ratio = Math.max(0, Math.min(1, relativeX / availableTrack));
      const maxScroll = container.scrollWidth - container.clientWidth;
      container.scrollLeft = ratio * maxScroll;
    }
  }, [isDragging, containerRef, orientation, thumbSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !sliderRef.current || !containerRef.current) return;

    const slider = sliderRef.current;
    const container = containerRef.current;
    const rect = slider.getBoundingClientRect();
    const touch = e.touches[0];

    if (orientation === 'vertical') {
      const relativeY = touch.clientY - rect.top;
      const trackHeight = rect.height;
      const thumbHeight = trackHeight * thumbSize;
      const availableTrack = trackHeight - thumbHeight;
      const ratio = Math.max(0, Math.min(1, relativeY / availableTrack));
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTop = ratio * maxScroll;
    } else {
      const relativeX = touch.clientX - rect.left;
      const trackWidth = rect.width;
      const thumbWidth = trackWidth * thumbSize;
      const availableTrack = trackWidth - thumbWidth;
      const ratio = Math.max(0, Math.min(1, relativeX / availableTrack));
      const maxScroll = container.scrollWidth - container.clientWidth;
      container.scrollLeft = ratio * maxScroll;
    }
  }, [isDragging, containerRef, orientation, thumbSize]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse/touch event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Only show scrollbar if enabled AND content is scrollable
  if (!show || !canScroll) {
    return null;
  }

  const isVertical = orientation === 'vertical';
  const trackWidth = 42; // 28px * 1.5 = 42px

  return (
    <div
      ref={sliderRef}
      className={`absolute z-50 ${
        isVertical
          ? `right-0 top-0 bottom-0 h-full`
          : `left-0 right-0 bottom-0 w-full`
      }`}
      style={{
        width: isVertical ? `${trackWidth}px` : undefined,
        height: !isVertical ? `${trackWidth}px` : undefined,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto'
      }}
      onMouseDown={(e) => {
        // Click on track to jump
        if (e.target === sliderRef.current) {
          const rect = sliderRef.current.getBoundingClientRect();
          const container = containerRef.current;
          if (!container) return;

          if (isVertical) {
            const relativeY = e.clientY - rect.top;
            const trackHeight = rect.height;
            const thumbHeight = trackHeight * thumbSize;
            const availableTrack = trackHeight - thumbHeight;
            const ratio = Math.max(0, Math.min(1, relativeY / availableTrack));
            const maxScroll = container.scrollHeight - container.clientHeight;
            container.scrollTop = ratio * maxScroll;
          } else {
            const relativeX = e.clientX - rect.left;
            const trackWidth = rect.width;
            const thumbWidth = trackWidth * thumbSize;
            const availableTrack = trackWidth - thumbWidth;
            const ratio = Math.max(0, Math.min(1, relativeX / availableTrack));
            const maxScroll = container.scrollWidth - container.clientWidth;
            container.scrollLeft = ratio * maxScroll;
          }
        }
      }}
    >
      {/* Slider thumb */}
      <div
        ref={thumbRef}
        className={`absolute bg-blue-500 hover:bg-blue-400 active:bg-blue-600 cursor-pointer transition-colors ${
          isDragging ? 'bg-blue-600' : ''
        }`}
        style={{
          ...(isVertical
            ? {
                width: '30px',
                height: `${thumbSize * 100}%`,
                left: '50%',
                transform: `translateX(-50%)`,
                top: `${scrollRatio * (100 - thumbSize * 100)}%`,
                borderRadius: '15px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }
            : {
                height: '30px',
                width: `${thumbSize * 100}%`,
                top: '50%',
                transform: `translateY(-50%)`,
                left: `${scrollRatio * (100 - thumbSize * 100)}%`,
                borderRadius: '15px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              })
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
};
