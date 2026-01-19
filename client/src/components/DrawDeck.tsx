/**
 * DrawDeck Component
 * Design Philosophy: Mystical Minimalism
 * 
 * Interactive card deck for drawing random cards with animations:
 * - Shuffle animation with card cascade effect
 * - Click to draw a random card
 * - Card flies from deck to reading board
 * - Visual feedback for remaining cards
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Shuffle, Sparkles, Hand } from 'lucide-react';
import { TarotCard as TarotCardType, TarotDeck } from '@/types/tarot';
import { cn } from '@/lib/utils';

interface DrawDeckProps {
  deck: TarotDeck;
  drawnCardIds: Set<string>;
  onDrawCard: (card: TarotCardType) => void;
  onShuffle: () => void;
  isShuffling: boolean;
}

export function DrawDeck({ 
  deck, 
  drawnCardIds, 
  onDrawCard, 
  onShuffle,
  isShuffling,
}: DrawDeckProps) {
  const [hovering, setHovering] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingCard, setDrawingCard] = useState<TarotCardType | null>(null);
  const controls = useAnimation();

  // Get all available cards (not yet drawn)
  const allCards = [
    ...deck.majorArcana,
    ...deck.minorArcana.wands.cards,
    ...deck.minorArcana.cups.cards,
    ...deck.minorArcana.swords.cards,
    ...deck.minorArcana.disks.cards,
  ];
  
  const availableCards = allCards.filter(card => !drawnCardIds.has(card.id));
  const remainingCount = availableCards.length;
  const totalCount = allCards.length;

  // Handle card draw with animation
  const handleDraw = useCallback(async () => {
    if (isShuffling || isDrawing || availableCards.length === 0) return;

    // Pick a random card
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const drawnCard = availableCards[randomIndex];
    
    setIsDrawing(true);
    setDrawingCard(drawnCard);

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 800));
    
    onDrawCard(drawnCard);
    setIsDrawing(false);
    setDrawingCard(null);
  }, [availableCards, isShuffling, isDrawing, onDrawCard]);

  // Shuffle animation sequence
  useEffect(() => {
    if (isShuffling) {
      controls.start({
        rotateZ: [0, -5, 5, -3, 3, 0],
        x: [0, -10, 10, -5, 5, 0],
        transition: {
          duration: 0.5,
          repeat: 2,
          ease: 'easeInOut',
        },
      });
    }
  }, [isShuffling, controls]);

  // Stack visual - show multiple cards stacked
  const stackLayers = Math.min(6, Math.ceil(remainingCount / 12));

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Deck Title */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-5 h-5" style={{ color: '#c9a962' }} />
          <h2 
            className="font-display text-xl font-medium"
            style={{ color: '#c9a962' }}
          >
            Urban Tarot
          </h2>
        </div>
        <p 
          className="text-xs font-body"
          style={{ color: 'oklch(0.55 0.02 280)' }}
        >
          by Robin Scott
        </p>
      </motion.div>

      {/* Card Stack */}
      <motion.div 
        className="relative cursor-pointer select-none"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={handleDraw}
        animate={controls}
      >
        {/* Glow effect behind deck */}
        <motion.div
          className="absolute -inset-8 rounded-3xl -z-10"
          style={{
            background: 'radial-gradient(circle, oklch(0.75 0.12 85 / 0.15), transparent 70%)',
          }}
          animate={{
            opacity: hovering ? 1 : 0.5,
            scale: hovering ? 1.1 : 1,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Stack layers */}
        {[...Array(stackLayers)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-36 h-56 rounded-xl"
            style={{
              backgroundImage: 'url(/images/card-back.webp)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid oklch(0.75 0.12 85 / 0.25)',
              boxShadow: '0 2px 8px oklch(0 0 0 / 0.3)',
              zIndex: stackLayers - i,
            }}
            initial={false}
            animate={{
              x: isShuffling 
                ? [0, (i % 2 === 0 ? 25 : -25), 0, (i % 2 === 0 ? -20 : 20), 0]
                : i * 2,
              y: isShuffling
                ? [0, -15, 8, -8, 0]
                : i * 2,
              rotate: isShuffling
                ? [0, (i % 2 === 0 ? 8 : -8), 0, (i % 2 === 0 ? -5 : 5), 0]
                : (i - stackLayers / 2) * 0.8,
              scale: hovering && !isShuffling && !isDrawing ? 1.01 : 1,
            }}
            transition={{
              duration: isShuffling ? 0.4 : 0.3,
              repeat: isShuffling ? 3 : 0,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Top card (interactive) */}
        <motion.div
          className="relative w-36 h-56 rounded-xl overflow-hidden"
          style={{
            backgroundImage: 'url(/images/card-back.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '1px solid oklch(0.75 0.12 85 / 0.4)',
            boxShadow: hovering && !isDrawing
              ? '0 12px 40px oklch(0 0 0 / 0.5), 0 0 50px oklch(0.75 0.12 85 / 0.25)'
              : '0 4px 15px oklch(0 0 0 / 0.4)',
            zIndex: stackLayers + 1,
          }}
          animate={{
            scale: hovering && !isShuffling && !isDrawing ? 1.05 : 1,
            y: hovering && !isShuffling && !isDrawing ? -8 : 0,
            rotateY: hovering && !isShuffling && !isDrawing ? 5 : 0,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, oklch(1 0 0 / 0.1) 50%, transparent 60%)',
            }}
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'easeInOut',
            }}
          />

          {/* Glow overlay on hover */}
          <AnimatePresence>
            {hovering && !isShuffling && !isDrawing && remainingCount > 0 && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at center, oklch(0.75 0.12 85 / 0.2), transparent)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>

          {/* Draw prompt */}
          <AnimatePresence>
            {hovering && !isShuffling && !isDrawing && remainingCount > 0 && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Hand className="w-8 h-8" style={{ color: '#c9a962' }} />
                </motion.div>
                <div 
                  className="px-4 py-2 rounded-full"
                  style={{
                    background: 'oklch(0.08 0.02 280 / 0.95)',
                    border: '1px solid oklch(0.75 0.12 85 / 0.4)',
                  }}
                >
                  <span className="text-sm font-display" style={{ color: '#c9a962' }}>
                    Draw a Card
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Drawing card animation */}
        <AnimatePresence>
          {isDrawing && drawingCard && (
            <motion.div
              className="absolute top-0 left-0 w-36 h-56 rounded-xl pointer-events-none"
              style={{
                backgroundImage: 'url(/images/card-back.webp)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '2px solid oklch(0.75 0.12 85 / 0.6)',
                boxShadow: '0 20px 60px oklch(0 0 0 / 0.7), 0 0 80px oklch(0.75 0.12 85 / 0.4)',
                zIndex: 100,
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotateY: 0 }}
              animate={{ 
                x: [0, 50, 300], 
                y: [0, -100, -50], 
                scale: [1, 1.1, 0.7], 
                opacity: [1, 1, 0],
                rotateY: [0, 15, 30],
                rotateZ: [0, 5, 15],
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.8, 
                ease: [0.4, 0, 0.2, 1],
                times: [0, 0.3, 1],
              }}
            />
          )}
        </AnimatePresence>

        {/* Empty deck state */}
        <AnimatePresence>
          {remainingCount === 0 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center rounded-xl"
              style={{
                background: 'oklch(0.10 0.02 280 / 0.95)',
                border: '2px dashed oklch(0.30 0.03 280)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center">
                <p className="text-sm font-display mb-1" style={{ color: 'oklch(0.50 0.02 280)' }}>
                  Deck Empty
                </p>
                <p className="text-xs font-body" style={{ color: 'oklch(0.40 0.02 280)' }}>
                  Shuffle to reset
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Card count with progress indicator */}
      <div className="text-center">
        <div 
          className="w-40 h-1.5 rounded-full mb-2 overflow-hidden"
          style={{ background: 'oklch(0.20 0.02 280)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #c9a962, oklch(0.75 0.15 85))' }}
            initial={false}
            animate={{ width: `${(remainingCount / totalCount) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p 
          className="text-sm font-body"
          style={{ color: 'oklch(0.65 0.02 280)' }}
        >
          <span style={{ color: '#c9a962' }}>{remainingCount}</span> / {totalCount} cards remaining
        </p>
      </div>

      {/* Shuffle button */}
      <motion.button
        onClick={onShuffle}
        disabled={isShuffling || isDrawing}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300",
          (isShuffling || isDrawing)
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white/10"
        )}
        style={{
          background: 'linear-gradient(135deg, oklch(0.16 0.02 280), oklch(0.12 0.02 280))',
          border: '1px solid oklch(0.35 0.03 280)',
          color: '#c9a962',
          boxShadow: '0 4px 15px oklch(0 0 0 / 0.3)',
        }}
        whileHover={!isShuffling && !isDrawing ? { scale: 1.05, y: -2 } : {}}
        whileTap={!isShuffling && !isDrawing ? { scale: 0.95 } : {}}
      >
        <motion.div
          animate={isShuffling ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0, ease: 'linear' }}
        >
          <Shuffle className="w-4 h-4" />
        </motion.div>
        <span className="text-sm font-display">
          {isShuffling ? 'Shuffling...' : 'Shuffle & Reset'}
        </span>
      </motion.button>

      {/* Instructions */}
      <motion.div 
        className="text-center px-5 py-4 rounded-xl max-w-[200px]"
        style={{
          background: 'linear-gradient(180deg, oklch(0.14 0.02 280 / 0.8), oklch(0.10 0.02 280 / 0.8))',
          border: '1px solid oklch(0.25 0.02 280)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: '#c9a962' }} />
          <span className="text-sm font-display" style={{ color: '#c9a962' }}>
            How to Read
          </span>
        </div>
        <ul className="space-y-2 text-[11px] font-body text-left" style={{ color: 'oklch(0.65 0.02 280)' }}>
          <li className="flex items-start gap-2">
            <span className="font-display" style={{ color: '#c9a962' }}>1.</span>
            <span>Click the deck to draw a random card</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-display" style={{ color: '#c9a962' }}>2.</span>
            <span>Triple-click a card to reveal it</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-display" style={{ color: '#c9a962' }}>3.</span>
            <span>Click revealed card for full meaning</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}

export default DrawDeck;
