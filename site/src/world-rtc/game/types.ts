// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/types.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import type { HousePosition } from './world/streetLayout';

export type CharacterId = 'dad' | 'penny' | 'luke';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  height: number;
  bodyColor: string;
  pantsColor: string;
  hairColor: string;
  skinTone: string;
  shoeColor: string;
}

export interface HouseConfig {
  address: string;
  position: HousePosition;
  width: number;
  depth: number;
  stories: 1 | 2;
  /** Front-facade brick veneer color (Avery Ranch norm). Falls back to stoneColor. */
  brickColor?: string;
  /** Upper/side/rear HardiPlank lap-siding color. Falls back to wallColor. */
  sidingColor?: string;
  wallColor: string;
  trimColor: string;
  hasStone: boolean;
  stoneColor: string;
  roofColor: string;
  doorColor: string;
  garageOnLeft: boolean;
  /** When true, render via HeroHouse10600 with full interior. */
  isHero?: boolean;
  /** Use a hipped roof instead of pure gable. */
  hipped?: boolean;
  sqft?: number;
  yearBuilt?: number;
  source?: 'verified' | 'partial' | 'inferred';
}

export type Vec2 = [number, number]; // (x, z) world coords

/** A property's outline as a closed polygon plus metadata about which edge faces the street. */
export interface Lot {
  address: string;
  /** CCW polygon vertices in world XZ. */
  polygon: Vec2[];
  /** Index of the polygon edge that faces the sidewalk (no fence here). */
  frontEdgeIndex: number;
  /** Where to place the house body (world XZ). */
  housePivot: Vec2;
  /** House yaw so its front faces the street. */
  houseYaw: number;
  /** Two world points (one per side fence) where gates go. */
  gateSlots: Vec2[];
  /** True for cul-de-sac wedge lots, false for straight rectangles. */
  isWedge: boolean;
}

/**
 * A blocker. Default is axis-aligned in XZ; if `yaw` is set, it's an oriented
 * bounding box (rect rotated by `yaw` radians around its center).
 * minY/maxY default to (0, 6).
 */
export interface RectCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  /** When true, players pass through (open door, gate). */
  passable?: boolean;
  /** Tag for debugging or selective interaction. */
  tag?: string;
  /** Yaw in radians. When nonzero, this is an OBB rotated around its center. */
  yaw?: number;
}

/** Tags for the door interaction system. */
export interface DoorState {
  id: string;
  open: boolean;
  /** Center of door in world XZ for proximity check. */
  center: Vec2;
  /** Radius for "press E" prompt. */
  promptRadius: number;
}

/**
 * A floor surface the player can stand on. Either a flat platform (baseY ===
 * topY) or a ramp (baseY at one end, topY at the other along `axis`). PlayerY
 * is snapped to floorAt(x, z) when not jumping.
 */
export interface Floor {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  topY: number;
  /** Direction the ramp climbs ('x' = climbs as x increases; 'z' similar). undefined for flat. */
  axis?: 'x' | 'z';
  /** When true, climbing direction is reversed (e.g. ramp climbs as x DECREASES). */
  invert?: boolean;
}
