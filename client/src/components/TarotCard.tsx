/**
 * TarotCard Component
 * Design Philosophy: Mystical Minimalism
 * 
 * Renders a tarot card with three states:
 * 1. In Deck - compact view for sidebar
 * 2. Face Down - card back showing on board
 * 3. Face Up - card front showing on board (upright or reversed)
 * 
 * Features:
 * - Triple-click to flip (when face down)
 * - Single-click to view details (when face up)
 * - Smooth 3D flip animation with Framer Motion
 * - 50% chance of reversed orientation when revealed
 * - Stable draggable on board (position-based, not offset-based)
 * - Mobile-optimized: reduced animations and lazy loading
 */

import { useState, useRef, useEffect, memo } from 'react';
import { motion, PanInfo, useDragControls } from 'framer-motion';
import { TarotCard as TarotCardType, PlacedCard } from '@/types/tarot';
import { useTripleClick } from '@/hooks/useTripleClick';
import { X } from 'lucide-react';

interface TarotCardProps {
  placedCard: PlacedCard;
  onFlip: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onBringToFront: (id: string) => void;
  onRemove: (id: string) => void;
  onViewDetails: (card: TarotCardType, isReversed: boolean) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

// Card dimensions - LARGER SIZE
const CARD_WIDTH = 140;
const CARD_HEIGHT = 224;

// Detect mobile device
const isMobile = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768
);

function TarotCardComponent({
  placedCard,
  onFlip,
  onMove,
  onBringToFront,
  onRemove,
  onViewDetails,
  containerRef,
}: TarotCardProps) {
  const { id, cardData, x, y, face, orientation, zIndex, rotation = 0 } = placedCard;
  const isFaceUp = face === 'up';
  const isReversed = orientation === 'reversed';
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x, y });
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Sync position with props when they change externally
  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  // Triple-click handler for flipping cards
  const handleClick = useTripleClick({
    timeWindow: 500,
    onTripleClick: () => {
      if (!isFaceUp && !isDragging) {
        onFlip(id);
      }
    },
    onSingleClick: () => {
      if (isFaceUp && !isDragging) {
        onViewDetails(cardData, isReversed);
      }
    },
  });

  // Handle drag - update position in real-time
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = position.x + info.delta.x;
    const newY = position.y + info.delta.y;
    setPosition({ x: newX, y: newY });
  };

  // Handle drag end - commit the final position
  const handleDragEnd = () => {
    setIsDragging(false);
    onMove(id, position.x, position.y);
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
    onBringToFront(id);
  };

  return (
    <motion.div
      ref={cardRef}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 1000 : zIndex,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        touchAction: 'none',
        // GPU acceleration hint
        willChange: isDragging ? 'transform' : 'auto',
      }}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragListener={true}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: 1, 
        scale: isDragging ? 1.08 : 1, 
        rotate: isDragging ? 0 : rotation,
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ 
        type: 'spring', 
        stiffness: isMobile ? 300 : 400, 
        damping: isMobile ? 25 : 30,
        opacity: { duration: 0.2 },
      }}
      whileHover={isMobile ? undefined : { scale: 1.03 }}
    >
      {/* Remove button */}
      {isHovered && !isDragging && !isMobile && (
        <motion.button
          className="absolute -top-3 -right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: 'oklch(0.35 0.12 25)',
            border: '1px solid oklch(0.50 0.15 25)',
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
        >
          <X className="w-4 h-4" style={{ color: 'oklch(0.95 0 0)' }} />
        </motion.button>
      )}

      {/* Card container with 3D flip */}
      <div
        className="relative w-full h-full"
        style={{
          perspective: isMobile ? '800px' : '1200px',
          transformStyle: 'preserve-3d',
        }}
        onClick={handleClick}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
          }}
          animate={{
            rotateY: isFaceUp ? 180 : 0,
          }}
          transition={{
            duration: isMobile ? 0.6 : 0.8,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          {/* Card Back */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              backgroundImage: 'url(/images/card-back.webp)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid oklch(0.75 0.12 85 / 0.4)',
              boxShadow: isDragging 
                ? '0 25px 60px oklch(0 0 0 / 0.6), 0 0 40px oklch(0.75 0.12 85 / 0.25)'
                : '0 8px 30px oklch(0 0 0 / 0.4)',
            }}
          >
            {/* Triple-click hint - desktop only */}
            {!isMobile && isHovered && !isFaceUp && !isDragging && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'oklch(0 0 0 / 0.5)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="text-sm font-display text-center px-3" style={{ color: '#c9a962' }}>
                  Triple-click<br/>to reveal
                </span>
              </motion.div>
            )}
          </div>

          {/* Card Front */}
          <div
            className="absolute inset-0 rounded-xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'oklch(0.95 0.01 85)',
              border: '2px solid oklch(0.75 0.12 85 / 0.6)',
              boxShadow: isDragging 
                ? '0 25px 60px oklch(0 0 0 / 0.6), 0 0 40px oklch(0.75 0.12 85 / 0.35)'
                : '0 8px 30px oklch(0 0 0 / 0.4)',
            }}
          >
            {/* Card image - with lazy loading */}
            <img
              src={cardData.image}
              alt={cardData.name}
              className="w-full h-full object-cover"
              style={{
                transform: isReversed ? 'rotate(180deg)' : 'none',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
              draggable={false}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
            
            {/* Loading placeholder */}
            {!imageLoaded && (
              <div 
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'oklch(0.90 0.01 85)' }}
              >
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#c9a962', borderTopColor: 'transparent' }} />
              </div>
            )}
            
            {/* Card name overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 p-3"
              style={{
                background: 'linear-gradient(to top, oklch(0.08 0.02 280 / 0.95), transparent)',
              }}
            >
              <p 
                className="text-sm font-display text-center truncate"
                style={{ color: '#c9a962' }}
              >
                {cardData.name}
                {isReversed && ' (Reversed)'}
              </p>
            </div>

            {/* Reversed indicator */}
            {isReversed && (
              <div
                className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-display"
                style={{
                  background: 'oklch(0.35 0.15 25 / 0.9)',
                  color: '#f5e6d3',
                  border: '1px solid oklch(0.50 0.15 25)',
                }}
              >
                ↺ Reversed
              </div>
            )}

            {/* Click hint - desktop only */}
            {!isMobile && isHovered && isFaceUp && !isDragging && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ background: 'oklch(0 0 0 / 0.3)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="text-sm font-display px-3 py-2 rounded" style={{ 
                  color: '#c9a962',
                  background: 'oklch(0.08 0.02 280 / 0.9)',
                }}>
                  Click for details
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const TarotCard = memo(TarotCardComponent);

export default TarotCard;
