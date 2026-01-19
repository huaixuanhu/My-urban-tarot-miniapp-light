/**
 * Home Page - Urban Tarot Interactive Reading Board
 * Design Philosophy: TradingView Trading Tarot Style
 * 
 * Layout:
 * - Top area: Drawn cards display (reading area) - 75% height
 * - Bottom area: Scattered deck for drawing - 25% height
 * - Floating controls for shuffle/reset
 * 
 * Features:
 * - Drag cards from bottom to reading area
 * - 50% chance of reversed orientation
 * - Triple-click to reveal, single-click for details
 * - Sound effects for shuffle, draw, and flip actions
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Sparkles, Info, X, Trash2, ArrowUp } from 'lucide-react';
import { TarotProvider, useTarot } from '@/contexts/TarotContext';
import { TarotCard as TarotCardType, PlacedCard } from '@/types/tarot';
import { SpreadDeck } from '@/components/SpreadDeck';
import { TarotCard } from '@/components/TarotCard';
import { CardDetailModal } from '@/components/CardDetailModal';
import { Button } from '@/components/ui/button';
import { useSoundEffects } from '@/hooks/useSoundEffects';

function TarotBoard() {
  const { 
    placedCards, 
    drawnCardIds, 
    isShuffling,
    drawCard,
    moveCard,
    flipCard,
    bringToFront,
    removeCard,
    shuffleAndReset,
    clearBoard,
  } = useTarot();

  const { playShuffleSound, playDrawSound, playFlipSound } = useSoundEffects();

  const [selectedCard, setSelectedCard] = useState<TarotCardType | null>(null);
  const [selectedCardReversed, setSelectedCardReversed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [localShuffling, setLocalShuffling] = useState(false);
  const readingAreaRef = useRef<HTMLDivElement>(null);

  // Handle drawing a card from the spread deck (via drag)
  const handleDrawCard = useCallback((card: TarotCardType, x: number, y: number) => {
    playDrawSound();
    drawCard(card, x, y);
  }, [drawCard, playDrawSound]);

  // Handle shuffle and reset
  const handleShuffle = useCallback(() => {
    setLocalShuffling(true);
    playShuffleSound();
    shuffleAndReset();
    setTimeout(() => {
      setLocalShuffling(false);
    }, 2000);
  }, [shuffleAndReset, playShuffleSound]);

  // Handle clear board
  const handleClear = useCallback(() => {
    clearBoard();
  }, [clearBoard]);

  // Handle flipping a card with sound
  const handleFlipCard = useCallback((id: string) => {
    playFlipSound();
    flipCard(id);
  }, [flipCard, playFlipSound]);

  // Handle viewing card details
  const handleViewDetails = useCallback((card: TarotCardType, isReversed: boolean) => {
    setSelectedCard(card);
    setSelectedCardReversed(isReversed);
  }, []);

  return (
    <div 
      className="h-screen relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(180deg, oklch(0.10 0.02 280) 0%, oklch(0.06 0.02 280) 100%)',
      }}
    >
      {/* Background texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'url(/images/board-texture.webp)',
          backgroundSize: 'cover',
        }}
      />

      {/* Header - Fixed height */}
      <header className="relative z-20 px-6 py-3 flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" style={{ color: '#c9a962' }} />
          <div>
            <h1 className="font-display text-xl tracking-wide" style={{ color: '#c9a962' }}>
              Urban Tarot
            </h1>
            <p className="text-xs font-body" style={{ color: 'oklch(0.55 0.02 280)' }}>
              Interactive Reading Board
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Help button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHelp(true)}
            className="rounded-full"
            style={{ 
              color: 'oklch(0.65 0.02 280)',
              border: '1px solid oklch(0.25 0.02 280)',
            }}
          >
            <Info className="w-4 h-4" />
          </Button>

          {/* Shuffle button */}
          <Button
            variant="outline"
            onClick={handleShuffle}
            disabled={localShuffling || isShuffling}
            className="rounded-full gap-2 font-display"
            style={{ 
              background: 'oklch(0.12 0.02 280)',
              border: '1px solid oklch(0.75 0.12 85 / 0.4)',
              color: '#c9a962',
            }}
          >
            <Shuffle className={`w-4 h-4 ${(localShuffling || isShuffling) ? 'animate-spin' : ''}`} />
            Shuffle & Reset
          </Button>

          {/* Clear board button */}
          {placedCards.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="rounded-full gap-2 font-display"
              style={{ 
                background: 'oklch(0.12 0.02 280)',
                border: '1px solid oklch(0.35 0.08 25 / 0.5)',
                color: 'oklch(0.70 0.12 25)',
              }}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          )}

          <span className="text-xs font-body px-3 py-1 rounded-full" style={{ 
            background: 'oklch(0.12 0.02 280)',
            color: 'oklch(0.55 0.02 280)',
            border: '1px solid oklch(0.25 0.02 280)',
          }}>
            by Robin Scott
          </span>
        </div>
      </header>

      {/* Reading Area (Top 75% minus header) */}
      <div 
        ref={readingAreaRef} 
        className="relative z-10 px-4"
        style={{ height: 'calc(75vh - 56px)' }}
      >
        {/* Drop zone indicator */}
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: '2px dashed oklch(0.75 0.12 85 / 0.15)',
            margin: '0 16px',
          }}
        />

        {/* Drawn cards display */}
        <div className="relative w-full h-full">
          {/* Empty state */}
          {placedCards.length === 0 && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'oklch(0.12 0.02 280)',
                  border: '2px solid oklch(0.75 0.12 85 / 0.3)',
                }}
              >
                <Sparkles className="w-8 h-8" style={{ color: '#c9a962' }} />
              </div>
              <h2 className="font-display text-xl mb-2" style={{ color: '#c9a962' }}>
                Begin Your Reading
              </h2>
              <p className="font-body text-sm max-w-md text-center mb-3" style={{ color: 'oklch(0.55 0.02 280)' }}>
                Drag any card from below to this area. Triple-click to reveal its meaning.
              </p>
              <div className="flex items-center gap-2 text-xs font-body" style={{ color: 'oklch(0.45 0.02 280)' }}>
                <ArrowUp className="w-4 h-4 animate-bounce" />
                <span>Drop cards here</span>
              </div>
            </motion.div>
          )}

          {/* Drawn cards */}
          <AnimatePresence>
            {placedCards.map((placedCard: PlacedCard) => (
              <TarotCard
                key={placedCard.id}
                placedCard={placedCard}
                onFlip={handleFlipCard}
                onMove={moveCard}
                onBringToFront={bringToFront}
                onRemove={removeCard}
                onViewDetails={handleViewDetails}
                containerRef={readingAreaRef}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Spread Deck (Bottom 25%) */}
      <SpreadDeck
        drawnCardIds={drawnCardIds}
        onDrawCard={handleDrawCard}
        isShuffling={localShuffling || isShuffling}
        readingAreaRef={readingAreaRef}
        onShuffleSound={playShuffleSound}
      />

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isReversed={selectedCardReversed}
        isOpen={!!selectedCard}
        onClose={() => {
          setSelectedCard(null);
          setSelectedCardReversed(false);
        }}
      />

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ background: 'oklch(0 0 0 / 0.8)' }}
              onClick={() => setShowHelp(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-md rounded-2xl p-6"
              style={{
                background: 'oklch(0.12 0.02 280)',
                border: '1px solid oklch(0.75 0.12 85 / 0.3)',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'oklch(0.55 0.02 280)' }} />
              </button>

              <h3 className="font-display text-xl mb-4" style={{ color: '#c9a962' }}>
                How to Read
              </h3>

              <div className="space-y-4 font-body text-sm" style={{ color: 'oklch(0.75 0.02 280)' }}>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-display" style={{ background: 'oklch(0.75 0.12 85 / 0.2)', color: '#c9a962' }}>1</span>
                  <p><strong style={{ color: '#c9a962' }}>Drag to draw</strong> — Hold and drag any card from the bottom to the reading area above.</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-display" style={{ background: 'oklch(0.75 0.12 85 / 0.2)', color: '#c9a962' }}>2</span>
                  <p><strong style={{ color: '#c9a962' }}>Triple-click to reveal</strong> — Click three times quickly on a face-down card to flip it. Cards have 50% chance of being reversed!</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-display" style={{ background: 'oklch(0.75 0.12 85 / 0.2)', color: '#c9a962' }}>3</span>
                  <p><strong style={{ color: '#c9a962' }}>View meaning</strong> — Single-click a revealed card to see its full interpretation (upright or reversed).</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-display" style={{ background: 'oklch(0.75 0.12 85 / 0.2)', color: '#c9a962' }}>4</span>
                  <p><strong style={{ color: '#c9a962' }}>Arrange freely</strong> — Drag cards anywhere in the reading area to create your own spread.</p>
                </div>
              </div>

              <div className="mt-6 pt-4" style={{ borderTop: '1px solid oklch(0.25 0.02 280)' }}>
                <p className="text-xs" style={{ color: 'oklch(0.45 0.02 280)' }}>
                  Urban Tarot by Robin Scott — 78 cards of modern mysticism
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <TarotProvider>
      <TarotBoard />
    </TarotProvider>
  );
}
