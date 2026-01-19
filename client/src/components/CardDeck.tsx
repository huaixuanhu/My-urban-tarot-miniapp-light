/**
 * CardDeck Component
 * Design Philosophy: Mystical Minimalism
 * 
 * Sidebar component displaying all 78 tarot cards organized by:
 * - Major Arcana (22 cards)
 * - Minor Arcana by suit (Wands, Cups, Swords, Disks - 14 cards each)
 * 
 * Cards can be dragged from here to the reading board.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { TarotDeck, TarotCard as TarotCardType } from '@/types/tarot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CardDeckProps {
  deck: TarotDeck;
  onDragStart: (card: TarotCardType) => void;
  onDragEnd: () => void;
}

interface SectionProps {
  title: string;
  subtitle?: string;
  color: string;
  cards: TarotCardType[];
  isOpen: boolean;
  onToggle: () => void;
  onDragStart: (card: TarotCardType) => void;
  onDragEnd: () => void;
}

function DeckSection({ 
  title, 
  subtitle, 
  color, 
  cards, 
  isOpen, 
  onToggle,
  onDragStart,
  onDragEnd,
}: SectionProps) {
  return (
    <div className="mb-2">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 hover:bg-white/5"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" style={{ color }} />
        </motion.div>
        <div className="flex-1 text-left">
          <h3 className="font-display text-sm font-medium" style={{ color }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-body" style={{ color: 'oklch(0.55 0.02 280)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <span 
          className="text-xs font-body px-2 py-0.5 rounded-full"
          style={{ 
            background: `${color}20`,
            color,
          }}
        >
          {cards.length}
        </span>
      </button>

      {/* Cards Grid */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2 p-2">
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.3 }}
                  draggable
                  onDragStart={() => onDragStart(card)}
                  onDragEnd={onDragEnd}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="aspect-[3/5] rounded-md flex flex-col items-center justify-center p-1 transition-all duration-300 hover:scale-105"
                    style={{
                      background: 'linear-gradient(145deg, oklch(0.18 0.02 280), oklch(0.12 0.02 280))',
                      border: `1px solid ${color}40`,
                      boxShadow: '0 2px 8px oklch(0 0 0 / 0.3)',
                    }}
                  >
                    <span 
                      className="font-mystical text-lg"
                      style={{ color }}
                    >
                      {card.number !== undefined ? (
                        card.number === 0 ? '0' : 
                        card.number <= 21 ? ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'][card.number - 1] || card.number :
                        card.number
                      ) : (
                        card.id.includes('ace') ? 'A' :
                        card.id.includes('knight') ? 'Kn' :
                        card.id.includes('queen') ? 'Q' :
                        card.id.includes('prince') ? 'Pr' :
                        card.id.includes('princess') ? 'Ps' :
                        card.id.match(/\d+/)?.[0] || '?'
                      )}
                    </span>
                    <span 
                      className="text-[8px] font-body text-center leading-tight mt-1 line-clamp-2"
                      style={{ color: 'oklch(0.70 0.02 280)' }}
                    >
                      {card.name.replace('of Wands', '').replace('of Cups', '').replace('of Swords', '').replace('of Disks', '').trim()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CardDeck({ deck, onDragStart, onDragEnd }: CardDeckProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['major']));

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const sections = [
    {
      id: 'major',
      title: 'Major Arcana',
      subtitle: "The Fool's Journey",
      color: '#c9a962',
      cards: deck.majorArcana,
    },
    {
      id: 'wands',
      title: 'Wands',
      subtitle: deck.minorArcana.wands.theme,
      color: deck.minorArcana.wands.color,
      cards: deck.minorArcana.wands.cards,
    },
    {
      id: 'cups',
      title: 'Cups',
      subtitle: deck.minorArcana.cups.theme,
      color: deck.minorArcana.cups.color,
      cards: deck.minorArcana.cups.cards,
    },
    {
      id: 'swords',
      title: 'Swords',
      subtitle: deck.minorArcana.swords.theme,
      color: deck.minorArcana.swords.color,
      cards: deck.minorArcana.swords.cards,
    },
    {
      id: 'disks',
      title: 'Disks',
      subtitle: deck.minorArcana.disks.theme,
      color: deck.minorArcana.disks.color,
      cards: deck.minorArcana.disks.cards,
    },
  ];

  return (
    <div 
      className="h-full flex flex-col"
      style={{
        background: 'linear-gradient(180deg, oklch(0.12 0.02 280), oklch(0.10 0.02 280))',
        borderRight: '1px solid oklch(0.25 0.02 280)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'oklch(0.25 0.02 280)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" style={{ color: '#c9a962' }} />
          <h2 className="font-display text-lg font-medium" style={{ color: '#c9a962' }}>
            {deck.deck.name}
          </h2>
        </div>
        <p className="text-xs font-body" style={{ color: 'oklch(0.55 0.02 280)' }}>
          by {deck.deck.creator}
        </p>
        <p className="text-[10px] font-body mt-2" style={{ color: 'oklch(0.45 0.02 280)' }}>
          Drag cards to the reading board
        </p>
      </div>

      {/* Scrollable Card Sections */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sections.map(section => (
            <DeckSection
              key={section.id}
              title={section.title}
              subtitle={section.subtitle}
              color={section.color}
              cards={section.cards}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div 
        className="p-3 border-t text-center"
        style={{ borderColor: 'oklch(0.25 0.02 280)' }}
      >
        <p className="text-[10px] font-body" style={{ color: 'oklch(0.45 0.02 280)' }}>
          {deck.deck.totalCards} cards • {deck.deck.year}
        </p>
      </div>
    </div>
  );
}

export default CardDeck;
