/**
 * Urban Tarot Type Definitions
 * Design Philosophy: Mystical Minimalism
 */

export interface TarotCard {
  id: string;
  name: string;
  number?: number;
  title?: string | null;
  theme: string;
  interpretation: string;
  reversedInterpretation?: string;
  urbanImagery: string;
  element?: string;
  image: string;
}

export interface MajorArcanaCard extends TarotCard {
  number: number;
  element: string;
}

export interface MinorArcanaCard extends TarotCard {
  title: string | null;
}

export interface Suit {
  element: string;
  symbol: string;
  color: string;
  theme: string;
  cards: MinorArcanaCard[];
}

export interface MinorArcana {
  wands: Suit;
  cups: Suit;
  swords: Suit;
  disks: Suit;
}

export interface DeckInfo {
  name: string;
  creator: string;
  publisher: string;
  year: number;
  description: string;
  totalCards: number;
}

export interface TarotDeck {
  deck: DeckInfo;
  majorArcana: MajorArcanaCard[];
  minorArcana: MinorArcana;
}

// Card state on the board
export type CardFace = 'down' | 'up';

// Card orientation (upright or reversed)
export type CardOrientation = 'upright' | 'reversed';

export interface PlacedCard {
  id: string;
  cardData: TarotCard;
  x: number;
  y: number;
  face: CardFace;
  orientation: CardOrientation;
  zIndex: number;
  rotation?: number;
}

// Drag and drop types
export interface DragItem {
  type: 'card';
  card: TarotCard;
  sourceType: 'deck' | 'board';
  sourceId?: string;
}
