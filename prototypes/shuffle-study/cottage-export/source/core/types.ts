import { MATH_BOARD } from './boardLayout.ts';
export type CharacterId = 'xuan' | 'mimi';
export type ZoneId = 'trading' | 'math' | 'tarot' | 'tasks' | 'words' | 'projectmap';
export type Point2 = { x: number; z: number };
export interface Zone { id: ZoneId; title: string; subtitle: string; icon: string; position: Point2; approach: Point2; color: string; }
export type CatId = 'black' | 'calico';
export type InteractionId = 'sofa-window' | 'sofa-room' | 'desk-trading' | 'desk-projectmap' | 'cat-black' | 'cat-calico';
export type ActivityKind = 'sofa' | 'desk' | 'pet';
export interface InteractionTarget {
  id: InteractionId; kind: ActivityKind; title: string; action: string;
  approach: Point2; anchor: Point2; heading: number; cat?: CatId; zone?: ZoneId;
}
export interface Activity {
  target: InteractionTarget;
  phase: 'approaching' | 'entering' | 'active' | 'leaving';
  progress: number; time: number;
}
export interface CatState { id: CatId; position: Point2; heading: number; walking: boolean; lookYaw?: number; pettedBy: CharacterId | null; }
export interface CharacterState { id: CharacterId; position: Point2; heading: number; walking: boolean; lookYaw?: number; activity: Activity | null; }
export interface RoomSnapshot {
  activeCharacter: CharacterId; characters: Record<CharacterId, CharacterState>;
  cats: Record<CatId, CatState>;
  nearby: ZoneId | null; nearbyInteractions: {id: InteractionId; occupiedBy: CharacterId | null}[];
  destination: Point2 | null;
}
export interface AppLink { id: string; title: string; description: string; url: string | null; }
export const ZONES: Zone[] = [
  { id:'trading', title:'萱咪 Trading 工作区', subtitle:'两块屏幕，一起探索市场', icon:'monitor', position:{x:-3.7,z:-1.7}, approach:{x:-2.0,z:-1.3}, color:'#ba774e' },
  { id:'math', title:'MathView', subtitle:'把抽象的想法，画成看得见的世界', icon:'sigma', position:MATH_BOARD.position, approach:MATH_BOARD.approach, color:'#658b83' },
  { id:'tarot', title:'Urban Tarot', subtitle:'留一点空间给直觉', icon:'sparkles', position:{x:1.6,z:0.55}, approach:{x:1.25,z:1.05}, color:'#9b7aab' },
  { id:'tasks', title:'mimi task board', subtitle:'把想一起做的事，慢慢变成日常', icon:'board', position:{x:-2.2,z:-2.45}, approach:{x:-1.0,z:-2.25}, color:'#b8964e' },
  { id:'words', title:'mimi 背单词', subtitle:'翻开一本书，认识一点新的世界', icon:'book', position:{x:0.25,z:-0.56}, approach:{x:-0.05,z:0.7}, color:'#b17c69' },
  { id:'projectmap', title:'ProjectMap', subtitle:'让项目之间的线索，慢慢连起来', icon:'map', position:{x:-4.29,z:-1.32}, approach:{x:-2.38,z:-1.62}, color:'#6e8c9c' },
];
