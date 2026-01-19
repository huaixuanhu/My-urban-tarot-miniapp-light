/**
 * useTripleClick Hook
 * Design Philosophy: Mystical Minimalism
 * 
 * Custom hook to detect triple-click events within a specified time window.
 * Used for the "Triple-Click Reveal" mechanic in the tarot reading experience.
 */

import { useCallback, useRef } from 'react';

interface UseTripleClickOptions {
  /** Time window in milliseconds for detecting triple clicks (default: 500ms) */
  timeWindow?: number;
  /** Callback function when triple click is detected */
  onTripleClick: () => void;
  /** Optional callback for single click */
  onSingleClick?: () => void;
}

export function useTripleClick({
  timeWindow = 500,
  onTripleClick,
  onSingleClick,
}: UseTripleClickOptions) {
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const singleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    // Clear any pending single click timeout
    if (singleClickTimeoutRef.current) {
      clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = null;
    }

    // Reset click count if too much time has passed
    if (timeSinceLastClick > timeWindow) {
      clickCountRef.current = 0;
    }

    clickCountRef.current += 1;
    lastClickTimeRef.current = now;

    if (clickCountRef.current === 3) {
      // Triple click detected!
      clickCountRef.current = 0;
      onTripleClick();
    } else if (clickCountRef.current === 1 && onSingleClick) {
      // Set a timeout for single click
      // This allows us to differentiate between single click and start of triple click
      singleClickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          onSingleClick();
          clickCountRef.current = 0;
        }
      }, timeWindow);
    }
  }, [timeWindow, onTripleClick, onSingleClick]);

  return handleClick;
}

export default useTripleClick;
