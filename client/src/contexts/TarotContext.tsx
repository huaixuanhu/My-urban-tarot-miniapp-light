/**
 * TarotContext - State Management for Urban Tarot
 * Design Philosophy: Mystical Minimalism
 * 
 * Manages the state of cards on the board, including:
 * - Deck data loading
 * - Drawn cards tracking
 * - Card positions and face states
 * - Card orientation (upright/reversed with 50% probability)
 * - Z-index layering
 * - Shuffle and reset functionality
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { TarotCard, TarotDeck, PlacedCard, CardOrientation } from '@/types/tarot';
import { nanoid } from 'nanoid';
import tarotData from '@/data/tarotData.json';

interface TarotContextType {
  // Data
  deck: TarotDeck | null;
  allCards: TarotCard[];
  
  // State
  placedCards: PlacedCard[];
  drawnCardIds: Set<string>;
  maxZIndex: number;
  isShuffling: boolean;
  
  // Actions
  drawCard: (card: TarotCard, x: number, y: number) => string;
  placeCard: (card: TarotCard, x: number, y: number) => string;
  moveCard: (id: string, x: number, y: number) => void;
  flipCard: (id: string) => void;
  bringToFront: (id: string) => void;
  removeCard: (id: string) => void;
  clearBoard: () => void;
  shuffleAndReset: () => void;
  getCard: (id: string) => PlacedCard | undefined;
}

const TarotContext = createContext<TarotContextType | null>(null);

// Helper function to determine orientation with 50% probability
const getRandomOrientation = (): CardOrientation => {
  return Math.random() < 0.5 ? 'upright' : 'reversed';
};

export function TarotProvider({ children }: { children: React.ReactNode }) {
  const [deck, setDeck] = useState<TarotDeck | null>(null);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [drawnCardIds, setDrawnCardIds] = useState<Set<string>>(new Set());
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [isShuffling, setIsShuffling] = useState(false);

  // Load deck data
  useEffect(() => {
    setDeck(tarotData as TarotDeck);
  }, []);

  // Get all cards from deck
  const allCards = useMemo(() => {
    if (!deck) return [];
    return [
      ...deck.majorArcana,
      ...deck.minorArcana.wands.cards,
      ...deck.minorArcana.cups.cards,
      ...deck.minorArcana.swords.cards,
      ...deck.minorArcana.disks.cards,
    ];
  }, [deck]);

  // Draw a card and place it on the board (for random draw feature)
  const drawCard = useCallback((card: TarotCard, x: number, y: number): string => {
    const id = nanoid();
    
    // Mark card as drawn
    setDrawnCardIds(prev => {
      const newSet = new Set(prev);
      newSet.add(card.id);
      return newSet;
    });
    
    const newCard: PlacedCard = {
      id,
      cardData: card,
      x,
      y,
      face: 'down',
      orientation: getRandomOrientation(), // 50% chance reversed
      zIndex: maxZIndex + 1,
      rotation: Math.random() * 6 - 3,
    };
    
    setPlacedCards(prev => [...prev, newCard]);
    setMaxZIndex(prev => prev + 1);
    
    return id;
  }, [maxZIndex]);

  // Place a new card on the board (face down by default) - for drag-drop
  const placeCard = useCallback((card: TarotCard, x: number, y: number): string => {
    // Check if already drawn
    if (drawnCardIds.has(card.id)) {
      return '';
    }
    
    const id = nanoid();
    
    // Mark card as drawn
    setDrawnCardIds(prev => {
      const newSet = new Set(prev);
      newSet.add(card.id);
      return newSet;
    });
    
    const newCard: PlacedCard = {
      id,
      cardData: card,
      x,
      y,
      face: 'down',
      orientation: getRandomOrientation(), // 50% chance reversed
      zIndex: maxZIndex + 1,
      rotation: Math.random() * 6 - 3,
    };
    
    setPlacedCards(prev => [...prev, newCard]);
    setMaxZIndex(prev => prev + 1);
    
    return id;
  }, [maxZIndex, drawnCardIds]);

  // Move an existing card to a new position
  const moveCard = useCallback((id: string, x: number, y: number) => {
    setPlacedCards(prev => 
      prev.map(card => 
        card.id === id 
          ? { ...card, x, y, zIndex: maxZIndex + 1 }
          : card
      )
    );
    setMaxZIndex(prev => prev + 1);
  }, [maxZIndex]);

  // Flip a card (toggle face state)
  const flipCard = useCallback((id: string) => {
    setPlacedCards(prev =>
      prev.map(card =>
        card.id === id
          ? { ...card, face: card.face === 'down' ? 'up' : 'down' }
          : card
      )
    );
  }, []);

  // Bring a card to the front (highest z-index)
  const bringToFront = useCallback((id: string) => {
    setPlacedCards(prev =>
      prev.map(card =>
        card.id === id
          ? { ...card, zIndex: maxZIndex + 1 }
          : card
      )
    );
    setMaxZIndex(prev => prev + 1);
  }, [maxZIndex]);

  // Remove a card from the board
  const removeCard = useCallback((id: string) => {
    setPlacedCards(prev => {
      const card = prev.find(c => c.id === id);
      if (card) {
        // Also remove from drawn cards
        setDrawnCardIds(prevDrawn => {
          const newDrawn = new Set(prevDrawn);
          newDrawn.delete(card.cardData.id);
          return newDrawn;
        });
      }
      return prev.filter(c => c.id !== id);
    });
  }, []);

  // Clear all cards from the board
  const clearBoard = useCallback(() => {
    setPlacedCards([]);
    setDrawnCardIds(new Set());
    setMaxZIndex(1);
  }, []);

  // Shuffle and reset the deck with animation
  const shuffleAndReset = useCallback(() => {
    setIsShuffling(true);
    
    // Clear board after shuffle animation
    setTimeout(() => {
      setPlacedCards([]);
      setDrawnCardIds(new Set());
      setMaxZIndex(1);
      setIsShuffling(false);
    }, 2000); // Extended for smoother animation
  }, []);

  // Get a specific card by ID
  const getCard = useCallback((id: string) => {
    return placedCards.find(card => card.id === id);
  }, [placedCards]);

  const value = useMemo(() => ({
    deck,
    allCards,
    placedCards,
    drawnCardIds,
    maxZIndex,
    isShuffling,
    drawCard,
    placeCard,
    moveCard,
    flipCard,
    bringToFront,
    removeCard,
    clearBoard,
    shuffleAndReset,
    getCard,
  }), [
    deck,
    allCards,
    placedCards, 
    drawnCardIds, 
    maxZIndex, 
    isShuffling,
    drawCard,
    placeCard, 
    moveCard, 
    flipCard, 
    bringToFront, 
    removeCard, 
    clearBoard, 
    shuffleAndReset,
    getCard
  ]);

  return (
    <TarotContext.Provider value={value}>
      {children}
    </TarotContext.Provider>
  );
}

export function useTarot() {
  const context = useContext(TarotContext);
  if (!context) {
    throw new Error('useTarot must be used within a TarotProvider');
  }
  return context;
}

export default TarotContext;
