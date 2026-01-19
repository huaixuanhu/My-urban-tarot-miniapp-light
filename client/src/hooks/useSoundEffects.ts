/**
 * useSoundEffects Hook
 * Manages audio playback for tarot card interactions
 * 
 * Sound effects:
 * - shuffle: Played during card shuffling animation
 * - draw: Played when a card is drawn from the deck
 * - flip: Played when a card is flipped to reveal its face
 */

import { useCallback, useRef, useEffect } from 'react';

interface SoundEffects {
  playShuffleSound: () => void;
  playDrawSound: () => void;
  playFlipSound: () => void;
}

// Audio file paths
const SOUND_PATHS = {
  shuffle: '/sounds/shuffle.mp3',
  draw: '/sounds/draw.mp3',
  flip: '/sounds/flip.mp3',
} as const;

export function useSoundEffects(): SoundEffects {
  const shuffleAudioRef = useRef<HTMLAudioElement | null>(null);
  const drawAudioRef = useRef<HTMLAudioElement | null>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    shuffleAudioRef.current = new Audio(SOUND_PATHS.shuffle);
    drawAudioRef.current = new Audio(SOUND_PATHS.draw);
    flipAudioRef.current = new Audio(SOUND_PATHS.flip);

    // Set volume levels (subtle, not overpowering)
    if (shuffleAudioRef.current) shuffleAudioRef.current.volume = 0.4;
    if (drawAudioRef.current) drawAudioRef.current.volume = 0.35;
    if (flipAudioRef.current) flipAudioRef.current.volume = 0.35;

    // Preload audio files
    shuffleAudioRef.current?.load();
    drawAudioRef.current?.load();
    flipAudioRef.current?.load();

    return () => {
      // Cleanup
      shuffleAudioRef.current = null;
      drawAudioRef.current = null;
      flipAudioRef.current = null;
    };
  }, []);

  // Play shuffle sound
  const playShuffleSound = useCallback(() => {
    if (shuffleAudioRef.current) {
      shuffleAudioRef.current.currentTime = 0;
      shuffleAudioRef.current.play().catch(() => {
        // Ignore autoplay errors (user interaction required)
      });
    }
  }, []);

  // Play draw sound
  const playDrawSound = useCallback(() => {
    if (drawAudioRef.current) {
      drawAudioRef.current.currentTime = 0;
      drawAudioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, []);

  // Play flip sound
  const playFlipSound = useCallback(() => {
    if (flipAudioRef.current) {
      flipAudioRef.current.currentTime = 0;
      flipAudioRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, []);

  return {
    playShuffleSound,
    playDrawSound,
    playFlipSound,
  };
}

export default useSoundEffects;
