// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/houses.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import type { HouseConfig } from '../types';
import { straightZ } from './streetLayout';

// Royal Tara Cove, Avery Ranch West Ph 01 (Williamson County, Austin TX 78717).
// Real roster of 25 homes (10600-10649), built by D.R. Horton ~2004-2010.
// Sourced from Williamson CAD parcels, MLS listings (Compass/Redfin/HAR), and
// the 2008 tour video of 10600 (recon 2026-05-30; see docs/superpowers/specs).
//
// The neighborhood look: BRICK veneer on the street-facing front, tan HardiPlank
// LAP SIDING on sides/rear, composition-shingle (grayish) roofs, slab
// foundations, front-facing 2-car garages, open front lawns (no front fence).
//
// `source`: 'verified' = confirmed by a listing/CAD record; 'partial' = some
// fields confirmed; 'inferred' = neighborhood-norm default.

// Lighter, warmer Avery Ranch brick tones — the old set read as dark maroon,
// especially on shadowed front walls. These are noticeably lighter + varied.
const BRICK = {
  redBrown: '#cd967a',
  rust: '#d6a182',
  umber: '#c6957a',
  clay: '#d29d7e',
  mocha: '#ca9474',
  buff: '#ddb999',
} as const;

const SIDING = {
  tan: '#d8c9a8',
  cream: '#e3d7bc',
  sand: '#d0c1a0',
  warmGray: '#cbc3b0',
  beige: '#ddd0b4',
} as const;

const ROOF = {
  gray: '#736f67',
  slate: '#67635c',
  graphite: '#7a766f',
  ash: '#827d74',
} as const;

const TRIM = '#f0e8d6';
const DOOR = {
  brown: '#4a3623',
  black: '#1f1f1f',
  burgundy: '#5a2828',
  forest: '#2d4a2d',
  navy: '#26303f',
} as const;

// Straight section: odd side (east) has 11 homes, even side (west) has 10.
// Address increases NORTHWARD (toward Avery Ranch Blvd); slot 0 sits nearest the
// bulb. Per-house z jitter (±~0.4 m) breaks the laser-line setback.
const ODD_N = 11;
const EVEN_N = 10;
const oddSlot = (i: number) => straightZ((i + 0.5) / ODD_N);
const evenSlot = (i: number) => straightZ((i + 0.5) / EVEN_N);

export const HOUSES: HouseConfig[] = [
  // ---- Cul-de-sac bulb: 10600, 10601, 10604, 10605 (large pie lots) ----
  {
    address: '10605',
    position: { kind: 'bulb', angleDeg: 0 },
    width: 13, depth: 12, stories: 1,
    brickColor: BRICK.buff, sidingColor: SIDING.cream, roofColor: ROOF.gray, doorColor: DOOR.brown,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.buff,
    garageOnLeft: false, sqft: 1697, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10601',
    position: { kind: 'bulb', angleDeg: 40 },
    width: 13.5, depth: 10, stories: 2,
    brickColor: BRICK.rust, sidingColor: SIDING.tan, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.tan, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: true, sqft: 2311, yearBuilt: 2004, source: 'verified',
  },
  {
    // The hero house — Zak's family home, on the bulb at the end of the cul-de-sac.
    // radiusOffset sets it deeper in its (apex) lot so the widened body doesn't
    // crowd the flanking neighbors.
    address: '10600',
    position: { kind: 'bulb', angleDeg: 90, radiusOffset: 6 },
    width: 24, depth: 18, stories: 2,
    // The real 10600: tan/beige brick + cream siding (per the family memory spec).
    // garageOnLeft: true -> garage on the viewer's RIGHT (-X), front door + oak on
    // the LEFT (+X), matching the real house.
    brickColor: BRICK.buff, sidingColor: SIDING.cream, roofColor: ROOF.gray, doorColor: DOOR.brown,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.buff,
    garageOnLeft: true, isHero: true, hipped: true, sqft: 2129, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10604',
    position: { kind: 'bulb', angleDeg: 146 },
    width: 13.5, depth: 10, stories: 2,
    brickColor: BRICK.clay, sidingColor: SIDING.sand, roofColor: ROOF.graphite, doorColor: DOOR.black,
    wallColor: SIDING.sand, trimColor: TRIM, hasStone: false, stoneColor: BRICK.clay,
    garageOnLeft: true, sqft: 2488, yearBuilt: 2004, source: 'partial',
  },

  // ---- Odd side / EAST (11 homes: 10609..10649) ----
  {
    address: '10609',
    position: { kind: 'straight', side: 'east', z: oddSlot(0) + 0.4 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.umber, sidingColor: SIDING.cream, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.umber,
    garageOnLeft: true, sqft: 2231, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10613',
    position: { kind: 'straight', side: 'east', z: oddSlot(1) - 0.3 },
    width: 12.5, depth: 9.5, stories: 2,
    brickColor: BRICK.rust, sidingColor: SIDING.warmGray, roofColor: ROOF.graphite, doorColor: DOOR.navy,
    wallColor: SIDING.warmGray, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: false, sqft: 2040, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10617',
    position: { kind: 'straight', side: 'east', z: oddSlot(2) + 0.35 },
    width: 11.5, depth: 9, stories: 2,
    brickColor: BRICK.clay, sidingColor: SIDING.tan, roofColor: ROOF.gray, doorColor: DOOR.burgundy,
    wallColor: SIDING.tan, trimColor: TRIM, hasStone: false, stoneColor: BRICK.clay,
    garageOnLeft: true, sqft: 2154, yearBuilt: 2004, source: 'partial',
  },
  {
    address: '10621',
    position: { kind: 'straight', side: 'east', z: oddSlot(3) - 0.4 },
    width: 12.5, depth: 12, stories: 1,
    brickColor: BRICK.mocha, sidingColor: SIDING.sand, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.sand, trimColor: TRIM, hasStone: false, stoneColor: BRICK.mocha,
    garageOnLeft: false, sqft: 1695, yearBuilt: 2004, source: 'partial',
  },
  {
    address: '10625',
    position: { kind: 'straight', side: 'east', z: oddSlot(4) + 0.3 },
    width: 12.5, depth: 12, stories: 1,
    brickColor: BRICK.buff, sidingColor: SIDING.cream, roofColor: ROOF.gray, doorColor: DOOR.brown,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.buff,
    garageOnLeft: true, sqft: 1594, yearBuilt: 2005, source: 'verified',
  },
  {
    address: '10629',
    position: { kind: 'straight', side: 'east', z: oddSlot(5) - 0.35 },
    width: 13, depth: 12.5, stories: 1,
    brickColor: BRICK.redBrown, sidingColor: SIDING.beige, roofColor: ROOF.ash, doorColor: DOOR.forest,
    wallColor: SIDING.beige, trimColor: TRIM, hasStone: false, stoneColor: BRICK.redBrown,
    garageOnLeft: false, sqft: 1818, yearBuilt: 2010, source: 'verified',
  },
  {
    address: '10633',
    position: { kind: 'straight', side: 'east', z: oddSlot(6) + 0.4 },
    width: 13, depth: 12.5, stories: 1,
    brickColor: BRICK.rust, sidingColor: SIDING.tan, roofColor: ROOF.gray, doorColor: DOOR.brown,
    wallColor: SIDING.tan, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: true, sqft: 1786, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10637',
    position: { kind: 'straight', side: 'east', z: oddSlot(7) - 0.3 },
    width: 12.5, depth: 12, stories: 1,
    brickColor: BRICK.clay, sidingColor: SIDING.warmGray, roofColor: ROOF.slate, doorColor: DOOR.black,
    wallColor: SIDING.warmGray, trimColor: TRIM, hasStone: false, stoneColor: BRICK.clay,
    garageOnLeft: false, sqft: 1668, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10641',
    position: { kind: 'straight', side: 'east', z: oddSlot(8) + 0.35 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.umber, sidingColor: SIDING.sand, roofColor: ROOF.graphite, doorColor: DOOR.brown,
    wallColor: SIDING.sand, trimColor: TRIM, hasStone: false, stoneColor: BRICK.umber,
    garageOnLeft: true, yearBuilt: 2009, source: 'inferred',
  },
  {
    address: '10645',
    position: { kind: 'straight', side: 'east', z: oddSlot(9) - 0.4 },
    width: 11.5, depth: 9, stories: 2,
    brickColor: BRICK.mocha, sidingColor: SIDING.cream, roofColor: ROOF.gray, doorColor: DOOR.navy,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.mocha,
    garageOnLeft: false, sqft: 1786, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10649',
    position: { kind: 'straight', side: 'east', z: oddSlot(10) + 0.3 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.rust, sidingColor: SIDING.beige, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.beige, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: true, yearBuilt: 2009, source: 'inferred',
  },

  // ---- Even side / WEST (10 homes: 10612..10648; all 2-story) ----
  {
    address: '10612',
    position: { kind: 'straight', side: 'west', z: evenSlot(0) - 0.3 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.redBrown, sidingColor: SIDING.tan, roofColor: ROOF.gray, doorColor: DOOR.brown,
    wallColor: SIDING.tan, trimColor: TRIM, hasStone: false, stoneColor: BRICK.redBrown,
    garageOnLeft: false, sqft: 2129, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10616',
    position: { kind: 'straight', side: 'west', z: evenSlot(1) + 0.4 },
    width: 12.5, depth: 9.5, stories: 2,
    brickColor: BRICK.clay, sidingColor: SIDING.cream, roofColor: ROOF.slate, doorColor: DOOR.black,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.clay,
    garageOnLeft: true, sqft: 2090, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10620',
    position: { kind: 'straight', side: 'west', z: evenSlot(2) - 0.35 },
    width: 12.5, depth: 9.5, stories: 2,
    brickColor: BRICK.rust, sidingColor: SIDING.warmGray, roofColor: ROOF.graphite, doorColor: DOOR.brown,
    wallColor: SIDING.warmGray, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: false, sqft: 2322, yearBuilt: 2004, source: 'verified',
  },
  {
    address: '10624',
    position: { kind: 'straight', side: 'west', z: evenSlot(3) + 0.3 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.umber, sidingColor: SIDING.sand, roofColor: ROOF.gray, doorColor: DOOR.navy,
    wallColor: SIDING.sand, trimColor: TRIM, hasStone: false, stoneColor: BRICK.umber,
    garageOnLeft: true, sqft: 2129, yearBuilt: 2005, source: 'verified',
  },
  {
    address: '10628',
    position: { kind: 'straight', side: 'west', z: evenSlot(4) - 0.4 },
    width: 12.5, depth: 9.5, stories: 2,
    brickColor: BRICK.mocha, sidingColor: SIDING.beige, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.beige, trimColor: TRIM, hasStone: false, stoneColor: BRICK.mocha,
    garageOnLeft: false, sqft: 2275, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10632',
    position: { kind: 'straight', side: 'west', z: evenSlot(5) + 0.35 },
    width: 13, depth: 10, stories: 2,
    brickColor: BRICK.redBrown, sidingColor: SIDING.tan, roofColor: ROOF.graphite, doorColor: DOOR.black,
    wallColor: SIDING.tan, trimColor: TRIM, hasStone: false, stoneColor: BRICK.redBrown,
    garageOnLeft: true, sqft: 2634, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10636',
    position: { kind: 'straight', side: 'west', z: evenSlot(6) - 0.3 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.clay, sidingColor: SIDING.cream, roofColor: ROOF.gray, doorColor: DOOR.burgundy,
    wallColor: SIDING.cream, trimColor: TRIM, hasStone: false, stoneColor: BRICK.clay,
    garageOnLeft: false, sqft: 2258, yearBuilt: 2009, source: 'partial',
  },
  {
    address: '10640',
    position: { kind: 'straight', side: 'west', z: evenSlot(7) + 0.4 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.rust, sidingColor: SIDING.warmGray, roofColor: ROOF.slate, doorColor: DOOR.brown,
    wallColor: SIDING.warmGray, trimColor: TRIM, hasStone: false, stoneColor: BRICK.rust,
    garageOnLeft: true, sqft: 2124, yearBuilt: 2009, source: 'partial',
  },
  {
    address: '10644',
    position: { kind: 'straight', side: 'west', z: evenSlot(8) - 0.35 },
    width: 11.5, depth: 9, stories: 2,
    brickColor: BRICK.umber, sidingColor: SIDING.sand, roofColor: ROOF.gray, doorColor: DOOR.navy,
    wallColor: SIDING.sand, trimColor: TRIM, hasStone: false, stoneColor: BRICK.umber,
    garageOnLeft: false, sqft: 1987, yearBuilt: 2009, source: 'verified',
  },
  {
    address: '10648',
    position: { kind: 'straight', side: 'west', z: evenSlot(9) + 0.3 },
    width: 12, depth: 9.5, stories: 2,
    brickColor: BRICK.mocha, sidingColor: SIDING.beige, roofColor: ROOF.graphite, doorColor: DOOR.brown,
    wallColor: SIDING.beige, trimColor: TRIM, hasStone: false, stoneColor: BRICK.mocha,
    garageOnLeft: true, sqft: 1791, yearBuilt: 2009, source: 'partial',
  },
];
