// Comprehensive pen input detection and state management
class PenDetectionManager {
  private isPenActive: boolean = false;
  private lastPenEventTime: number = 0;
  private penCooldownDuration: number = 2000; // 2000ms cooldown after pen up (extended to prevent tool switching)

  // Track any active drawing tool to prevent tool switching
  private isAnyToolActive: boolean = false;
  private activeToolType: string | null = null;

  constructor() {
    // Listen for global pen events
    this.setupGlobalListeners();
  }

  private setupGlobalListeners() {
    // Listen for all pointer events globally
    const handleGlobalPointerEvent = (event: PointerEvent) => {
      if (event.pointerType === 'pen') {
        console.log('🖊️ Global pen event detected:', event.type);

        if (event.type === 'pointerdown') {
          this.setPenActive(true);
        } else if (event.type === 'pointerup' || event.type === 'pointerleave') {
          this.setPenActive(false);
        }
      }
    };

    // Add global listeners
    document.addEventListener('pointerdown', handleGlobalPointerEvent, { capture: true });
    document.addEventListener('pointerup', handleGlobalPointerEvent, { capture: true });
    document.addEventListener('pointerleave', handleGlobalPointerEvent, { capture: true });
    document.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'pen' && this.isPenActive) {
        this.lastPenEventTime = Date.now();
      }
    }, { capture: true });

    // Listen for touch events as fallback
    const handleTouchEvent = (event: TouchEvent) => {
      // Check for stylus-like touch events (single touch with pressure)
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch.force && touch.force > 0.3) {
          console.log('🖊️ Stylus-like touch detected with force:', touch.force);

          if (event.type === 'touchstart') {
            this.setPenActive(true);
          } else if (event.type === 'touchend') {
            this.setPenActive(false);
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchEvent, { capture: true });
    document.addEventListener('touchend', handleTouchEvent, { capture: true });
  }

  private setPenActive(active: boolean) {
    if (active) {
      this.isPenActive = true;
      this.lastPenEventTime = Date.now();
      console.log('🖊️ Pen is now ACTIVE');
    } else {
      // Set a longer cooldown period to prevent premature tool switching
      setTimeout(() => {
        this.isPenActive = false;
        console.log('🖊️ Pen is now INACTIVE');
      }, 300); // Extended delay to handle pen lifting and prevent immediate tool switches
    }
  }

  isPenCurrentlyActive(): boolean {
    // Check if pen is active or was recently active (within cooldown period)
    const timeSinceLastPenEvent = Date.now() - this.lastPenEventTime;
    const recentPenActivity = timeSinceLastPenEvent < this.penCooldownDuration;

    return this.isPenActive || recentPenActivity;
  }

  // Check if an event is from a pen/stylus
  isPenEvent(event: Event): boolean {
    // Check for PointerEvent with pen type
    if ('pointerType' in event && (event as PointerEvent).pointerType === 'pen') {
      console.log('✅ Confirmed pen event via pointerType');
      return true;
    }

    // Check native event
    const nativeEvent = (event as any).nativeEvent;
    if (nativeEvent && 'pointerType' in nativeEvent && nativeEvent.pointerType === 'pen') {
      console.log('✅ Confirmed pen event via nativeEvent.pointerType');
      return true;
    }

    // Check for TouchEvent with high pressure (stylus indicator)
    if (event.type.includes('touch')) {
      const touchEvent = event as TouchEvent;
      if (touchEvent.touches && touchEvent.touches.length === 1) {
        const touch = touchEvent.touches[0];
        if (touch.force && touch.force > 0.3) {
          console.log('✅ Confirmed stylus-like touch with force:', touch.force);
          return true;
        }
      }
    }

    return false;
  }

  // Set tool activity state
  setToolActive(toolType: string, active: boolean): void {
    if (active) {
      this.isAnyToolActive = true;
      this.activeToolType = toolType;
      console.log(`🔧 Tool "${toolType}" is now ACTIVE`);
    } else {
      setTimeout(() => {
        this.isAnyToolActive = false;
        this.activeToolType = null;
        console.log(`🔧 Tool "${toolType}" is now INACTIVE`);
      }, 500); // Cooldown to prevent immediate tool switches
    }
  }

  // Force reset all tool states immediately (for toolbar button clicks)
  forceResetAllTools(): void {
    this.isAnyToolActive = false;
    this.activeToolType = null;
    this.isPenActive = false;
    // CRITICAL: Reset lastPenEventTime to prevent cooldown period from blocking
    this.lastPenEventTime = 0;
    console.log('🔄 ALL tool states FORCE RESET (including pen event time)');
  }

  // Check if any drawing tool is currently active
  isAnyDrawingToolActive(): boolean {
    return this.isPenCurrentlyActive() || this.isAnyToolActive;
  }

  // Get currently active tool type
  getActiveToolType(): string | null {
    if (this.isPenCurrentlyActive()) return 'pen';
    return this.activeToolType;
  }

  // Should keyboard shortcuts be disabled?
  shouldDisableKeyboardShortcuts(): boolean {
    const anyToolActive = this.isAnyDrawingToolActive();
    if (anyToolActive) {
      console.log(`🚫 Keyboard shortcuts DISABLED due to ${this.getActiveToolType()} activity`);
    }
    return anyToolActive;
  }
}

// Export singleton instance
export const penDetection = new PenDetectionManager();

// Helper functions
export const isPenActive = () => penDetection.isPenCurrentlyActive();
export const isPenEvent = (event: Event) => penDetection.isPenEvent(event);
export const shouldDisableKeyboardShortcuts = () => penDetection.shouldDisableKeyboardShortcuts();
export const setToolActive = (toolType: string, active: boolean) => penDetection.setToolActive(toolType, active);
export const isAnyDrawingToolActive = () => penDetection.isAnyDrawingToolActive();
export const getActiveToolType = () => penDetection.getActiveToolType();
export const forceResetAllTools = () => penDetection.forceResetAllTools();