/**
 * CardDetailModal Component
 * Design Philosophy: Mystical Minimalism
 * 
 * Modal overlay displaying detailed information about a revealed tarot card.
 * Triggered by single-clicking a face-up card on the reading board.
 * Features TradingView-style smooth animations and elegant transitions.
 * Supports both upright and reversed card interpretations.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, MapPin, Flame, Droplets, Wind, Mountain, RotateCcw } from 'lucide-react';
import { TarotCard } from '@/types/tarot';

interface CardDetailModalProps {
  card: TarotCard | null;
  isReversed?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function CardDetailModal({ card, isReversed = false, isOpen, onClose }: CardDetailModalProps) {
  if (!card) return null;

  // Get element icon and color
  const getElementInfo = () => {
    const id = card.id;
    if (id.startsWith('wands')) {
      return { icon: Flame, color: '#ff6b35', name: 'Fire', gradient: 'from-orange-500/20 to-red-500/10' };
    }
    if (id.startsWith('cups')) {
      return { icon: Droplets, color: '#4a90d9', name: 'Water', gradient: 'from-blue-500/20 to-cyan-500/10' };
    }
    if (id.startsWith('swords')) {
      return { icon: Wind, color: '#9b59b6', name: 'Air', gradient: 'from-purple-500/20 to-violet-500/10' };
    }
    if (id.startsWith('disks')) {
      return { icon: Mountain, color: '#27ae60', name: 'Earth', gradient: 'from-green-500/20 to-emerald-500/10' };
    }
    return { icon: Sparkles, color: '#c9a962', name: card.element || 'Spirit', gradient: 'from-amber-500/20 to-yellow-500/10' };
  };

  const elementInfo = getElementInfo();
  const ElementIcon = elementInfo.icon;

  // Get card number display
  const getCardNumber = () => {
    if (card.number !== undefined) {
      if (card.number === 0) return '0';
      if (card.number <= 21) {
        const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 
                               'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
        return romanNumerals[card.number];
      }
    }
    return null;
  };

  const cardNumber = getCardNumber();

  // Get interpretation based on orientation
  const getInterpretation = () => {
    if (isReversed && card.reversedInterpretation) {
      return card.reversedInterpretation;
    }
    if (isReversed) {
      // Generate a reversed interpretation hint if not provided
      return `${card.interpretation} (Reversed: Consider the shadow aspects, blockages, or delays related to this card's energy.)`;
    }
    return card.interpretation;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop with blur */}
          <motion.div
            className="absolute inset-0 backdrop-blur-md"
            style={{ background: 'oklch(0.05 0.02 280 / 0.9)' }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, oklch(0.12 0.02 280) 0%, oklch(0.08 0.02 280) 100%)',
              border: isReversed 
                ? '1px solid oklch(0.50 0.15 25 / 0.5)' 
                : '1px solid oklch(0.75 0.12 85 / 0.3)',
              boxShadow: isReversed
                ? '0 25px 80px oklch(0 0 0 / 0.6), 0 0 60px oklch(0.50 0.15 25 / 0.15)'
                : '0 25px 80px oklch(0 0 0 / 0.6), 0 0 60px oklch(0.75 0.12 85 / 0.1)',
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ 
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          >
            {/* Close button */}
            <motion.button
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'oklch(0.15 0.02 280)',
                border: '1px solid oklch(0.30 0.02 280)',
              }}
              onClick={onClose}
              whileHover={{ scale: 1.1, background: 'oklch(0.20 0.02 280)' }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5" style={{ color: 'oklch(0.65 0.02 280)' }} />
            </motion.button>

            {/* Content grid */}
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Card image section */}
              <div className="relative w-full md:w-2/5 p-6 md:p-8 flex items-center justify-center">
                {/* Background glow */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${isReversed ? 'from-red-500/20 to-orange-500/10' : elementInfo.gradient} opacity-50`}
                />
                
                {/* Card image with frame */}
                <motion.div
                  className="relative"
                  initial={{ rotateY: -15, scale: 0.8 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  style={{ perspective: '1000px' }}
                >
                  <div
                    className="relative w-48 md:w-56 rounded-xl overflow-hidden"
                    style={{
                      aspectRatio: '2/3',
                      boxShadow: isReversed
                        ? `0 20px 60px oklch(0 0 0 / 0.5), 0 0 40px oklch(0.50 0.15 25 / 0.3)`
                        : `0 20px 60px oklch(0 0 0 / 0.5), 0 0 40px ${elementInfo.color}30`,
                      border: isReversed
                        ? '3px solid oklch(0.50 0.15 25 / 0.6)'
                        : '3px solid oklch(0.75 0.12 85 / 0.5)',
                    }}
                  >
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      style={{
                        transform: isReversed ? 'rotate(180deg)' : 'none',
                      }}
                    />
                    
                    {/* Shimmer overlay */}
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
                  </div>

                  {/* Card number badge */}
                  {cardNumber && (
                    <motion.div
                      className="absolute -top-3 -left-3 w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: 'oklch(0.10 0.02 280)',
                        border: '2px solid oklch(0.75 0.12 85 / 0.6)',
                        boxShadow: '0 4px 15px oklch(0 0 0 / 0.4)',
                      }}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.3, type: 'spring' }}
                    >
                      <span className="font-display text-sm" style={{ color: '#c9a962' }}>
                        {cardNumber}
                      </span>
                    </motion.div>
                  )}

                  {/* Reversed badge */}
                  {isReversed && (
                    <motion.div
                      className="absolute -top-3 -right-3 w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: 'oklch(0.25 0.15 25)',
                        border: '2px solid oklch(0.50 0.15 25)',
                        boxShadow: '0 4px 15px oklch(0 0 0 / 0.4)',
                      }}
                      initial={{ scale: 0, rotate: 180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.4, type: 'spring' }}
                    >
                      <RotateCcw className="w-5 h-5" style={{ color: '#f5e6d3' }} />
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Text content section */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {/* Element and orientation badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div 
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                      style={{
                        background: `${elementInfo.color}20`,
                        border: `1px solid ${elementInfo.color}40`,
                      }}
                    >
                      <ElementIcon className="w-3.5 h-3.5" style={{ color: elementInfo.color }} />
                      <span className="text-xs font-body" style={{ color: elementInfo.color }}>
                        {elementInfo.name}
                      </span>
                    </div>
                    
                    {card.id.startsWith('major') && (
                      <span 
                        className="text-xs font-body px-2 py-1 rounded-full"
                        style={{
                          background: 'oklch(0.75 0.12 85 / 0.15)',
                          color: '#c9a962',
                        }}
                      >
                        Major Arcana
                      </span>
                    )}

                    {isReversed && (
                      <span 
                        className="text-xs font-body px-2 py-1 rounded-full flex items-center gap-1"
                        style={{
                          background: 'oklch(0.35 0.15 25 / 0.3)',
                          color: '#f5a962',
                          border: '1px solid oklch(0.50 0.15 25 / 0.5)',
                        }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reversed
                      </span>
                    )}
                  </div>

                  {/* Card name */}
                  <h2 
                    className="font-display text-3xl md:text-4xl mb-2 tracking-wide"
                    style={{ color: isReversed ? '#f5a962' : '#c9a962' }}
                  >
                    {card.name}
                    {isReversed && <span className="text-xl ml-2 opacity-70">(Reversed)</span>}
                  </h2>

                  {/* Theme */}
                  <p 
                    className="font-body text-lg mb-6"
                    style={{ color: 'oklch(0.70 0.02 280)' }}
                  >
                    {card.theme}
                  </p>
                </motion.div>

                {/* Divider */}
                <motion.div
                  className="h-px mb-6"
                  style={{ 
                    background: isReversed
                      ? 'linear-gradient(to right, oklch(0.50 0.15 25 / 0.5), transparent)'
                      : 'linear-gradient(to right, oklch(0.75 0.12 85 / 0.4), transparent)' 
                  }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                />

                {/* Interpretation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-6"
                >
                  <h3 
                    className="font-display text-sm uppercase tracking-widest mb-3 flex items-center gap-2"
                    style={{ color: isReversed ? '#f5a962' : '#c9a962' }}
                  >
                    {isReversed ? <RotateCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {isReversed ? 'Reversed Interpretation' : 'Interpretation'}
                  </h3>
                  <p 
                    className="font-body text-base leading-relaxed"
                    style={{ color: 'oklch(0.80 0.01 280)' }}
                  >
                    {getInterpretation()}
                  </p>
                </motion.div>

                {/* Urban Imagery */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 
                    className="font-display text-sm uppercase tracking-widest mb-3 flex items-center gap-2"
                    style={{ color: '#c9a962' }}
                  >
                    <MapPin className="w-4 h-4" />
                    Urban Imagery
                  </h3>
                  <p 
                    className="font-body text-base leading-relaxed"
                    style={{ color: 'oklch(0.70 0.02 280)' }}
                  >
                    {card.urbanImagery}
                  </p>
                </motion.div>

                {/* Footer attribution */}
                <motion.div
                  className="mt-8 pt-4"
                  style={{ borderTop: '1px solid oklch(0.20 0.02 280)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <p 
                    className="text-xs font-body"
                    style={{ color: 'oklch(0.45 0.02 280)' }}
                  >
                    Urban Tarot by Robin Scott • U.S. Games Systems, Inc.
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CardDetailModal;
