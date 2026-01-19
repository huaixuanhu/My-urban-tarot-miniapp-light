/**
 * SpreadDeck Component
 * Design Philosophy: TradingView Trading Tarot Style
 * 
 * Cards spread horizontally across the bottom of the screen
 * with random scatter effect (not a neat fan arrangement).
 * 
 * Features:
 * - Cards displayed face-down in a scattered horizontal layout
 * - Random rotation and position offsets for natural feel
 * - DRAG to draw cards (hold left mouse button and drag to reading area)
 * - Silky smooth shuffle animation simulating real-world card shuffling
 * - Cards stack on each other then spread out gracefully
 * - Smooth animations using Framer Motion
 * - Mobile-optimized: reduced animation complexity on touch devices
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { TarotCard as TarotCardType } from '@/types/tarot';
import { useTarot } from '@/contexts/TarotContext';

interface SpreadDeckProps {
  drawnCardIds: Set<string>;
  onDrawCard: (card: TarotCardType, x: number, y: number) => void;
  isShuffling: boolean;
  readingAreaRef: React.RefObject<HTMLDivElement | null>;
  onShuffleSound?: () => void;
}

interface CardPosition {
  card: TarotCardType;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  shuffleDelay: number;
}

// Card dimensions in spread deck - LARGER SIZE
const DECK_CARD_WIDTH = 80;
const DECK_CARD_HEIGHT = 128;

// Detect mobile device
const isMobile = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768
);

// Easing functions as tuples for Framer Motion
const easeOutQuad: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
const easeOutCubic: [number, number, number, number] = [0.33, 1, 0.68, 1];
const easeOutBack: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

export function SpreadDeck({ 
  drawnCardIds, 
  onDrawCard,
  isShuffling,
  readingAreaRef,
  onShuffleSound,
}: SpreadDeckProps) {
  const { allCards } = useTarot();
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [shufflePhase, setShufflePhase] = useState<'idle' | 'gather' | 'stack' | 'riffle1' | 'riffle2' | 'spread'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter available cards (not yet drawn)
  const availableCards = useMemo(() => 
    allCards.filter(card => !drawnCardIds.has(card.id)),
    [allCards, drawnCardIds]
  );

  // Handle shuffle animation phases - simplified for mobile
  useEffect(() => {
    if (isShuffling) {
      onShuffleSound?.();
      
      if (isMobile) {
        // Simplified mobile animation: just gather and spread
        setShufflePhase('gather');
        setTimeout(() => setShufflePhase('stack'), 300);
        setTimeout(() => setShufflePhase('spread'), 700);
        setTimeout(() => setShufflePhase('idle'), 1200);
      } else {
        // Full desktop animation
        setShufflePhase('gather');
        setTimeout(() => setShufflePhase('stack'), 350);
        setTimeout(() => setShufflePhase('riffle1'), 700);
        setTimeout(() => setShufflePhase('riffle2'), 1100);
        setTimeout(() => setShufflePhase('spread'), 1500);
        setTimeout(() => setShufflePhase('idle'), 2000);
      }
    }
  }, [isShuffling, onShuffleSound]);

  // Generate scattered positions for cards - optimized for mobile
  const cardPositions = useMemo((): CardPosition[] => {
    const positions: CardPosition[] = [];
    const cardCount = availableCards.length;
    
    if (cardCount === 0) return positions;

    // Calculate spread width based on card count
    const spreadWidth = Math.min(cardCount * 1.6, 92);
    const startX = (100 - spreadWidth) / 2;
    
    // On mobile, reduce random offsets for better performance
    const scatterMultiplier = isMobile ? 0.5 : 1;
    
    availableCards.forEach((card, index) => {
      const baseX = startX + (spreadWidth / cardCount) * index;
      
      // Reduced scatter on mobile
      const randomXOffset = (Math.random() - 0.5) * 2.5 * scatterMultiplier;
      const randomYOffset = (Math.random() - 0.5) * 25 * scatterMultiplier;
      const randomRotation = (Math.random() - 0.5) * 14 * scatterMultiplier;
      
      positions.push({
        card,
        x: baseX + randomXOffset,
        y: randomYOffset,
        rotation: randomRotation,
        zIndex: Math.floor(Math.random() * cardCount),
        shuffleDelay: (index / cardCount) * 0.3,
      });
    });

    return positions;
  }, [availableCards]);

  // Handle drag start
  const handleDragStart = useCallback((cardId: string) => {
    if (isShuffling) return;
    setDraggingCardId(cardId);
  }, [isShuffling]);

  // Handle drag end - check if dropped in reading area
  const handleDragEnd = useCallback((
    card: TarotCardType, 
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setDraggingCardId(null);
    
    if (!readingAreaRef.current) return;
    
    const readingAreaRect = readingAreaRef.current.getBoundingClientRect();
    const dropX = info.point.x;
    const dropY = info.point.y;
    
    if (
      dropX >= readingAreaRect.left &&
      dropX <= readingAreaRect.right &&
      dropY >= readingAreaRect.top &&
      dropY <= readingAreaRect.bottom
    ) {
      const relativeX = dropX - readingAreaRect.left;
      const relativeY = dropY - readingAreaRect.top;
      onDrawCard(card, relativeX - 70, relativeY - 112);
    }
  }, [readingAreaRef, onDrawCard]);

  // Get animation variants based on shuffle phase - optimized for mobile
  const getShuffleAnimation = (position: CardPosition, index: number) => {
    const { rotation, shuffleDelay } = position;
    const totalCards = cardPositions.length;
    const normalizedIndex = index / totalCards;
    
    // Simplified animations for mobile
    if (isMobile) {
      switch (shufflePhase) {
        case 'gather':
        case 'stack':
          return {
            x: 0,
            y: -10,
            rotate: 0,
            scale: 0.95,
            opacity: 1,
            transition: {
              duration: 0.3,
              delay: normalizedIndex * 0.05,
              ease: easeOutQuad,
            },
          };
        
        case 'spread':
          return {
            x: 0,
            y: 0,
            rotate: rotation,
            scale: 1,
            opacity: 1,
            transition: {
              duration: 0.4,
              delay: normalizedIndex * 0.1,
              ease: easeOutCubic,
            },
          };
        
        default:
          return {
            opacity: 1,
            scale: draggingCardId === position.card.id ? 1.15 : 1,
            y: 0,
            rotate: draggingCardId === position.card.id ? 0 : rotation,
            transition: { 
              duration: 0.2, 
              ease: easeOutCubic,
            },
          };
      }
    }
    
    // Full animations for desktop
    switch (shufflePhase) {
      case 'gather':
        return {
          x: 0,
          y: -10,
          rotate: rotation * 0.3,
          scale: 0.95,
          opacity: 1,
          transition: {
            duration: 0.35,
            delay: shuffleDelay * 0.5,
            ease: easeOutQuad,
          },
        };
      
      case 'stack':
        const stackOffset = (index - totalCards / 2) * 0.15;
        return {
          x: stackOffset,
          y: -15 + (index * 0.3),
          rotate: 0,
          scale: 0.92,
          opacity: 1,
          zIndex: index,
          transition: {
            duration: 0.3,
            delay: normalizedIndex * 0.08,
            ease: easeOutCubic,
          },
        };
      
      case 'riffle1':
        const isLeftGroup = index % 2 === 0;
        const riffleOffset1 = isLeftGroup ? -40 : 40;
        const riffleY1 = -30 + Math.sin(normalizedIndex * Math.PI) * 20;
        return {
          x: riffleOffset1 + (index - totalCards / 2) * 0.8,
          y: riffleY1,
          rotate: isLeftGroup ? -8 : 8,
          scale: 0.94,
          opacity: 1,
          zIndex: isLeftGroup ? index : totalCards - index,
          transition: {
            duration: 0.35,
            delay: normalizedIndex * 0.015,
            ease: easeOutBack,
          },
        };
      
      case 'riffle2':
        const cascadeDelay = Math.abs(normalizedIndex - 0.5) * 0.2;
        const cascadeY = -20 + Math.sin(normalizedIndex * Math.PI * 2) * 15;
        return {
          x: (index - totalCards / 2) * 0.5,
          y: cascadeY,
          rotate: (Math.random() - 0.5) * 6,
          scale: 0.96,
          opacity: 1,
          zIndex: Math.floor(Math.random() * totalCards),
          transition: {
            duration: 0.35,
            delay: cascadeDelay,
            ease: easeOutQuad,
          },
        };
      
      case 'spread':
        const waveDelay = normalizedIndex * 0.25;
        return {
          x: 0,
          y: 0,
          rotate: rotation,
          scale: 1,
          opacity: 1,
          transition: {
            duration: 0.45,
            delay: waveDelay,
            ease: easeOutCubic,
          },
        };
      
      default:
        return {
          opacity: 1,
          scale: draggingCardId === position.card.id ? 1.2 : (hoveredCardId === position.card.id ? 1.15 : 1),
          y: hoveredCardId === position.card.id ? -20 : 0,
          rotate: draggingCardId === position.card.id ? 0 : (hoveredCardId === position.card.id ? 0 : rotation),
          transition: { 
            duration: 0.3, 
            ease: easeOutCubic,
          },
        };
    }
  };

  return (
    <div ref={containerRef} className="absolute bottom-0 left-0 right-0 h-[25vh] overflow-visible">
      {/* Gradient overlay at top for smooth transition */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to bottom, oklch(0.08 0.02 280), transparent)',
        }}
      />

      {/* Shuffle glow effect - simplified for mobile */}
      <AnimatePresence>
        {shufflePhase !== 'idle' && !isMobile && (
          <motion.div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 h-64 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, oklch(0.75 0.12 85 / 0.35), transparent 70%)',
              filter: 'blur(40px)',
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: [0, 1, 1, 0.8, 1, 0],
              scale: [0.5, 1.2, 1.4, 1.3, 1.5, 0.5],
            }}
            transition={{ 
              duration: 2,
              times: [0, 0.15, 0.35, 0.55, 0.75, 1],
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>

      {/* Card spread container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Ambient glow effect - hidden on mobile for performance */}
        {!isMobile && (
          <div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-24 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, oklch(0.75 0.12 85 / 0.15), transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
        )}

        {/* Cards */}
        <AnimatePresence mode="popLayout">
          {cardPositions.map((position, index) => {
            const { card, x, y, rotation, zIndex } = position;
            
            return (
              <motion.div
                key={card.id}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                  left: `${x}%`,
                  bottom: `${40 + y}px`,
                  zIndex: draggingCardId === card.id ? 200 : (hoveredCardId === card.id ? 100 : zIndex),
                  touchAction: 'none',
                  // Use GPU acceleration
                  willChange: shufflePhase !== 'idle' ? 'transform' : 'auto',
                }}
                drag={shufflePhase === 'idle'}
                dragMomentum={false}
                dragElastic={0.1}
                onDragStart={() => handleDragStart(card.id)}
                onDragEnd={(e, info) => handleDragEnd(card, e, info)}
                initial={{ 
                  opacity: 0, 
                  scale: 0.5, 
                  y: 100,
                  rotate: rotation,
                }}
                animate={getShuffleAnimation(position, index)}
                exit={{ 
                  opacity: 0, 
                  scale: 0.5, 
                  y: -200,
                  transition: { duration: 0.3 },
                }}
                onMouseEnter={() => !isMobile && !draggingCardId && shufflePhase === 'idle' && setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                whileDrag={{
                  scale: isMobile ? 1.1 : 1.2,
                  rotate: 0,
                  zIndex: 300,
                }}
              >
                {/* Card back */}
                <div
                  className="relative rounded-lg overflow-hidden"
                  style={{
                    backgroundImage: 'url(/images/card-back.webp)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: draggingCardId === card.id
                      ? '2px solid oklch(0.85 0.15 85 / 0.9)'
                      : hoveredCardId === card.id 
                      ? '2px solid oklch(0.75 0.12 85 / 0.8)'
                      : '1px solid oklch(0.75 0.12 85 / 0.3)',
                    boxShadow: draggingCardId === card.id
                      ? '0 20px 50px oklch(0 0 0 / 0.6), 0 0 40px oklch(0.75 0.12 85 / 0.4)'
                      : hoveredCardId === card.id
                      ? '0 15px 40px oklch(0 0 0 / 0.5), 0 0 25px oklch(0.75 0.12 85 / 0.3)'
                      : '0 4px 15px oklch(0 0 0 / 0.4)',
                    transform: 'translateX(-50%)',
                    width: `${DECK_CARD_WIDTH}px`,
                    height: `${DECK_CARD_HEIGHT}px`,
                  }}
                >
                  {/* Hover glow overlay - desktop only */}
                  {!isMobile && (hoveredCardId === card.id || draggingCardId === card.id) && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'radial-gradient(circle at center, oklch(0.85 0.15 85 / 0.2), transparent 70%)',
                      }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Instruction hint */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-xs text-white/40 tracking-wide">
          {shufflePhase !== 'idle' ? '洗牌中...' : '拖拽卡牌到上方区域抽牌'}
        </p>
      </div>
    </div>
  );
}
