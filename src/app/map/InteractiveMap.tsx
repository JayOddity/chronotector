'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import React from 'react';
import {
  MAP_BOUNDS,
  REGION_GROUPS,
  AREA_LABELS,
  WARP_MARKERS,
  SECTION_MARKERS,
  DUNGEON_MARKERS,
  type DungeonMarker,
} from '@/data/map-data';
import { MAP_TILES } from '@/data/map-tiles';
import { getMonsterSummaries, getMonsterGroups, formatLevelRange, GRADE_COLORS as ENEMY_GRADE_COLORS, GRADE_LABELS as ENEMY_GRADE_LABELS } from '@/data/monsters';
import { getNpcSummaries, getNpcGroups } from '@/data/npcs';
import {
  MONSTER_POIS,
  NEIGHBOR_POIS,
  PROP_POIS,
  WARP_POIS,
  RESPAWN_POIS,
  RETURN_POIS,
} from '@/data/map-pois';

// --- Constants ---
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const PADDING = 60;

// Canonical projection: the Setera world square as defined in the game data.
// World.json[10]: WorldPos=(0,0,0), WorldSize=800000. Both the atlas image and
// the tile pyramid cover exactly this square, so it's the single source of truth.
const WORLD_BOUNDS = {
  minX: -400000,
  maxX: +400000,
  minY: -400000,
  maxY: +400000,
};

// Kept for legacy diagnostics — the envelope of every positioned POI.
const FULL_BOUNDS = (() => {
  let minX = WORLD_BOUNDS.minX, maxX = WORLD_BOUNDS.maxX;
  let minY = WORLD_BOUNDS.minY, maxY = WORLD_BOUNDS.maxY;
  const collect = (arr: { x: number; y: number }[]) => {
    for (const p of arr) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  };
  collect(WARP_POIS); collect(RESPAWN_POIS); collect(RETURN_POIS);
  collect(MONSTER_POIS); collect(NEIGHBOR_POIS); collect(PROP_POIS);
  return { minX, maxX, minY, maxY };
})();

// Inscribe the world square into the SVG viewport. Square data -> square-fit
// projection, so the atlas image fills the viewport when calibration = defaults.
const DATA_WIDTH = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const DATA_HEIGHT = WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY;
const SCALE = Math.min(
  (MAP_WIDTH - PADDING * 2) / DATA_WIDTH,
  (MAP_HEIGHT - PADDING * 2) / DATA_HEIGHT,
);
// Center the world square in the viewport (since aspect ratio may differ).
const WORLD_SCREEN_W = DATA_WIDTH * SCALE;
const WORLD_SCREEN_H = DATA_HEIGHT * SCALE;
const WORLD_OFFSET_X = (MAP_WIDTH - WORLD_SCREEN_W) / 2;
const WORLD_OFFSET_Y = (MAP_HEIGHT - WORLD_SCREEN_H) / 2;

// Setera atlas convention (verified visually): image top = LOW world Y, image
// bottom = HIGH world Y. No Y flip — positive world Y → larger screen Y (down).
function worldToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: WORLD_OFFSET_X + (wx - WORLD_BOUNDS.minX) * SCALE,
    y: WORLD_OFFSET_Y + (wy - WORLD_BOUNDS.minY) * SCALE,
  };
}

function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - WORLD_OFFSET_X) / SCALE + WORLD_BOUNDS.minX,
    y: (sy - WORLD_OFFSET_Y) / SCALE + WORLD_BOUNDS.minY,
  };
}

type LayerKey =
  | 'settlements'
  | 'warpPoints'
  | 'boundStones'
  | 'areaLabels'
  | 'regionZones'
  | 'normalMobs'
  | 'eliteMobs'
  | 'bosses'
  | 'npcs'
  | 'mining'
  | 'harvesting'
  | 'logging'
  | 'labyrinth'
  | 'expedition'
  | 'trial'
  | 'mapTowers'
  | 'craftWeapon'
  | 'craftArmor'
  | 'craftAccessory'
  | 'magicWorkshop'
  | 'process'
  | 'services'
  | 'exits'
  | 'inns'
  | 'chests'
  | 'timePortals'
  | 'beacons'
  | 'wedges'
  | 'corpses'
  | 'puzzles'
  | 'chronoGates'
  | 'dawnSlopeOnly';

// Calibration anchors — known ground-truth points used to verify map alignment.
// Dawn Slope Settlement is the main starting settlement; the 4 Chrono Gates
// are from WorldTriggerVolume entries (Korean desc "크로노 게이트 섹션(내비마크)").
interface CalibrationAnchor { name: string; x: number; y: number; }
const CHRONO_GATES: CalibrationAnchor[] = [
  { name: 'Chronogate 1_1',                     x: -224490, y: 162510 },
  { name: 'Chronogate [Trampled]',              x: -236957, y: 236680 },
  { name: 'Chronogate [Those with first horn]', x: -188730, y: 277983 },
  { name: 'Chronogate 1_4',                     x: -132929, y: 299636 },
];
const DAWN_SLOPE_ANCHOR: CalibrationAnchor = {
  name: 'Dawn Slope Settlement', x: -227052, y: 136283,
};

type LayerGroup = 'collectibles' | 'locations' | 'gathering' | 'services' | 'mobs' | 'world';

interface LayerConfig {
  key: LayerKey;
  label: string;
  color: string;
  defaultOn: boolean;
  group: LayerGroup;
  iconPath?: string; // relative URL to a 48×48 compass icon; optional
  // If set, the sidebar row offers an expandable list of POI subtypes pulled
  // from PROP_POIS where p.category === subtypeCategory, grouping by p.title.
  subtypeCategory?: string;
}

const LAYER_GROUPS: { id: LayerGroup; title: string }[] = [
  { id: 'locations',    title: 'Locations' },
  { id: 'gathering',    title: 'Gathering' },
  { id: 'services',     title: 'Services & Crafting' },
  { id: 'mobs',         title: 'Creatures' },
  { id: 'collectibles', title: 'Collectibles' },
  { id: 'world',        title: 'World & Map' },
];

const ICON = (name: string) => `/images/map/icons/${name}`;

const LAYERS: LayerConfig[] = [
  // Collectibles
  { key: 'chests',      label: 'Chests',        color: '#eab308', defaultOn: false, group: 'collectibles', iconPath: ICON('TX_Icon_Box_M.png') },
  { key: 'corpses',     label: 'Corpses',       color: '#9ca3af', defaultOn: false, group: 'collectibles' },

  // Locations
  { key: 'boundStones', label: 'Bound Stone',    color: '#a78bfa', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Warp_M.png') },
  { key: 'settlements', label: 'Settlements',    color: '#facc15', defaultOn: true,  group: 'locations', iconPath: ICON('TX_Icon_SettlementWarp_M.png') },
  { key: 'inns',        label: 'Inn',            color: '#fbbf24', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Inn_M.png') },
  { key: 'chronoGates', label: 'Chrono Gate',    color: '#a855f7', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_ChronoGate_M.png') },
  { key: 'timePortals', label: 'Time Portal',    color: '#a855f7', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_ChronoGate_M.png') },
  { key: 'beacons',     label: 'Beacon of Time', color: '#38bdf8', defaultOn: false, group: 'locations', iconPath: ICON('TXIcon_SealOfTime_M.png') },
  { key: 'wedges',      label: 'Wedge of Time',  color: '#06b6d4', defaultOn: false, group: 'locations', iconPath: ICON('TXIcon_SealOfTime_M.png') },
  { key: 'labyrinth',   label: 'Labyrinth',      color: '#d946ef', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Labyrinth_M.png') },
  { key: 'expedition',  label: 'Expedition',     color: '#d946ef', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Expeduition_M.png') },
  { key: 'trial',       label: 'Trial',          color: '#d946ef', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Trial_M.png') },
  { key: 'mapTowers',   label: 'Eye of Insight', color: '#14b8a6', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_MapTower_M.png') },
  { key: 'exits',       label: 'Exit',           color: '#9ca3af', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Exit_M.png') },
  { key: 'puzzles',     label: 'Vault & Puzzles', color: '#f97316', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Question_M.png') },
  { key: 'warpPoints',  label: 'Warp (legacy)',  color: '#60a5fa', defaultOn: false, group: 'locations', iconPath: ICON('TX_Icon_Warp_M.png') },

  // Gathering — each has an expandable subtype list (by POI title)
  { key: 'mining',     label: 'Mining',      color: '#a16207', defaultOn: false, group: 'gathering', iconPath: ICON('TX_Icon_Mine_M.png'), subtypeCategory: 'mining' },
  { key: 'harvesting', label: 'Harvesting',  color: '#65a30d', defaultOn: false, group: 'gathering', iconPath: ICON('TX_Icon_Grass_M.png'), subtypeCategory: 'harvesting' },
  { key: 'logging',    label: 'Logging',     color: '#92400e', defaultOn: false, group: 'gathering', iconPath: ICON('TX_Icon_Wood_M.png'), subtypeCategory: 'logging' },

  // Services & Crafting
  { key: 'craftWeapon',    label: 'Weapon Crafting',    color: '#eab308', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_CraftWeapon_M.png') },
  { key: 'craftArmor',     label: 'Armor Crafting',     color: '#eab308', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_CraftArmor_M.png') },
  { key: 'craftAccessory', label: 'Accessory Crafting', color: '#eab308', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_CraftAccessory_M.png') },
  { key: 'magicWorkshop',  label: 'Alchemy Workshop',   color: '#eab308', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_MagicWorkShop_M.png') },
  { key: 'process',        label: 'Processing',         color: '#eab308', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_Process_M.png') },
  { key: 'services',       label: 'Markets & Boards',   color: '#0ea5e9', defaultOn: false, group: 'services', iconPath: ICON('TX_Icon_Store_M.png') },

  // Creatures
  { key: 'bosses',     label: 'Bosses',      color: '#f43f5e', defaultOn: false, group: 'mobs',  iconPath: ICON('TX_Icon_Monster_M2.png') },
  { key: 'eliteMobs',  label: 'Elite Mobs',  color: '#f87171', defaultOn: false, group: 'mobs',  iconPath: ICON('TX_Icon_Monster_M.png') },
  { key: 'normalMobs', label: 'Normal Mobs', color: '#64748b', defaultOn: false, group: 'mobs' },
  { key: 'npcs',       label: 'NPCs',        color: '#38bdf8', defaultOn: false, group: 'mobs' },

  // World & Map
  { key: 'areaLabels',    label: 'Area Names',       color: '#e0c068', defaultOn: false, group: 'world' },
  { key: 'regionZones',   label: 'Region Zones',     color: '#4ade80', defaultOn: false, group: 'world' },
  { key: 'dawnSlopeOnly', label: 'Dawn Slope anchor', color: '#facc15', defaultOn: false, group: 'world' },
];

// Layers rendered inside the custom Enemies / NPCs popouts in the Creatures
// group instead of as standalone top-level rows in the sidebar.
const CREATURE_POPOUT_KEYS = new Set<LayerKey>(['bosses', 'eliteMobs', 'normalMobs', 'npcs']);

const PUZZLE_CATS = new Set(['switch', 'well', 'vault', 'pureForm', 'questItem']);
const CHEST_CATS = new Set(['chest', 'chestElite']);

const DUNGEON_CATS = new Set(['labyrinth', 'expedition', 'trial']);
const CRAFTING_CATS = new Set(['craftWeapon', 'craftArmor', 'craftAccessory', 'magicWorkshop', 'process']);
const SERVICE_CATS = new Set(['market', 'storage', 'kitchen', 'warBoard', 'wantedBoard', 'townBoard', 'regionTable']);
const CATEGORY_LABELS: Record<string, string> = {
  mining: 'Mining', harvesting: 'Harvesting', logging: 'Logging',
  labyrinth: 'Labyrinth', expedition: 'Expedition', trial: 'Trial',
  mapTower: 'Map Tower',
  craftWeapon: 'Weapon Crafting', craftArmor: 'Armor Crafting', craftAccessory: 'Accessory Crafting',
  magicWorkshop: 'Magic Workshop', process: 'Processing',
  market: 'Market', storage: 'Storage', kitchen: 'Kitchen',
  warBoard: 'War Board', wantedBoard: 'Wanted Board', townBoard: 'Town Board',
  regionTable: 'Region Management', exit: 'Exit',
};

// Real game compass/map icons (extracted from UI/UITextures/00_New/00_UI_Icon/00_Common_Icon_Compass/Icon_48x48)
const ICON_BASE = '/images/map/icons';

// Subtype tints. The base compass icons are a warm brown, so CSS filters
// shift that toward the subtype's real-world colour (tomato → red, orange →
// orange, etc). Unknown titles fall back to a hash-derived hue so nothing
// renders as pure brown by accident.
const TINTS = {
  red:       'hue-rotate(-30deg) saturate(2.0) brightness(1.0)',
  tomato:    'hue-rotate(-25deg) saturate(2.0) brightness(1.05)',
  orange:    'hue-rotate(-5deg)  saturate(1.9) brightness(1.1)',
  pumpkin:   'hue-rotate(-10deg) saturate(1.9) brightness(1.05)',
  gold:      'hue-rotate(15deg)  saturate(2.0) brightness(1.15)',
  yellow:    'hue-rotate(25deg)  saturate(2.0) brightness(1.2)',
  wheat:     'hue-rotate(20deg)  saturate(1.4) brightness(1.15)',
  lime:      'hue-rotate(70deg)  saturate(1.5) brightness(1.05)',
  green:     'hue-rotate(95deg)  saturate(1.5) brightness(1.0)',
  darkGreen: 'hue-rotate(95deg)  saturate(1.2) brightness(0.82)',
  teal:      'hue-rotate(140deg) saturate(1.3) brightness(1.05)',
  iceBlue:   'hue-rotate(170deg) saturate(1.3) brightness(1.15)',
  blue:      'hue-rotate(210deg) saturate(1.6) brightness(1.0)',
  purple:    'hue-rotate(260deg) saturate(1.6) brightness(1.0)',
  magenta:   'hue-rotate(290deg) saturate(1.6) brightness(1.0)',
  berry:     'hue-rotate(-35deg) saturate(1.7) brightness(0.95)',
  silver:    'saturate(0.2) brightness(1.2)',
  white:     'saturate(0.1) brightness(1.4)',
  grey:      'saturate(0.3) brightness(0.95)',
  darkGrey:  'saturate(0.3) brightness(0.75)',
  black:     'saturate(0.3) brightness(0.45)',
  steelBlue: 'hue-rotate(200deg) saturate(0.7) brightness(0.95)',
  brown:     'saturate(1.2) brightness(0.9)',
} as const;

const SUBTYPE_TINT: Record<string, string> = {
  // Mining — metals and stones
  'Iron Deposit':               TINTS.grey,
  'Primitive Iron Deposit':     TINTS.darkGrey,
  'Silver Deposit':             TINTS.silver,
  'Gold Deposit':               TINTS.gold,
  'Titanium Deposit':           TINTS.steelBlue,
  'Platinum Deposit':           TINTS.white,
  'Meteorite Deposit':          TINTS.purple,
  'Arche Deposit':              TINTS.magenta,
  'Arche Springwater':          TINTS.iceBlue,
  'Oil':                        TINTS.black,
  'Rock':                       TINTS.darkGrey,
  // Mining — crystals
  'Fire Crystal':               TINTS.red,
  'Ice Crystal':                TINTS.iceBlue,
  'Light Crystal':              TINTS.white,
  'Dark Crystal':               TINTS.darkGrey,
  'Nature Crystal':             TINTS.green,
  'Lightning Crystal':          TINTS.yellow,
  'Lustrous Fire Crystal':      TINTS.red,
  'Lustrous Ice Crystal':       TINTS.iceBlue,
  'Lustrous Light Crystal':     TINTS.white,
  'Lustrous Dark Crystal':      TINTS.darkGrey,
  'Lustrous Nature Crystal':    TINTS.green,
  'Lustrous Lightning Crystal': TINTS.yellow,
  'Eltanius Star':              TINTS.gold,
  'Eltanius Cosmos':            TINTS.blue,

  // Harvesting — fruits, veg, grains, fibres
  'Tomato':        TINTS.tomato,
  'Orange':        TINTS.orange,
  'Pumpkin':       TINTS.pumpkin,
  'Lemon':         TINTS.yellow,
  'Wild Berries':  TINTS.berry,
  'Onion':         TINTS.silver,
  'Kale':          TINTS.darkGreen,
  'Wheat':         TINTS.wheat,
  'Sugar Cane':    TINTS.lime,
  'Cotton':        TINTS.white,
  'Silk':          TINTS.silver,
  'Ramie':         TINTS.lime,
  'Flax':          TINTS.steelBlue,
  'Herbs':         TINTS.green,
  'Thicket':       TINTS.darkGreen,
  'Flint':         TINTS.darkGrey,
  // Harvesting — mushrooms
  'Earthshroom':   TINTS.brown,
  'Shieldshroom':  TINTS.steelBlue,
  'Mistshroom':    TINTS.silver,
  'Ghostshroom':   TINTS.white,
  'Thornshroom':   TINTS.berry,
  'Oxshroom':      TINTS.brown,
  // Harvesting — elemental florets (mirror crystals)
  'Fire Floret':               TINTS.red,
  'Ice Floret':                TINTS.iceBlue,
  'Light Floret':              TINTS.white,
  'Dark Floret':               TINTS.darkGrey,
  'Nature Floret':             TINTS.green,
  'Lightning Floret':          TINTS.yellow,
  'Lustrous Fire Floret':      TINTS.red,
  'Lustrous Ice Floret':       TINTS.iceBlue,
  'Lustrous Light Floret':     TINTS.white,
  'Lustrous Dark Floret':      TINTS.darkGrey,
  'Lustrous Nature Floret':    TINTS.green,
  'Lustrous Lightning Floret': TINTS.yellow,

  // Logging
  'Red Tree':    TINTS.red,
  'Arche Tree':  TINTS.magenta,
};

function subtypeHue(title: string): number {
  let h = 5381;
  for (let i = 0; i < title.length; i++) h = (h * 33) ^ title.charCodeAt(i);
  return (h >>> 0) % 360;
}
function subtypeTint(title: string | null | undefined): string | undefined {
  if (!title) return undefined;
  const explicit = SUBTYPE_TINT[title];
  if (explicit) return explicit;
  return `hue-rotate(${subtypeHue(title)}deg) saturate(1.4) brightness(1.05)`;
}
const CATEGORY_ICON: Record<string, string> = {
  mining: `${ICON_BASE}/TX_Icon_Mine_M.png`,
  harvesting: `${ICON_BASE}/TX_Icon_Grass_M.png`,
  logging: `${ICON_BASE}/TX_Icon_Wood_M.png`,
  labyrinth: `${ICON_BASE}/TX_Icon_Labyrinth_M.png`,
  expedition: `${ICON_BASE}/TX_Icon_Expeduition_M.png`,
  trial: `${ICON_BASE}/TX_Icon_Trial_M.png`,
  mapTower: `${ICON_BASE}/TX_Icon_MapTower_M.png`,
  craftWeapon: `${ICON_BASE}/TX_Icon_CraftWeapon_M.png`,
  craftArmor: `${ICON_BASE}/TX_Icon_CraftArmor_M.png`,
  craftAccessory: `${ICON_BASE}/TX_Icon_CraftAccessory_M.png`,
  magicWorkshop: `${ICON_BASE}/TX_Icon_MagicWorkShop_M.png`,
  process: `${ICON_BASE}/TX_Icon_Process_M.png`,
  market: `${ICON_BASE}/TX_Icon_Store_M.png`,
  storage: `${ICON_BASE}/TX_Icon_Storage_M.png`,
  kitchen: `${ICON_BASE}/TX_Icon_Kitchen_M.png`,
  warBoard: `${ICON_BASE}/TX_Icon_WarBoard_M.png`,
  wantedBoard: `${ICON_BASE}/TX_Icon_WantedBoard_M.png`,
  townBoard: `${ICON_BASE}/TX_Icon_TownQuestsBoard_M.png`,
  regionTable: `${ICON_BASE}/TX_Icon_RegionManagementTable_M.png`,
  exit: `${ICON_BASE}/TX_Icon_Exit_M.png`,
  chest: `${ICON_BASE}/TX_Icon_Box_M.png`,
  chestElite: `${ICON_BASE}/TX_Icon_Box_M2.png`,
  timePortal: `${ICON_BASE}/TX_Icon_ChronoGate_M.png`,
  // Beacon of Time = the round mechanical seal icon.
  beaconOfTime: `${ICON_BASE}/TXIcon_SealOfTime_M.png`,
  // Wedge of Time — no distinct in-game icon confirmed; reuse the seal for now.
  wedgeOfTime: `${ICON_BASE}/TXIcon_SealOfTime_M.png`,
  switch: `${ICON_BASE}/TX_Icon_Question_M.png`,
  well: `${ICON_BASE}/TX_Icon_Question_M.png`,
  // Vault is a chest-like interactable (interactivemap.app shows it with a chest icon).
  vault: `${ICON_BASE}/TX_Icon_Box_M.png`,
  pureForm: `${ICON_BASE}/TX_Icon_Question_M.png`,
  questItem: `${ICON_BASE}/TX_Icon_Question_M.png`,
};
// Default POI icon size in on-screen pixels (live-tunable via debug slider).
// Actual used size is `poiIconPx` state; divided by `zoom` at render time so it stays constant on screen.
const DEFAULT_POI_ICON_PX = 40;

const SETAR_OVERVIEW_URL = MAP_TILES.setar?.overviewUrl ?? null;

// Atlas calibration: a world-space rect (independent X/Y extents) the atlas
// image is stretched into. Stored in localStorage; tweak via the "Align atlas"
// panel or click-to-pin landmarks.
interface AtlasCalibration {
  worldMinX: number;
  worldMaxX: number;
  worldMinY: number;
  worldMaxY: number;
}

// Ground-truth calibration from the game's own data:
//   World.json[10]:               WorldSize=800000, centered at (0,0,0)
//   SeteraBGData (QuadTreeImage): OriginImgSize=20480 px, NumNodeDepth=6,
//                                 CorrectWidthValue=-500, CorrectHeightValue=-1500
// The 20480 px image has a parchment-border frame: 500 px per side horizontally
// and 1500 px per side vertically (title banner at top, compass rose etc. at
// bottom). The 800k × 800k playable world maps to the INNER content rect
// (19480 × 17480 px), so the FULL tile pyramid image covers a larger world
// rect than the playable area — border artwork overflows the world square.
const ATLAS_ORIGIN_IMG_SIZE = 20480;
const ATLAS_BORDER_W_PX = 500;   // |CorrectWidthValue| from SeteraBGData
const ATLAS_BORDER_H_PX = 1500;  // |CorrectHeightValue| from SeteraBGData
const ATLAS_CONTENT_W_PX = ATLAS_ORIGIN_IMG_SIZE - 2 * ATLAS_BORDER_W_PX; // 19480
const ATLAS_CONTENT_H_PX = ATLAS_ORIGIN_IMG_SIZE - 2 * ATLAS_BORDER_H_PX; // 17480

// Empirical calibration (2026-04-18): user aligned the atlas to real landmarks
// and the resulting rect's aspect ratio is 778766/867870 = 0.8973 — exactly
// 19480/17480, confirming the SeteraBGData border math. Back-solving a world
// size from the scale gives ~740,680 on both axes (not the 800,000 from
// World.json), and the world origin is offset ~(+16737, +44528) from the atlas
// center. Treating these four numbers as ground truth until better data shows up.
const DEFAULT_ATLAS_CALIBRATION: AtlasCalibration = {
  worldMinX: -375944.5008950393,
  worldMaxX:  402810.4122176751,
  worldMinY: -382038.551519923,
  worldMaxY:  484309.70172175916,
};

const ATLAS_STORAGE_KEY = 'chrono.map.atlasCalibration.v4';

// Solve translation + per-axis scale from N landmark pairs (least squares).
// Each pair: (worldPoint, intendedPixelPoint within atlas bounds 0..1)
function solveAtlasFromLandmarks(
  pairs: { world: { x: number; y: number }; uv: { u: number; v: number } }[],
): AtlasCalibration | null {
  if (pairs.length < 2) return null;
  // For per-axis: world.x = minX + u*(maxX-minX)  =>  world.x = a + b*u
  // Solve a, b via least squares per axis.
  const fit = (vals: number[], coords: number[]) => {
    const n = vals.length;
    const sx = coords.reduce((s, v) => s + v, 0);
    const sy = vals.reduce((s, v) => s + v, 0);
    const sxx = coords.reduce((s, v) => s + v * v, 0);
    const sxy = coords.reduce((s, v, i) => s + v * vals[i], 0);
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    const b = (n * sxy - sx * sy) / denom;
    const a = (sy - b * sx) / n;
    return { a, b };
  };
  const fx = fit(pairs.map((p) => p.world.x), pairs.map((p) => p.uv.u));
  const fy = fit(pairs.map((p) => p.world.y), pairs.map((p) => p.uv.v));
  if (!fx || !fy) return null;
  return {
    worldMinX: fx.a,
    worldMaxX: fx.a + fx.b,
    // Image v=0 is TOP (low world Y), v=1 is BOTTOM (high world Y).
    worldMinY: fy.a,
    worldMaxY: fy.a + fy.b,
  };
}

// --- Sub-components ---

interface PickerPanelProps {
  title: string;
  color: 'accent-gold' | 'sky-400';
  onClose: () => void;
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  extraHeader?: React.ReactNode;
  pickedCount: number;
  onClearPicks: () => void;
  rows: React.ReactNode;
  emptyHint: string;
  onSelectAllVisible?: () => void;
  selectAllLabel?: string;
}

function PickerPanel({
  title,
  color,
  onClose,
  search,
  setSearch,
  placeholder,
  extraHeader,
  pickedCount,
  onClearPicks,
  rows,
  emptyHint,
  onSelectAllVisible,
  selectAllLabel = 'Select all',
}: PickerPanelProps) {
  const borderClass = color === 'accent-gold' ? 'border-accent-gold' : 'border-sky-400';
  const titleClass = color === 'accent-gold' ? 'text-accent-gold' : 'text-sky-300';
  const hasRows = Array.isArray(rows) ? rows.length > 0 : !!rows;
  return (
    <div
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute top-3 left-3 z-40 w-[360px] max-h-[calc(100%-24px)] flex flex-col bg-deep-night/97 border ${borderClass} rounded-lg shadow-2xl`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <h3 className={`font-heading text-base ${titleClass}`}>{title}</h3>
        {pickedCount > 0 && (
          <span className="text-xs text-text-muted">({pickedCount} picked)</span>
        )}
        {pickedCount > 0 && (
          <button
            onClick={onClearPicks}
            className="ml-auto text-xs px-2 py-0.5 rounded border border-white/20 text-text-muted hover:text-white hover:border-white/40"
          >
            Clear picks
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close picker"
          className={`${pickedCount > 0 ? '' : 'ml-auto'} w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-text-muted text-lg leading-none`}
        >
          &times;
        </button>
      </div>
      <div className="p-3 border-b border-white/10 space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full bg-dark-surface border border-border-subtle rounded px-2.5 py-1.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-accent-gold"
        />
        {extraHeader}
      </div>
      <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted border-b border-white/5">
        <span>Name</span>
        {onSelectAllVisible && (
          <button
            onClick={onSelectAllVisible}
            className="ml-2 px-2 py-0.5 rounded border border-white/20 text-[10px] tracking-wider text-text-muted hover:text-white hover:border-white/40 normal-case"
          >
            {selectAllLabel}
          </button>
        )}
        <span className="ml-auto">Locations</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {hasRows ? (
          <div className="space-y-0.5">{rows}</div>
        ) : (
          <div className="text-xs text-text-muted px-2 py-3">{emptyHint}</div>
        )}
      </div>
    </div>
  );
}

function MapTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: x, top: y - 10, transform: 'translate(-50%, -100%)' }}>
      <div className="bg-deep-night border border-border-subtle rounded-lg px-3 py-2 shadow-xl text-sm max-w-xs">
        {children}
      </div>
    </div>
  );
}

function DungeonPanel({ dungeon, onClose }: { dungeon: DungeonMarker; onClose: () => void }) {
  const typeColors: Record<string, string> = {
    Expedition: 'text-blue-400 bg-blue-500/10',
    Ordeal: 'text-purple-400 bg-purple-500/10',
    Wanted: 'text-red-400 bg-red-500/10',
    Labyrinth: 'text-orange-400 bg-orange-500/10',
    SealOfTime: 'text-accent-gold bg-accent-gold/10',
    Normal: 'text-green-400 bg-green-500/10',
    Raid: 'text-red-400 bg-red-500/10',
    QuestPhase: 'text-cyan-400 bg-cyan-500/10',
    IntersectionOfSpace: 'text-violet-400 bg-violet-500/10',
  };
  return (
    <div className="absolute top-4 left-[17rem] z-50 w-80 bg-deep-night border border-border-subtle rounded-lg shadow-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border-subtle">
        <h3 className="font-heading text-accent-gold text-sm">{dungeon.name}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg leading-none">&times;</button>
      </div>
      <div className="p-3 space-y-2 text-xs">
        <div className="flex gap-2">
          <span className={`px-2 py-0.5 rounded ${typeColors[dungeon.type] || 'text-text-muted bg-dark-surface'}`}>{dungeon.type}</span>
          <span className="px-2 py-0.5 rounded bg-dark-surface text-text-muted">{dungeon.groupType}</span>
        </div>
        {dungeon.description && <p className="text-text-secondary leading-relaxed">{dungeon.description}</p>}
        <div className="flex gap-3 text-text-muted">
          {dungeon.minGearScore > 0 && <span>GS: {dungeon.minGearScore}+</span>}
          <span>Party: {dungeon.minParty} {dungeon.maxParty}</span>
        </div>
      </div>
    </div>
  );
}

// Pre-bucket PROP_POIS by category and subtype title at module load. The
// gathering render path iterates only the currently-selected subtype's array
// instead of rescanning all 6k PROP_POIS three times per frame.
type PropPoi = typeof PROP_POIS[number];
const POIS_BY_CATEGORY_SUBTYPE: Record<string, Record<string, PropPoi[]>> = (() => {
  const out: Record<string, Record<string, PropPoi[]>> = {};
  for (const p of PROP_POIS) {
    const title = p.title?.trim();
    if (!title) continue;
    if (!out[p.category]) out[p.category] = {};
    if (!out[p.category][title]) out[p.category][title] = [];
    out[p.category][title].push(p);
  }
  return out;
})();
// Subtype titles per category, sorted descending by count (most common first).
const SUBTYPES_BY_CATEGORY: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [cat, byTitle] of Object.entries(POIS_BY_CATEGORY_SUBTYPE)) {
    out[cat] = Object.keys(byTitle).sort((a, b) => byTitle[b].length - byTitle[a].length);
  }
  return out;
})();

// --- Main Component ---
export interface InteractiveMapProps {
  /** Embed mode: hides the sidebar, compact chip toggles overlaid on the canvas,
   *  no localStorage persistence for layer state, configurable height. */
  embed?: boolean;
  /** Initial layer on/off — overrides LAYER defaults. In embed mode, overrides saved state too. */
  initialLayers?: Partial<Record<LayerKey, boolean>>;
  /** Layers the embed chip bar exposes (and the only ones the user can toggle). */
  allowedLayers?: LayerKey[];
  /** Height utility class applied to the outer container. Defaults to full viewport. */
  heightClass?: string;
  /** Cap on tile pyramid LOD. Lower = fewer/blurrier tiles. Default: use the data's max. */
  maxTileLod?: number;
}

export default function InteractiveMap({
  embed = false,
  initialLayers,
  allowedLayers,
  heightClass,
  maxTileLod,
}: InteractiveMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  // Coord readout uses an imperative ref + textContent update instead of
  // useState so mousemove doesn't trigger a full React re-render (which would
  // reconcile every marker layer 60-120×/sec). Biggest single perf win here.
  const coordsRef = useRef<HTMLDivElement | null>(null);
  // Embed ctrl-to-zoom hint (Google Maps style). Shows briefly when the user
  // scrolls over the embed without holding ctrl/meta.
  const [ctrlHintVisible, setCtrlHintVisible] = useState(false);
  const ctrlHintTimerRef = useRef<number | null>(null);
  // Embed sidebar: per-category expansion state (all collapsed by default).
  const [embedExpanded, setEmbedExpanded] = useState<Record<string, boolean>>({});
  const [atlasCal, setAtlasCal] = useState<AtlasCalibration>(DEFAULT_ATLAS_CALIBRATION);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [atlasEdit, setAtlasEdit] = useState(false);
  // Nudge step for fine atlas calibration (world units). User picks 1/10/100/1k.
  const [calStep, setCalStep] = useState<number>(100);
  // Live scale slider: value is "world units to add to every edge" since the
  // last drag started. Resets to 0 on release, so each drag is an independent
  // nudge that bakes into atlasCal.
  const [scaleSliderVal, setScaleSliderVal] = useState(0);
  const scaleSliderPrevRef = useRef(0);
  const [pinningLandmark, setPinningLandmark] = useState<string | null>(null);
  const [landmarkPins, setLandmarkPins] = useState<Record<string, { u: number; v: number }>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<LayerGroup, boolean>>({
    collectibles: false,
    locations: false,
    gathering: false,
    services: false,
    mobs: false,
    world: false,
  });
  // Per-layer expanded-subtypes state and the set of hidden subtype titles.
  // `hiddenSubtypes['mining']` = Set of "Iron Deposit", "Silver Deposit", etc. that are hidden.
  const [expandedSubtypes, setExpandedSubtypes] = useState<Record<string, boolean>>({});
  // Same hydration-safety pattern as `layers` above: synchronous init returns
  // the same value on server and client, then a post-mount effect merges the
  // user's persisted prefs from localStorage.
  const [hiddenSubtypes, setHiddenSubtypes] = useState<Record<string, Set<string>>>(() => {
    if (embed) {
      const out: Record<string, Set<string>> = {};
      for (const cat of ['mining', 'harvesting', 'logging']) {
        const subtypes = SUBTYPES_BY_CATEGORY[cat] ?? [];
        if (cat === 'mining' && subtypes.includes('Iron Deposit')) {
          out[cat] = new Set(subtypes.filter((t) => t !== 'Iron Deposit'));
        } else {
          out[cat] = new Set(subtypes);
        }
      }
      return out;
    }
    return {};
  });

  useEffect(() => {
    if (embed) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('chronoMap.hiddenSubtypes');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      const out: Record<string, Set<string>> = {};
      for (const k of Object.keys(parsed)) out[k] = new Set(parsed[k]);
      setHiddenSubtypes(out);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Live-tunable POI icon size (debug slider at the bottom of the sidebar).
  const [poiIconPx, setPoiIconPx] = useState<number>(DEFAULT_POI_ICON_PX);
  // Viewport size (CSS pixels of the map container) — used for tile LOD selection + culling.
  const [viewport, setViewport] = useState({ w: MAP_WIDTH, h: MAP_HEIGHT });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewport({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (embed) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(ATLAS_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.worldMinX === 'number') {
          setAtlasCal({ ...DEFAULT_ATLAS_CALIBRATION, ...parsed });
        }
        if (parsed && parsed.__pins) setLandmarkPins(parsed.__pins);
      }
    } catch {}
  }, [embed]);

  useEffect(() => {
    if (embed) return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          ATLAS_STORAGE_KEY,
          JSON.stringify({ ...atlasCal, __pins: landmarkPins }),
        );
      }
    } catch {}
  }, [atlasCal, landmarkPins, embed]);

  // Index distinct POI titles per category (for subtype filter dropdowns).
  // Each entry lists titles sorted by descending occurrence count.
  const subtypeIndex = useMemo(() => {
    const bucket: Record<string, Map<string, number>> = {};
    for (const p of PROP_POIS) {
      const t = p.title?.trim();
      if (!t) continue;
      if (!bucket[p.category]) bucket[p.category] = new Map();
      bucket[p.category].set(t, (bucket[p.category].get(t) ?? 0) + 1);
    }
    const out: Record<string, { title: string; count: number }[]> = {};
    for (const [cat, map] of Object.entries(bucket)) {
      out[cat] = Array.from(map.entries())
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    }
    return out;
  }, []);

  const atlasRect = useMemo(() => {
    const topLeft = worldToScreen(atlasCal.worldMinX, atlasCal.worldMinY);
    const bottomRight = worldToScreen(atlasCal.worldMaxX, atlasCal.worldMaxY);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [atlasCal]);

  // Landmarks the user can pin to the atlas image. Pick visually distinctive,
  // widely-spread WarpPoints.
  const LANDMARK_OPTIONS = useMemo(() => {
    const wanted = ['The Citadel', 'Soroma Stronghold', "Santove's Discovery", 'Dawn Slope Settlement', 'Brackley Altar', 'Murkwater Fishing Spot', 'Shady Lot', 'Mongrel Lair'];
    return wanted
      .map((n) => WARP_POIS.find((w) => w.name === n))
      .filter((w): w is NonNullable<typeof w> => !!w);
  }, []);

  const refitFromLandmarks = useCallback((pins: Record<string, { u: number; v: number }>) => {
    const pairs = LANDMARK_OPTIONS
      .filter((l) => pins[l.name])
      .map((l) => ({ world: { x: l.x, y: l.y }, uv: pins[l.name] }));
    if (pairs.length >= 2) {
      const fitted = solveAtlasFromLandmarks(pairs);
      if (fitted) setAtlasCal(fitted);
    }
  }, [LANDMARK_OPTIONS]);
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonMarker | null>(null);
  // Initial layer state must match between server and client to avoid React
  // hydration mismatches. Read defaults synchronously here, then merge any
  // persisted values from localStorage in a post-mount effect.
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(() => {
    const init: Record<string, boolean> = {};
    LAYERS.forEach((l) => (init[l.key] = l.defaultOn));
    if (embed) {
      for (const k of Object.keys(init)) init[k] = false;
      if (allowedLayers) {
        for (const k of allowedLayers) init[k] = true;
      }
    }
    if (initialLayers) {
      for (const [k, v] of Object.entries(initialLayers)) {
        if (k in init) init[k] = !!v;
      }
    }
    return init as Record<LayerKey, boolean>;
  });

  useEffect(() => {
    if (embed) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('chronoMap.layers');
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setLayers((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(saved)) if (k in next) (next as Record<string, boolean>)[k] = saved[k];
        return next;
      });
    } catch {
      // ignore malformed persisted state
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (embed) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('chronoMap.layers', JSON.stringify(layers));
    } catch {
      // storage full or disabled — silently drop
    }
  }, [layers, embed]);

  useEffect(() => {
    if (embed) return;
    if (typeof window === 'undefined') return;
    try {
      const serial: Record<string, string[]> = {};
      for (const k of Object.keys(hiddenSubtypes)) serial[k] = Array.from(hiddenSubtypes[k]);
      window.localStorage.setItem('chronoMap.hiddenSubtypes', JSON.stringify(serial));
    } catch {
      // ignore
    }
  }, [hiddenSubtypes, embed]);
  const [searchQuery, setSearchQuery] = useState('');
  // Multi-select spotlight: Sets of monster IDs and NPC character IDs that
  // should be drawn with gold/sky halos on top of the regular layers. Driven
  // by the popup panels in the sidebar, by the ?monster=/?monsters= deep
  // links, and by clicking individual NPC dots on the map.
  const [highlightEnemyIds, setHighlightEnemyIds] = useState<Set<number>>(() => new Set());
  const highlightSpawns = useMemo(() => {
    if (highlightEnemyIds.size === 0) return null;
    const out = MONSTER_POIS.filter((m) => highlightEnemyIds.has(m.monsterId));
    return out.length > 0 ? out : null;
  }, [highlightEnemyIds]);
  const highlightSummaries = useMemo(() => {
    if (highlightEnemyIds.size === 0) return [];
    return getMonsterSummaries().filter((m) => highlightEnemyIds.has(m.monsterId));
  }, [highlightEnemyIds]);

  // Visible SVG rect in world-to-screen (pre-zoom) coords. Every culled layer
  // shares this so each only needs a margin adjustment. Recomputes on
  // pan/zoom/viewport only — not on mousemove (coord readout is imperative).
  const visRect = useMemo(() => ({
    minSx: -pan.x / zoom,
    maxSx: (viewport.w - pan.x) / zoom,
    minSy: -pan.y / zoom,
    maxSy: (viewport.h - pan.y) / zoom,
  }), [pan, zoom, viewport]);

  // Pre-bucket MONSTER_POIS by grade once — avoids running three 12k-row
  // filters on every render when normal/elite/boss layers are toggled.
  const monsterBuckets = useMemo(() => {
    const normal: typeof MONSTER_POIS = [];
    const elite: typeof MONSTER_POIS = [];
    const bosses: typeof MONSTER_POIS = [];
    for (const m of MONSTER_POIS) {
      if (m.grade === 'Normal') normal.push(m);
      else if (m.grade === 'Elite') elite.push(m);
      else if (m.grade.endsWith('Boss')) bosses.push(m);
    }
    return { normal, elite, bosses };
  }, []);

  // Enemies / NPCs sidebar popouts — name search + click-to-spotlight. The
  // mob tier layers (bosses/elite/normal) and the npcs layer are hidden from
  // the top-level sidebar list and rendered inside these popouts instead.
  const [enemiesOpen, setEnemiesOpen] = useState(false);
  const [npcsOpen, setNpcsOpen] = useState(false);
  const [enemySearch, setEnemySearch] = useState('');
  const [npcSearch, setNpcSearch] = useState('');
  const [enemyTab, setEnemyTab] = useState<'all' | 'Boss' | 'Elite' | 'Normal'>('all');
  const enemySearchLower = enemySearch.trim().toLowerCase();
  const npcSearchLower = npcSearch.trim().toLowerCase();
  // Group rows: collapse same-name same-grade enemies (and same-name NPCs)
  // so the picker shows one entry per logical creature, not per data id.
  // Search overrides the tier tab — if anything is typed, ignore the tab.
  const enemyMatches = useMemo(() => {
    const groups = getMonsterGroups();
    if (enemySearchLower) {
      return groups.filter((g) => g.name.toLowerCase().includes(enemySearchLower)).slice(0, 200);
    }
    if (enemyTab === 'Boss') return groups.filter((g) => g.grade.endsWith('Boss')).slice(0, 200);
    if (enemyTab === 'Elite') return groups.filter((g) => g.grade === 'Elite').slice(0, 200);
    if (enemyTab === 'Normal') return groups.filter((g) => g.grade === 'Normal').slice(0, 200);
    return groups.slice(0, 200);
  }, [enemySearchLower, enemyTab]);
  const npcMatches = useMemo(() => {
    const groups = getNpcGroups();
    if (!npcSearchLower) return groups.slice(0, 80);
    return groups.filter((g) => g.name.toLowerCase().includes(npcSearchLower)).slice(0, 80);
  }, [npcSearchLower]);

  // NPC multi-select spotlight — mirrors the enemy spotlight.
  const [highlightNpcIds, setHighlightNpcIds] = useState<Set<number>>(() => new Set());
  const highlightNpcSpawns = useMemo(() => {
    if (highlightNpcIds.size === 0) return null;
    const out = NEIGHBOR_POIS.filter((n) => highlightNpcIds.has(n.characterId));
    return out.length > 0 ? out : null;
  }, [highlightNpcIds]);
  const highlightNpcSummaries = useMemo(() => {
    if (highlightNpcIds.size === 0) return [];
    return getNpcSummaries().filter((n) => highlightNpcIds.has(n.characterId));
  }, [highlightNpcIds]);

  // Sync the highlight Sets to the URL via a post-render effect. Calling
  // history.replaceState inline from a state-updater would dispatch a Next
  // router action during render, which React 19 treats as an error. Skip the
  // very first effect tick so we don't wipe the URL the deep-link parser is
  // about to read.
  const highlightInitRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!highlightInitRef.current) {
      highlightInitRef.current = true;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('monster');
    url.searchParams.delete('monsters');
    url.searchParams.delete('npc');
    url.searchParams.delete('npcs');
    if (highlightEnemyIds.size === 1) url.searchParams.set('monster', String([...highlightEnemyIds][0]));
    else if (highlightEnemyIds.size > 1) url.searchParams.set('monsters', [...highlightEnemyIds].join(','));
    if (highlightNpcIds.size === 1) url.searchParams.set('npc', String([...highlightNpcIds][0]));
    else if (highlightNpcIds.size > 1) url.searchParams.set('npcs', [...highlightNpcIds].join(','));
    window.history.replaceState({}, '', url.toString());
  }, [highlightEnemyIds, highlightNpcIds]);

  const toggleEnemyHighlight = useCallback((id: number) => {
    setHighlightEnemyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const toggleNpcHighlight = useCallback((id: number) => {
    setHighlightNpcIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  // Group-aware toggles: ticking a row flips every underlying id together.
  // If all ids are already picked → remove all; otherwise → add all.
  const toggleEnemyGroupHighlight = useCallback((ids: number[]) => {
    setHighlightEnemyIds((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }, []);
  const toggleNpcGroupHighlight = useCallback((ids: number[]) => {
    setHighlightNpcIds((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }, []);
  const clearAllHighlights = useCallback(() => {
    setHighlightEnemyIds(new Set());
    setHighlightNpcIds(new Set());
  }, []);

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const results: { name: string; x: number; y: number; type: string }[] = [];
    WARP_POIS.forEach((w) => {
      if (w.name.toLowerCase().includes(q)) results.push({ name: w.name, x: w.x, y: w.y, type: w.type === 'boundStone' ? 'Bound Stone' : 'Warp' });
    });
    RETURN_POIS.forEach((r) => {
      if (r.name.toLowerCase().includes(q)) results.push({ name: r.name, x: r.x, y: r.y, type: r.type || 'Inn' });
    });
    RESPAWN_POIS.forEach((r) => {
      if (r.name.toLowerCase().includes(q) && r.name !== 'Resurrection') results.push({ name: r.name, x: r.x, y: r.y, type: 'Respawn' });
    });
    NEIGHBOR_POIS.forEach((n) => {
      if (n.name && n.name.toLowerCase().includes(q)) results.push({ name: n.name, x: n.x, y: n.y, type: 'NPC' });
    });
    MONSTER_POIS.forEach((m) => {
      if (m.name.toLowerCase().includes(q)) results.push({ name: m.name, x: m.x, y: m.y, type: m.grade });
    });
    SECTION_MARKERS.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) results.push({ name: s.name, x: 0, y: 0, type: 'Section' });
    });
    DUNGEON_MARKERS.forEach((d) => {
      if (d.name.toLowerCase().includes(q)) results.push({ name: d.name, x: 0, y: 0, type: d.type });
    });
    return results.slice(0, 15);
  }, [searchQuery]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Embed mode: Google-Maps-style ctrl-to-zoom. Without ctrl/meta, let the
      // page scroll through the map, and flash a hint. With ctrl/meta, prevent
      // the page scroll and zoom the map as usual.
      if (embed && !(e.ctrlKey || e.metaKey)) {
        setCtrlHintVisible(true);
        if (ctrlHintTimerRef.current) window.clearTimeout(ctrlHintTimerRef.current);
        ctrlHintTimerRef.current = window.setTimeout(() => setCtrlHintVisible(false), 1200);
        return;
      }
      e.preventDefault();
      if (atlasEdit) {
        // Scroll resize respects the user's selected calibration step.
        // Each tick expands/shrinks every edge by `calStep` world units, so
        // drop `Step` to 1/10 for sub-unit precision, or 1k for coarse work.
        // Modifier keys lock to a single axis: Shift = X only, Alt = Y only.
        const dir = e.deltaY > 0 ? -1 : 1;
        const xOnly = e.shiftKey && !e.altKey;
        const yOnly = e.altKey && !e.shiftKey;
        const dx = xOnly || !yOnly ? dir * calStep : 0;
        const dy = yOnly || !xOnly ? dir * calStep : 0;
        setAtlasCal((c) => {
          const cx = (c.worldMinX + c.worldMaxX) / 2;
          const cy = (c.worldMinY + c.worldMaxY) / 2;
          const wx = c.worldMaxX - c.worldMinX + dx * 2;
          const wy = c.worldMaxY - c.worldMinY + dy * 2;
          return {
            worldMinX: cx - wx / 2,
            worldMaxX: cx + wx / 2,
            worldMinY: cy - wy / 2,
            worldMaxY: cy + wy / 2,
          };
        });
        return;
      }
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.5), 50);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const scale = newZoom / zoom;
        setPan({ x: cx - (cx - pan.x) * scale, y: cy - (cy - pan.y) * scale });
      }
      setZoom(newZoom);
    },
    [zoom, pan, atlasEdit, embed],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Landmark pinning: click records the cursor's position relative to the atlas rect (UV in 0..1).
      if (pinningLandmark) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = (e.clientX - rect.left - pan.x) / zoom;
        const sy = (e.clientY - rect.top - pan.y) / zoom;
        const u = (sx - atlasRect.x) / atlasRect.width;
        const v = (sy - atlasRect.y) / atlasRect.height;
        const next = { ...landmarkPins, [pinningLandmark]: { u, v } };
        setLandmarkPins(next);
        refitFromLandmarks(next);
        setPinningLandmark(null);
        return;
      }
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      if (atlasEdit) {
        setPanStart({ x: (atlasCal.worldMinX + atlasCal.worldMaxX) / 2, y: (atlasCal.worldMinY + atlasCal.worldMaxY) / 2 });
      } else {
        setPanStart(pan);
      }
    },
    [pan, zoom, atlasEdit, atlasCal, pinningLandmark, atlasRect, landmarkPins, refitFromLandmarks],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!embed && coordsRef.current) {
        // Imperative readout update — no React state, no re-render.
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const sx = (e.clientX - rect.left - pan.x) / zoom;
          const sy = (e.clientY - rect.top - pan.y) / zoom;
          const w = screenToWorld(sx, sy);
          coordsRef.current.textContent = `X: ${Math.round(w.x).toLocaleString()}  ·  Y: ${Math.round(w.y).toLocaleString()}`;
        }
      }
      if (!isDragging) return;
      if (atlasEdit) {
        const dx = (e.clientX - dragStart.x) / zoom / SCALE;
        const dy = (e.clientY - dragStart.y) / zoom / SCALE;
        setAtlasCal((c) => {
          const wx = c.worldMaxX - c.worldMinX;
          const wy = c.worldMaxY - c.worldMinY;
          const newCx = (panStart.x as number) + dx;
          const newCy = (panStart.y as number) - dy;
          return {
            worldMinX: newCx - wx / 2,
            worldMaxX: newCx + wx / 2,
            worldMinY: newCy - wy / 2,
            worldMaxY: newCy + wy / 2,
          };
        });
        return;
      }
      setPan({ x: panStart.x + (e.clientX - dragStart.x), y: panStart.y + (e.clientY - dragStart.y) });
    },
    [isDragging, dragStart, panStart, pan, zoom, atlasEdit, embed],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Zoom by a factor, centred on the viewport centre. Used by the embed +/- buttons.
  const zoomBy = useCallback((factor: number) => {
    const newZoom = Math.min(Math.max(zoom * factor, 0.5), 50);
    if (newZoom === zoom) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const scale = newZoom / zoom;
      setPan({ x: cx - (cx - pan.x) * scale, y: cy - (cy - pan.y) * scale });
    }
    setZoom(newZoom);
  }, [zoom, pan]);

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleCenterOn = useCallback((wx: number, wy: number) => {
    const screen = worldToScreen(wx, wy);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newZoom = 2;
    setPan({ x: rect.width / 2 - screen.x * newZoom, y: rect.height / 2 - screen.y * newZoom });
    setZoom(newZoom);
    setSearchQuery('');
  }, []);

  // Deep-link support: /map?category=mining&subtype=Iron%20Deposit filters the
  // map to that one gathering subtype and pans/zooms to fit its cluster.
  // Runs once on mount; embed mode ignores it (embed pages set their own state).
  useEffect(() => {
    if (embed) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    // /map?monster=<id>, ?monsters=a,b,c, ?npc=<id>, ?npcs=a,b,c — spotlight
    // those ids and fit the camera to the union of every selected spawn.
    const parseIds = (raw: string | null): number[] => {
      if (!raw) return [];
      return raw.split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    };
    const enemyIds = [...parseIds(params.get('monster')), ...parseIds(params.get('monsters'))];
    const npcIds = [...parseIds(params.get('npc')), ...parseIds(params.get('npcs'))];
    const unionSpawns: { x: number; y: number }[] = [];
    if (enemyIds.length > 0) {
      const set = new Set(enemyIds);
      setHighlightEnemyIds(set);
      for (const m of MONSTER_POIS) if (set.has(m.monsterId)) unionSpawns.push({ x: m.x, y: m.y });
    }
    if (npcIds.length > 0) {
      const set = new Set(npcIds);
      setHighlightNpcIds(set);
      for (const n of NEIGHBOR_POIS) if (set.has(n.characterId)) unionSpawns.push({ x: n.x, y: n.y });
    }
    if (unionSpawns.length > 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        let sumX = 0, sumY = 0;
        let minSX = Infinity, minSY = Infinity, maxSX = -Infinity, maxSY = -Infinity;
        for (const p of unionSpawns) {
          const s = worldToScreen(p.x, p.y);
          sumX += s.x; sumY += s.y;
          if (s.x < minSX) minSX = s.x;
          if (s.x > maxSX) maxSX = s.x;
          if (s.y < minSY) minSY = s.y;
          if (s.y > maxSY) maxSY = s.y;
        }
        const cx = sumX / unionSpawns.length;
        const cy = sumY / unionSpawns.length;
        const spanX = Math.max(1, maxSX - minSX);
        const spanY = Math.max(1, maxSY - minSY);
        const pad = 140;
        const fit = Math.min((rect.width - pad * 2) / spanX, (rect.height - pad * 2) / spanY);
        const newZoom = Math.min(Math.max(fit, 1.2), 8);
        setZoom(newZoom);
        setPan({ x: rect.width / 2 - cx * newZoom, y: rect.height / 2 - cy * newZoom });
      }
    }

    const subtype = params.get('subtype');
    const category = params.get('category') as 'mining' | 'harvesting' | 'logging' | null;
    if (!subtype || !category) return;
    const subtypes = SUBTYPES_BY_CATEGORY[category] ?? [];
    if (!subtypes.includes(subtype)) return;
    const pois = POIS_BY_CATEGORY_SUBTYPE[category]?.[subtype] ?? [];
    if (pois.length === 0) return;

    // Turn on only this gathering category; hide every subtype except the target.
    setLayers((p) => ({
      ...p,
      mining: category === 'mining',
      harvesting: category === 'harvesting',
      logging: category === 'logging',
    }));
    setHiddenSubtypes((p) => ({
      ...p,
      [category]: new Set(subtypes.filter((t) => t !== subtype)),
    }));
    // Open the matching subtype dropdown in the sidebar so the user lands on
    // the filter they arrived by and can tweak it. LayerKey === subtypeCategory
    // for the three gathering layers, so we can key directly by category.
    setExpandedSubtypes((p) => ({ ...p, [category]: true }));
    // Collapse every group except gathering so the focused filter is the only
    // thing visible in the sidebar on arrival.
    setCollapsedGroups({
      collectibles: true,
      locations: true,
      gathering: false,
      services: true,
      mobs: true,
      world: true,
    });

    // Fit the cluster: pan to its screen-space centre, zoom so it fills the
    // viewport with padding. Clamped to the same 0.5–50 range as wheel zoom.
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let sumX = 0, sumY = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pois) {
      const s = worldToScreen(p.x, p.y);
      sumX += s.x; sumY += s.y;
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const cx = sumX / pois.length;
    const cy = sumY / pois.length;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const pad = 120;
    const fitZoom = Math.min((rect.width - pad * 2) / spanX, (rect.height - pad * 2) / spanY);
    const newZoom = Math.min(Math.max(fitZoom, 1), 10);
    setZoom(newZoom);
    setPan({ x: rect.width / 2 - cx * newZoom, y: rect.height / 2 - cy * newZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settlements = WARP_POIS.filter((w) => w.type === 'warp');
  const warpPoints = WARP_MARKERS.filter((w) => w.warpType === 'warp');
  const boundStones = [
    ...WARP_POIS.filter((w) => w.type === 'boundStone').map((w) => ({ id: `w${w.id}`, x: w.x, y: w.y, name: w.name })),
    ...PROP_POIS.filter((p) => p.category === 'boundStoneExtra').map((p) => ({ id: `p${p.propId}`, x: p.x, y: p.y, name: 'Bound Stone' })),
  ];

  const rootHeightClass = heightClass ?? 'h-[calc(100dvh-90px)]';
  const embedSidebarLayers = embed
    ? LAYERS.filter((l) => (!allowedLayers || allowedLayers.includes(l.key)) && l.subtypeCategory)
    : [];

  return (
    <div className={`flex ${rootHeightClass} overflow-hidden`}>
      {/* Embed sidebar — collapsed category accordions with 2-col tick boxes,
          mirroring the main /map sidebar pattern. */}
      {embed && embedSidebarLayers.length > 0 && (
        <div className="w-[300px] shrink-0 bg-[#262626] border-r border-accent-gold-dim flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {embedSidebarLayers.map((l) => {
              const cat = l.subtypeCategory!;
              const subtypes = SUBTYPES_BY_CATEGORY[cat] ?? [];
              const byTitle = POIS_BY_CATEGORY_SUBTYPE[cat];
              const hidden = hiddenSubtypes[cat] ?? new Set<string>();
              const activeCount = subtypes.length - hidden.size;
              const expanded = !!embedExpanded[l.key];
              const setAll = (visible: boolean) => {
                setHiddenSubtypes((p) => ({
                  ...p,
                  [cat]: visible ? new Set<string>() : new Set(subtypes),
                }));
              };
              const toggleOne = (title: string) => {
                setHiddenSubtypes((p) => {
                  const curr = new Set(p[cat] ?? new Set(subtypes));
                  if (curr.has(title)) curr.delete(title);
                  else curr.add(title);
                  return { ...p, [cat]: curr };
                });
              };
              return (
                <div key={l.key}>
                  <button
                    onClick={() => setEmbedExpanded((p) => ({ ...p, [l.key]: !p[l.key] }))}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-sm text-left text-white transition-colors ${
                      expanded ? 'border-accent-gold bg-accent-gold/10' : 'border-accent-gold/40 hover:border-accent-gold-dim'
                    }`}
                  >
                    {l.iconPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.iconPath} alt="" width={20} height={20} className={activeCount > 0 ? '' : 'opacity-40'} />
                    )}
                    <span className="truncate">{l.label}</span>
                    <span className="ml-auto text-xs text-text-muted shrink-0">{activeCount}/{subtypes.length}</span>
                    <span className="text-accent-gold text-base font-bold shrink-0">{expanded ? '▾' : '▸'}</span>
                  </button>
                  {expanded && (
                    <div className="mt-1 mb-2 ml-1 border-l border-accent-gold/40 pl-2">
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-white mb-1.5">
                        <span className="truncate">Subtypes</span>
                        <button onClick={() => setAll(true)} className="ml-auto px-2 py-0.5 rounded border border-accent-gold-dim text-white hover:border-accent-gold hover:bg-dark-surface/60">All</button>
                        <button onClick={() => setAll(false)} className="px-2 py-0.5 rounded border border-accent-gold-dim text-white hover:border-accent-gold hover:bg-dark-surface/60">None</button>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto pr-1">
                        {subtypes.map((t) => {
                          const shown = !hidden.has(t);
                          const count = byTitle ? byTitle[t].length : 0;
                          return (
                            <button
                              key={t}
                              onClick={() => toggleOne(t)}
                              className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors text-white ${
                                shown ? 'hover:bg-dark-surface/60' : 'opacity-50 hover:opacity-80'
                              }`}
                              title={`${t} (${count})`}
                            >
                              <span
                                className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ${
                                  shown ? 'bg-accent-gold/20 border-accent-gold' : 'border-accent-gold/40'
                                }`}
                              >
                                {shown && (
                                  <svg className="w-3 h-3 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                  </svg>
                                )}
                              </span>
                              {l.iconPath && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={l.iconPath}
                                  alt=""
                                  width={14}
                                  height={14}
                                  className="shrink-0"
                                  style={{ filter: subtypeTint(t) }}
                                />
                              )}
                              <span className="truncate flex-1">{t}</span>
                              <span className="text-[10px] text-text-muted shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Left side panel — hidden in embed mode */}
      {!embed && (
      <div className="w-[400px] shrink-0 bg-[#262626] border-r border-accent-gold-dim flex flex-col min-h-0">
        {/* Search */}
        <div className="p-[14px] border-b border-accent-gold-dim shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border border-accent-gold-dim rounded-lg px-3 py-[7.5px] text-xs text-white placeholder-white/50 focus:outline-none focus:border-accent-gold"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-[#262626] border border-accent-gold-dim rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { if (r.x || r.y) handleCenterOn(r.x, r.y); setSearchQuery(''); }}
                    className="w-full text-left px-[14px] py-2 text-[13px] hover:bg-dark-surface flex items-center justify-between"
                  >
                    <span className="text-white truncate">{r.name}</span>
                    <span className="text-[11px] text-white shrink-0 ml-2">{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-[14px] space-y-6">
          {/* Layers — grouped, 2-column grid with game icons */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setLayers((prev) => {
                  const next = { ...prev };
                  for (const l of LAYERS) next[l.key] = false;
                  return next;
                })}
                className="flex-1 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded border border-accent-gold-dim text-white hover:border-accent-gold"
              >
                Hide All
              </button>
              <button
                onClick={() => setLayers((prev) => {
                  const next = { ...prev };
                  for (const l of LAYERS) next[l.key] = true;
                  return next;
                })}
                className="flex-1 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded border border-accent-gold-dim text-white hover:border-accent-gold"
              >
                Show All
              </button>
            </div>
            {LAYER_GROUPS.map((group) => {
              const groupLayers = LAYERS.filter((l) => l.group === group.id && !CREATURE_POPOUT_KEYS.has(l.key));
              const isCreatures = group.id === 'mobs';
              if (groupLayers.length === 0 && !isCreatures) return null;
              const collapsed = collapsedGroups[group.id];
              return (
                <div key={group.id} className="mb-2">
                  <button
                    onClick={() => setCollapsedGroups((p) => ({ ...p, [group.id]: !p[group.id] }))}
                    className="w-full flex items-center justify-between px-0.5 py-1 text-[11px] uppercase tracking-wider font-medium text-white"
                  >
                    <span>{group.title}</span>
                    <span className="text-[11px]">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && (
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {groupLayers.map((l) => {
                        const on = layers[l.key];
                        const hasSubtypes = !!l.subtypeCategory && (subtypeIndex[l.subtypeCategory]?.length ?? 0) > 0;
                        const subtypes = hasSubtypes ? subtypeIndex[l.subtypeCategory!] : [];
                        const subOpen = hasSubtypes && !!expandedSubtypes[l.key];
                        const hidden = hasSubtypes ? hiddenSubtypes[l.subtypeCategory!] : undefined;
                        const hiddenCount = hidden?.size ?? 0;
                        const activeCount = subtypes.length - hiddenCount;
                        const icon = l.iconPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.iconPath} alt="" width={22} height={22} className={`shrink-0 ${on ? '' : 'opacity-40'}`} />
                        ) : (
                          <span
                            className="shrink-0 w-[22px] h-[22px] rounded-sm border flex items-center justify-center"
                            style={{ borderColor: on ? l.color : '#3a3a4a', backgroundColor: on ? `${l.color}22` : 'transparent' }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color, opacity: on ? 1 : 0.5 }} />
                          </span>
                        );
                        const baseClass = `flex items-center gap-2 px-1.5 py-1 rounded border text-[13px] transition-colors text-left text-white ${
                          on ? 'border-accent-gold bg-accent-gold/10' : 'border-accent-gold/40 hover:border-accent-gold-dim'
                        }`;
                        if (!hasSubtypes) {
                          return (
                            <button key={l.key} onClick={() => toggleLayer(l.key)} className={baseClass} title={l.label}>
                              {icon}
                              <span className="truncate">{l.label}</span>
                            </button>
                          );
                        }
                        // Subtype-aware layer: row spans both columns. Clicking the row
                        // opens/closes the subtype dropdown; per-subtype checkboxes control
                        // individual visibility (no separate master on/off toggle).
                        const activeBorder = subOpen ? 'border-accent-gold bg-accent-gold/10' : 'border-accent-gold/40 hover:border-accent-gold-dim';
                        return (
                          <React.Fragment key={l.key}>
                            <button
                              onClick={() => {
                                const willExpand = !expandedSubtypes[l.key];
                                setExpandedSubtypes((p) => ({ ...p, [l.key]: willExpand }));
                                setLayers((p) => ({ ...p, [l.key]: willExpand }));
                                if (willExpand && hiddenSubtypes[l.subtypeCategory!] === undefined) {
                                  setHiddenSubtypes((p) => ({
                                    ...p,
                                    [l.subtypeCategory!]: new Set(subtypes.map((s) => s.title)),
                                  }));
                                }
                              }}
                              className={`col-span-2 flex items-center gap-2 px-1.5 py-1 rounded border text-[13px] text-left text-white transition-colors ${activeBorder}`}
                              title={l.label}
                            >
                              {icon}
                              <span className="truncate text-[13px]">{l.label}</span>
                              <span className="ml-auto text-[11px] text-white shrink-0">{activeCount}/{subtypes.length}</span>
                              <span className="text-accent-gold text-[17px] font-bold shrink-0 ml-1">{subOpen ? '▾' : '▸'}</span>
                            </button>
                            {subOpen && (() => {
                              const setAll = (visible: boolean) => {
                                setHiddenSubtypes((p) => ({
                                  ...p,
                                  [l.subtypeCategory!]: visible ? new Set<string>() : new Set(subtypes.map((s) => s.title)),
                                }));
                              };
                              const toggleOne = (title: string) => {
                                setHiddenSubtypes((p) => {
                                  const curr = new Set(p[l.subtypeCategory!] ?? []);
                                  if (curr.has(title)) curr.delete(title);
                                  else curr.add(title);
                                  return { ...p, [l.subtypeCategory!]: curr };
                                });
                              };
                              return (
                                <div className="col-span-2 mt-1 mb-1.5 ml-2 border-l border-accent-gold/40 pl-3">
                                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white mb-1.5">
                                    <span className="truncate">{l.label} subtypes</span>
                                    <button onClick={() => setAll(true)} className="ml-auto px-2 py-0.5 rounded border border-accent-gold-dim text-white hover:border-accent-gold hover:bg-dark-surface/60">All</button>
                                    <button onClick={() => setAll(false)} className="px-2 py-0.5 rounded border border-accent-gold-dim text-white hover:border-accent-gold hover:bg-dark-surface/60">None</button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto pr-1">
                                    {subtypes.map((s) => {
                                      const shown = !(hidden?.has(s.title) ?? false);
                                      return (
                                        <button
                                          key={s.title}
                                          onClick={() => toggleOne(s.title)}
                                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] text-left transition-colors text-white ${
                                            shown ? 'hover:bg-dark-surface/60' : 'opacity-50 hover:opacity-80'
                                          }`}
                                          title={`${s.title} (${s.count})`}
                                        >
                                          <span
                                            className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ${
                                              shown ? 'bg-accent-gold/20 border-accent-gold' : 'border-accent-gold/40'
                                            }`}
                                          >
                                            {shown && (
                                              <svg className="w-3 h-3 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                              </svg>
                                            )}
                                          </span>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={CATEGORY_ICON[l.subtypeCategory!]}
                                            alt=""
                                            width={16}
                                            height={16}
                                            className="shrink-0"
                                            style={{ filter: subtypeTint(s.title) }}
                                          />
                                          <span className="truncate flex-1">{s.title}</span>
                                          <span className="text-[10px] text-white shrink-0">{s.count}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                  {!collapsed && isCreatures && (
                    <div className="mt-1 space-y-1">
                      {/* Enemies — click opens the floating popup to pick individual enemies to spotlight. */}
                      {(() => {
                        const anyOn = layers.bosses || layers.eliteMobs || layers.normalMobs;
                        const pickedCount = highlightEnemyIds.size;
                        const activeBorder = enemiesOpen || anyOn || pickedCount > 0 ? 'border-accent-gold bg-accent-gold/10' : 'border-accent-gold/40 hover:border-accent-gold-dim';
                        return (
                          <button
                            onClick={() => setEnemiesOpen((v) => !v)}
                            className={`w-full flex items-center gap-2 px-1.5 py-1 rounded border text-[13px] text-left text-white transition-colors ${activeBorder}`}
                            title="Open enemies picker"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ICON('TX_Icon_Monster_M2.png')} alt="" width={22} height={22} className={anyOn || pickedCount > 0 ? '' : 'opacity-40'} />
                            <span className="truncate">Enemies</span>
                            {pickedCount > 0 && <span className="ml-auto text-[11px] text-accent-gold shrink-0">{pickedCount} picked</span>}
                            {pickedCount === 0 && anyOn && <span className="ml-auto text-[11px] text-text-muted shrink-0">layer on</span>}
                          </button>
                        );
                      })()}
                      {/* NPCs — click opens the floating popup to pick NPCs to spotlight. */}
                      {(() => {
                        const on = layers.npcs;
                        const pickedCount = highlightNpcIds.size;
                        const activeBorder = npcsOpen || on || pickedCount > 0 ? 'border-accent-gold bg-accent-gold/10' : 'border-accent-gold/40 hover:border-accent-gold-dim';
                        return (
                          <button
                            onClick={() => setNpcsOpen((v) => !v)}
                            className={`w-full flex items-center gap-2 px-1.5 py-1 rounded border text-[13px] text-left text-white transition-colors ${activeBorder}`}
                            title="Open NPC picker"
                          >
                            <span
                              className="shrink-0 w-[22px] h-[22px] rounded-sm border flex items-center justify-center"
                              style={{ borderColor: on || pickedCount > 0 ? '#38bdf8' : '#3a3a4a', backgroundColor: on || pickedCount > 0 ? '#38bdf822' : 'transparent' }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#38bdf8', opacity: on || pickedCount > 0 ? 1 : 0.5 }} />
                            </span>
                            <span className="truncate">NPCs</span>
                            {pickedCount > 0 && <span className="ml-auto text-[11px] text-sky-300 shrink-0">{pickedCount} picked</span>}
                            {pickedCount === 0 && on && <span className="ml-auto text-[11px] text-text-muted shrink-0">layer on</span>}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
      )}

      {/* Map canvas — bg colour matches the darkest in-map "sea" tone so the
          frame around the atlas blends with the parchment palette. */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden select-none ${
          pinningLandmark ? 'cursor-crosshair' : atlasEdit ? 'cursor-move' : ''
        }`}
        style={{ backgroundColor: '#413b35' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setTooltip(null);
          if (!embed && coordsRef.current) coordsRef.current.textContent = '';
        }}
      >
        <svg
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(42,42,74,0.3)" strokeWidth="0.5" />
            </pattern>
            <pattern id="gridLarge" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(42,42,74,0.5)" strokeWidth="1" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#413b35" />
          {(() => {
            // Always-mounted low-LOD backdrop. Stays painted across LOD
            // switches in the active layer, so the brief gap when active
            // tiles remount is filled with a slightly blurry version of
            // the same map instead of a black GPU repaint flash.
            // Stable keys (no LOD) — these never unmount.
            const tileRegion = MAP_TILES.setar;
            if (!tileRegion) return null;
            const baseLod = tileRegion.zoomLevels[0];
            const GRID = 1 << baseLod;
            const wxStep = (atlasCal.worldMaxX - atlasCal.worldMinX) / GRID;
            const wyStep = (atlasCal.worldMaxY - atlasCal.worldMinY) / GRID;
            const tiles: React.ReactNode[] = [];
            for (let gy = 0; gy < GRID; gy++) {
              for (let gx = 0; gx < GRID; gx++) {
                const tl = worldToScreen(
                  atlasCal.worldMinX + gx * wxStep,
                  atlasCal.worldMinY + gy * wyStep,
                );
                const br = worldToScreen(
                  atlasCal.worldMinX + (gx + 1) * wxStep,
                  atlasCal.worldMinY + (gy + 1) * wyStep,
                );
                tiles.push(
                  <image
                    key={`base-${gx}-${gy}`}
                    href={`${tileRegion.publicPath}/z${baseLod}/${gx}_${gy}.webp`}
                    x={tl.x}
                    y={tl.y}
                    width={br.x - tl.x}
                    height={br.y - tl.y}
                    preserveAspectRatio="none"
                    opacity={atlasEdit || pinningLandmark ? 0.55 : 0.92}
                  />,
                );
              }
            }
            return <>{tiles}</>;
          })()}
          {(() => {
            // Render the game's tile pyramid as the backdrop.
            // LOD is chosen so that each tile renders at ~source resolution
            // (512 px), and tiles outside the visible SVG region are culled
            // so z5 (1024 tiles total) stays cheap — only ~20-40 load.
            const tileRegion = MAP_TILES.setar;
            if (!tileRegion) return null;
            const availZooms = tileRegion.zoomLevels;
            const dataMaxZ = availZooms[availZooms.length - 1];
            const maxZ = typeof maxTileLod === 'number'
              ? Math.max(0, Math.min(maxTileLod, dataMaxZ))
              : dataMaxZ;
            // Atlas width in SVG units; at user zoom Z each SVG unit = Z screen px.
            const atlasSvgW = atlasRect.width;
            const atlasScreenW = atlasSvgW * zoom;
            // Pick the LOD whose per-tile screen size sits near the source (512 px).
            // log2(atlasScreenW / 512) gives the level where screen_px == source_px.
            const targetLod = Math.log2(Math.max(1, atlasScreenW / 512));
            const lod = Math.max(0, Math.min(maxZ, Math.round(targetLod)));
            const GRID = 1 << lod;
            // Visible SVG rect (inverse of outer `translate(pan) scale(zoom)`).
            const visMinX = -pan.x / zoom;
            const visMaxX = (viewport.w - pan.x) / zoom;
            const visMinY = -pan.y / zoom;
            const visMaxY = (viewport.h - pan.y) / zoom;
            const wxStep = (atlasCal.worldMaxX - atlasCal.worldMinX) / GRID;
            const wyStep = (atlasCal.worldMaxY - atlasCal.worldMinY) / GRID;
            const tiles: React.ReactNode[] = [];
            for (let gy = 0; gy < GRID; gy++) {
              for (let gx = 0; gx < GRID; gx++) {
                const wMinX = atlasCal.worldMinX + gx * wxStep;
                const wMinY = atlasCal.worldMinY + gy * wyStep;
                const wMaxX = wMinX + wxStep;
                const wMaxY = wMinY + wyStep;
                const tl = worldToScreen(wMinX, wMinY);
                const br = worldToScreen(wMaxX, wMaxY);
                // Cull tiles not intersecting the visible SVG region.
                if (br.x < visMinX || tl.x > visMaxX) continue;
                if (br.y < visMinY || tl.y > visMaxY) continue;
                // Overdraw each tile by ~1 screen pixel on every side so
                // floating-point rounding can't leave gaps between neighbours.
                // BLEED is in SVG units, but the container is scaled by `zoom`,
                // so we divide by zoom to keep the overlap at 1 screen pixel
                // regardless of zoom — at high zoom a fixed SVG bleed would
                // visibly double-print content across seams.
                const BLEED = 1 / zoom;
                tiles.push(
                  <image
                    key={`t-${lod}-${gx}-${gy}`}
                    href={`${tileRegion.publicPath}/z${lod}/${gx}_${gy}.webp`}
                    x={tl.x - BLEED}
                    y={tl.y - BLEED}
                    width={br.x - tl.x + BLEED * 2}
                    height={br.y - tl.y + BLEED * 2}
                    preserveAspectRatio="none"
                    opacity={atlasEdit || pinningLandmark ? 0.55 : 0.92}
                  />,
                );
              }
            }
            return <>{tiles}</>;
          })()}
          {(atlasEdit || pinningLandmark) && (
            <rect
              x={atlasRect.x}
              y={atlasRect.y}
              width={atlasRect.width}
              height={atlasRect.height}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          )}

          {/* Landmark pin overlays — connect each pinned landmark's true world position to its pin on the atlas */}
          {calibrateOpen && Object.entries(landmarkPins).map(([name, uv]) => {
            const lm = LANDMARK_OPTIONS.find((l) => l.name === name);
            if (!lm) return null;
            const worldPos = worldToScreen(lm.x, lm.y);
            const pinPos = { x: atlasRect.x + uv.u * atlasRect.width, y: atlasRect.y + uv.v * atlasRect.height };
            return (
              <g key={`pin-${name}`} pointerEvents="none">
                <line x1={worldPos.x} y1={worldPos.y} x2={pinPos.x} y2={pinPos.y} stroke="#34d399" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom} ${3 / zoom}`} opacity={0.7} />
                <circle cx={pinPos.x} cy={pinPos.y} r={5 / zoom} fill="#34d399" opacity={0.95} stroke="#fff" strokeWidth={1 / zoom} />
                <text x={pinPos.x + 7 / zoom} y={pinPos.y - 6 / zoom} fill="#34d399" fontSize={9 / zoom} stroke="#000" strokeWidth={2 / zoom} strokeOpacity={0.7} paintOrder="stroke">{name}</text>
              </g>
            );
          })}

          {/* Dawn Slope Settlement (calibration anchor) */}
          {layers.dawnSlopeOnly && (() => {
            const pos = worldToScreen(DAWN_SLOPE_ANCHOR.x, DAWN_SLOPE_ANCHOR.y);
            return (
              <g key="ds-anchor" pointerEvents="none">
                <circle cx={pos.x} cy={pos.y} r={10} fill="#facc15" opacity={0.25} />
                <circle cx={pos.x} cy={pos.y} r={5} fill="#facc15" stroke="#fde68a" strokeWidth={1} />
                <text x={pos.x + 8} y={pos.y - 6} fill="#facc15" fontSize={10} style={{ fontFamily: 'var(--font-cinzel), serif' }} stroke="#000" strokeWidth={2} strokeOpacity={0.75} paintOrder="stroke">
                  {DAWN_SLOPE_ANCHOR.name}
                </text>
              </g>
            );
          })()}

          {/* Chrono Gates (calibration anchors) */}
          {layers.chronoGates && CHRONO_GATES.map((g, i) => {
            const pos = worldToScreen(g.x, g.y);
            const px = poiIconPx / zoom;
            const half = px / 2;
            return (
              <g key={`cg-${i}`} pointerEvents="none">
                <image
                  href={`${ICON_BASE}/TX_Icon_ChronoGate_M.png`}
                  x={pos.x - half}
                  y={pos.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <text x={pos.x + half + (2 / zoom)} y={pos.y - (2 / zoom)} fill="#c4b5fd" fontSize={10 / zoom} style={{ fontFamily: 'var(--font-cinzel), serif' }} stroke="#000" strokeWidth={2 / zoom} strokeOpacity={0.75} paintOrder="stroke">
                  {g.name}
                </text>
              </g>
            );
          })}

          {/* Region zones */}
          {layers.regionZones && Object.entries(REGION_GROUPS).map(([key, config]) => {
            const points = AREA_LABELS.filter((a) => a.regionGroup === key);
            if (points.length === 0) return null;
            const screenPoints = points.map((p) => worldToScreen(p.x, p.y));
            const cx = screenPoints.reduce((s, p) => s + p.x, 0) / screenPoints.length;
            const cy = screenPoints.reduce((s, p) => s + p.y, 0) / screenPoints.length;
            return (
              <g key={key}>
                <circle cx={cx} cy={cy} r={80} fill={config.color} opacity={0.04} />
                <text x={cx} y={cy - 70} textAnchor="middle" fill={config.color} fontSize="10" style={{ fontFamily: 'var(--font-cinzel), serif' }} opacity={0.6}>{config.name}</text>
              </g>
            );
          })}

          {/* Normal mobs — viewport-culled with a tiny margin. */}
          {layers.normalMobs && monsterBuckets.normal.map((m, i) => {
            const pos = worldToScreen(m.x, m.y);
            if (pos.x < visRect.minSx - 4 || pos.x > visRect.maxSx + 4 || pos.y < visRect.minSy - 4 || pos.y > visRect.maxSy + 4) return null;
            return <circle key={`nm-${i}`} cx={pos.x} cy={pos.y} r={0.75 / zoom} fill="#64748b" opacity={0.55} />;
          })}

          {/* Elite mobs — viewport-culled with icon-size margin. */}
          {layers.eliteMobs && monsterBuckets.elite.map((m, i) => {
            const p = worldToScreen(m.x, m.y);
            const px = (poiIconPx * 0.8) / zoom;
            const half = px / 2;
            if (p.x < visRect.minSx - half || p.x > visRect.maxSx + half || p.y < visRect.minSy - half || p.y > visRect.maxSy + half) return null;
            const hitHalf = half * 1.15;
            return (
              <g
                key={`em-${i}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className="text-red-300 font-medium">{m.name}</div><div className="text-text-muted text-xs">Elite · {m.spawnCount} spawn{m.spawnCount>1?'s':''}</div></div>) });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <image
                  href={`${ICON_BASE}/TX_Icon_Monster_M.png`}
                  x={p.x - half}
                  y={p.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <rect x={p.x - hitHalf} y={p.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
              </g>
            );
          })}

          {/* Bosses — viewport-culled, tier-scaled. */}
          {layers.bosses && monsterBuckets.bosses.map((m, i) => {
            const p = worldToScreen(m.x, m.y);
            const tierScale = m.grade === 'HighBoss' ? 1.35 : m.grade === 'MidBoss' ? 1.15 : 1.0;
            const px = (poiIconPx * tierScale) / zoom;
            const half = px / 2;
            if (p.x < visRect.minSx - half || p.x > visRect.maxSx + half || p.y < visRect.minSy - half || p.y > visRect.maxSy + half) return null;
            const hitHalf = half * 1.15;
            return (
              <g
                key={`bs-${i}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className="text-rose-400 font-medium">{m.name}</div><div className="text-text-muted text-xs">{m.grade.replace('Boss',' Boss')}</div></div>) });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle cx={p.x} cy={p.y} r={half * 1.1} fill="#f43f5e" opacity={0.25} />
                <image
                  href={`${ICON_BASE}/TX_Icon_Monster_M2.png`}
                  x={p.x - half}
                  y={p.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <rect x={p.x - hitHalf} y={p.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
              </g>
            );
          })}

          {/* Hero spawn points — no icon, halved & zoom-normalized */}
          {/* NPCs — round sky-blue pins with a soft halo, viewport-culled.
              Hover → name tooltip. Click → spotlight + pan/zoom to the NPC. */}
          {layers.npcs && NEIGHBOR_POIS.map((n, i) => {
            const p = worldToScreen(n.x, n.y);
            const r = 4.5 / zoom;
            const halo = r * 2.2;
            if (p.x < visRect.minSx - halo || p.x > visRect.maxSx + halo || p.y < visRect.minSy - halo || p.y > visRect.maxSy + halo) return null;
            const name = n.name ?? 'Unnamed NPC';
            return (
              <g
                key={`npc-${i}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    content: (
                      <div>
                        <div className="text-sky-300 font-medium">{name}</div>
                        <div className="text-text-muted text-xs">NPC &middot; click to spotlight</div>
                      </div>
                    ),
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle this NPC into the multi-select set. Only re-fit
                  // the camera when going from "nothing selected" to "one
                  // selected" so subsequent toggles don't yank the view.
                  const wasOnly = highlightNpcIds.size === 0 && highlightEnemyIds.size === 0;
                  toggleNpcHighlight(n.characterId);
                  setTooltip(null);
                  if (wasOnly) {
                    const spawns = NEIGHBOR_POIS.filter((s) => s.characterId === n.characterId);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect && spawns.length > 1) {
                      let sumX = 0, sumY = 0;
                      let minSX = Infinity, minSY = Infinity, maxSX = -Infinity, maxSY = -Infinity;
                      for (const s of spawns) {
                        const pt = worldToScreen(s.x, s.y);
                        sumX += pt.x; sumY += pt.y;
                        if (pt.x < minSX) minSX = pt.x;
                        if (pt.x > maxSX) maxSX = pt.x;
                        if (pt.y < minSY) minSY = pt.y;
                        if (pt.y > maxSY) maxSY = pt.y;
                      }
                      const cx = sumX / spawns.length;
                      const cy = sumY / spawns.length;
                      const spanX = Math.max(1, maxSX - minSX);
                      const spanY = Math.max(1, maxSY - minSY);
                      const pad = 140;
                      const fit = Math.min((rect.width - pad * 2) / spanX, (rect.height - pad * 2) / spanY);
                      const newZoom = Math.min(Math.max(fit, 1.5), 8);
                      setZoom(newZoom);
                      setPan({ x: rect.width / 2 - cx * newZoom, y: rect.height / 2 - cy * newZoom });
                    }
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={halo} fill="#38bdf8" opacity={0.18} />
                <circle cx={p.x} cy={p.y} r={r} fill="#38bdf8" stroke="#e0f2fe" strokeWidth={0.8 / zoom} opacity={0.95} />
                <circle cx={p.x} cy={p.y} r={halo} fill="transparent" />
              </g>
            );
          })}

          {/* Gathering nodes use smaller icons since they're densely placed.
              Each category has a per-title subtype filter (see sidebar).
              Viewport-culled + bucketed: iterate only the visible subtype's
              pre-bucketed array, skip markers outside the visible rect.
              Hover sets the shared tooltip with the node's subtype + category. */}
          {(() => {
            const gatherPx = (poiIconPx * 0.7) / zoom;
            const hitHalf = (gatherPx / 2) * 1.3;
            const visMinSx = -pan.x / zoom;
            const visMaxSx = (viewport.w - pan.x) / zoom;
            const visMinSy = -pan.y / zoom;
            const visMaxSy = (viewport.h - pan.y) / zoom;
            const margin = gatherPx; // include partial-edge markers
            const tooltipColors: Record<'mining' | 'harvesting' | 'logging', string> = {
              mining: 'text-amber-400',
              harvesting: 'text-lime-400',
              logging: 'text-amber-600',
            };
            const renderGather = (cat: 'mining' | 'harvesting' | 'logging', keyPrefix: string) => {
              const byTitle = POIS_BY_CATEGORY_SUBTYPE[cat];
              if (!byTitle) return [];
              const hidden = hiddenSubtypes[cat];
              const subtypes = SUBTYPES_BY_CATEGORY[cat] ?? [];
              const tooltipColor = tooltipColors[cat];
              const subLabel = CATEGORY_LABELS[cat] ?? cat;
              const out: React.ReactNode[] = [];
              for (const title of subtypes) {
                if (hidden && hidden.has(title)) continue;
                const entries = byTitle[title];
                const filter = subtypeTint(title);
                const style = filter ? { filter } : undefined;
                for (let j = 0; j < entries.length; j++) {
                  const p = entries[j];
                  const pos = worldToScreen(p.x, p.y);
                  if (
                    pos.x < visMinSx - margin ||
                    pos.x > visMaxSx + margin ||
                    pos.y < visMinSy - margin ||
                    pos.y > visMaxSy + margin
                  ) continue;
                  out.push(
                    <g
                      key={`${keyPrefix}-${p.propId}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          content: (
                            <div>
                              <div className={`${tooltipColor} font-medium`}>{title}</div>
                              <div className="text-text-muted text-xs">{subLabel}</div>
                            </div>
                          ),
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <image
                        href={CATEGORY_ICON[cat]}
                        x={pos.x - gatherPx / 2}
                        y={pos.y - gatherPx / 2}
                        width={gatherPx}
                        height={gatherPx}
                        opacity={0.85}
                        preserveAspectRatio="xMidYMid meet"
                        style={style}
                      />
                      <rect
                        x={pos.x - hitHalf}
                        y={pos.y - hitHalf}
                        width={hitHalf * 2}
                        height={hitHalf * 2}
                        fill="transparent"
                      />
                    </g>,
                  );
                }
              }
              return out;
            };
            return (
              <>
                {layers.mining && renderGather('mining', 'min')}
                {layers.harvesting && renderGather('harvesting', 'har')}
                {layers.logging && renderGather('logging', 'log')}
              </>
            );
          })()}

          {/* Icon-based POI markers — all sized in screen pixels (divided by zoom) */}
          {(() => {
            const px = poiIconPx / zoom;
            const half = px / 2;
            const hitHalf = half * 1.15; // slightly larger hit area
            const iconMarker = (
              keyId: string,
              pos: { x: number; y: number },
              cat: string,
              tooltipColor: string,
              tooltipLabel: string,
              tooltipSub: string,
            ) => {
              const href = CATEGORY_ICON[cat];
              if (!href) return null;
              return (
                <g
                  key={keyId}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className={`${tooltipColor} font-medium`}>{tooltipLabel}</div><div className="text-text-muted text-xs">{tooltipSub}</div></div>) });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <image
                    href={href}
                    x={pos.x - half}
                    y={pos.y - half}
                    width={px}
                    height={px}
                    preserveAspectRatio="xMidYMid meet"
                  />
                  <rect x={pos.x - hitHalf} y={pos.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
                </g>
              );
            };
            return (
              <>
                {/* Dungeons / Trials */}
                {PROP_POIS.filter((p) => DUNGEON_CATS.has(p.category) && layers[p.category as LayerKey]).map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  const label = p.title ?? CATEGORY_LABELS[p.category] ?? p.category;
                  const sub = `${CATEGORY_LABELS[p.category] ?? p.category}${p.level > 0 ? ` · Lv ${p.level}` : ''}`;
                  return iconMarker(`dg-${i}`, pos, p.category, 'text-fuchsia-300', label, sub);
                })}

                {/* Map Towers */}
                {layers.mapTowers && PROP_POIS.filter((p) => p.category === 'mapTower').map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`mt-${i}`, pos, 'mapTower', 'text-teal-300', p.title ?? 'Map Tower', 'Map Tower');
                })}

                {/* Crafting stations — each subcategory is its own toggle */}
                {PROP_POIS.filter((p) => CRAFTING_CATS.has(p.category) && layers[p.category as LayerKey]).map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  const label = p.title ?? CATEGORY_LABELS[p.category] ?? p.category;
                  return iconMarker(`cr-${i}`, pos, p.category, 'text-yellow-300', label, CATEGORY_LABELS[p.category] ?? p.category);
                })}

                {/* Services (market / storage / kitchen / boards) */}
                {layers.services && PROP_POIS.filter((p) => SERVICE_CATS.has(p.category)).map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  const label = p.title ?? CATEGORY_LABELS[p.category] ?? p.category;
                  return iconMarker(`sv-${i}`, pos, p.category, 'text-sky-300', label, CATEGORY_LABELS[p.category] ?? p.category);
                })}

                {/* Exits */}
                {layers.exits && PROP_POIS.filter((p) => p.category === 'exit').map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`ex-${i}`, pos, 'exit', 'text-slate-300', p.title ?? 'Exit', 'Exit');
                })}

                {/* Time Portals */}
                {layers.timePortals && PROP_POIS.filter((p) => p.category === 'timePortal').map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`tp-${i}`, pos, 'timePortal', 'text-purple-300', p.title ?? 'Time Portal', 'Time Portal');
                })}

                {/* Beacons of Time */}
                {layers.beacons && PROP_POIS.filter((p) => p.category === 'beaconOfTime').map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`bc-${i}`, pos, 'beaconOfTime', 'text-sky-300', p.title ?? 'Beacon of Time', 'Beacon of Time');
                })}

                {/* Wedges of Time */}
                {layers.wedges && PROP_POIS.filter((p) => p.category === 'wedgeOfTime').map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`wd-${i}`, pos, 'wedgeOfTime', 'text-cyan-300', p.title ?? 'Wedge of Time', 'Wedge of Time');
                })}

                {/* Chests & Supply Crates */}
                {layers.chests && PROP_POIS.filter((p) => CHEST_CATS.has(p.category)).map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  const elite = p.category === 'chestElite';
                  return iconMarker(`ch-${i}`, pos, p.category, 'text-yellow-200', p.title ?? 'Chest', elite ? 'Elite Chest' : 'Chest');
                })}

                {/* Puzzles: switches, wells, vaults, pure forms, quest items */}
                {layers.puzzles && PROP_POIS.filter((p) => PUZZLE_CATS.has(p.category)).map((p, i) => {
                  const pos = worldToScreen(p.x, p.y);
                  return iconMarker(`pz-${i}`, pos, p.category, 'text-orange-300', p.title ?? p.category, 'Interactive');
                })}
              </>
            );
          })()}

          {/* Unidentified Corpses — no matching game icon, halved */}
          {layers.corpses && PROP_POIS.filter((p) => p.category === 'corpse').map((p, i) => {
            const pos = worldToScreen(p.x, p.y);
            return <circle key={`co-${i}`} cx={pos.x} cy={pos.y} r={1 / zoom} fill="#9ca3af" opacity={0.55} />;
          })}

          {/* Bound Stones — vertical stone pillar (game's Warp_M icon).
              Note: SealOfTime_M is a round gear, which is the Beacon-of-Time icon. */}
          {layers.boundStones && boundStones.map((w) => {
            const pos = worldToScreen(w.x, w.y);
            const px = poiIconPx / zoom;
            const half = px / 2;
            return (
              <g key={`bs-${w.id}`}>
                <image
                  href={`${ICON_BASE}/TX_Icon_Warp_M.png`}
                  x={pos.x - half}
                  y={pos.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            );
          })}

          {/* Bosses already rendered earlier — but also include HeroSpawnPoints? No, heroes are positional spawners not named bosses; keep separate. */}

          {/* Warp Points (legacy WARP_MARKERS — small subset) */}
          {layers.warpPoints && warpPoints.map((w) => {
            const pos = worldToScreen(w.x, w.y);
            const px = poiIconPx / zoom;
            const half = px / 2;
            const hitHalf = half * 1.15;
            return (
              <g
                key={`wp-${w.id}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className="text-accent-gold font-medium">{w.name}</div><div className="text-text-muted text-xs">Warp Point (legacy)</div></div>) });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <image
                  href={`${ICON_BASE}/TX_Icon_Warp_M.png`}
                  x={pos.x - half}
                  y={pos.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <rect x={pos.x - hitHalf} y={pos.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
                <text x={pos.x} y={pos.y + half + (8 / zoom)} textAnchor="middle" fill="#60a5fa" fontSize={7 / zoom} style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }} opacity={0.8}>{w.name}</text>
              </g>
            );
          })}

          {/* Inns / Return Points */}
          {layers.inns && RETURN_POIS.map((r) => {
            const pos = worldToScreen(r.x, r.y);
            const px = poiIconPx / zoom;
            const half = px / 2;
            const hitHalf = half * 1.15;
            return (
              <g
                key={`inn-${r.id}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className="text-amber-300 font-medium">{r.name}</div><div className="text-text-muted text-xs">{r.type || 'Inn'}</div></div>) });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <image
                  href={`${ICON_BASE}/TX_Icon_Inn_M.png`}
                  x={pos.x - half}
                  y={pos.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <rect x={pos.x - hitHalf} y={pos.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
              </g>
            );
          })}

          {/* Settlements & Warps — full WARP_POIS data (41 entries, minus Bound Stones) */}
          {layers.settlements && WARP_POIS.filter((w) => w.type === 'warp').map((w) => {
            const pos = worldToScreen(w.x, w.y);
            const px = (poiIconPx * 1.3) / zoom; // settlements are landmarks — slightly larger
            const half = px / 2;
            const hitHalf = half * 1.15;
            return (
              <g
                key={`st-full-${w.id}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content: (<div><div className="text-yellow-400 font-medium">{w.name}</div><div className="text-text-muted text-xs">Warp / Safe Zone · ({Math.round(w.x).toLocaleString()}, {Math.round(w.y).toLocaleString()})</div></div>) });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <image
                  href={`${ICON_BASE}/TX_Icon_SettlementWarp_M.png`}
                  x={pos.x - half}
                  y={pos.y - half}
                  width={px}
                  height={px}
                  preserveAspectRatio="xMidYMid meet"
                />
                <rect x={pos.x - hitHalf} y={pos.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
                <text x={pos.x} y={pos.y - half - (4 / zoom)} textAnchor="middle" fill="#fde047" fontSize={10 / zoom} fontWeight="bold" style={{ fontFamily: 'var(--font-cinzel), serif' }} stroke="#000" strokeWidth={3 / zoom} strokeOpacity={0.7} paintOrder="stroke">{w.name}</text>
              </g>
            );
          })}

          {/* Area Labels */}
          {layers.areaLabels && AREA_LABELS.map((a) => {
            const pos = worldToScreen(a.x, a.y);
            const color = REGION_GROUPS[a.regionGroup]?.color || '#e0c068';
            return <text key={`al-${a.id}`} x={pos.x} y={pos.y} textAnchor="middle" fill={color} fontSize="7" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }} opacity={0.7}>{a.name}</text>;
          })}

          {/* NPC spotlight — ?npc=<id> deep link. Sky-blue halo so it's
              visually distinct from the gold monster spotlight. */}
          {highlightNpcSpawns && highlightNpcSpawns.map((n, i) => {
            const p = worldToScreen(n.x, n.y);
            const px = (poiIconPx * 0.75) / zoom;
            const half = px / 2;
            const halo = half * 1.35;
            if (p.x < visRect.minSx - halo || p.x > visRect.maxSx + halo || p.y < visRect.minSy - halo || p.y > visRect.maxSy + halo) return null;
            const hitHalf = half * 1.2;
            return (
              <g
                key={`hl-npc-${i}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    content: (
                      <div>
                        <div className="text-sky-300 font-medium">{n.name ?? 'Unnamed NPC'}</div>
                        <div className="text-text-muted text-xs">
                          NPC &middot; region {n.regionId}
                        </div>
                      </div>
                    ),
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle cx={p.x} cy={p.y} r={half * 1.35} fill="#38bdf8" opacity={0.3} />
                <circle cx={p.x} cy={p.y} r={half * 1.1} fill="none" stroke="#38bdf8" strokeWidth={1.5 / zoom} />
                <circle cx={p.x} cy={p.y} r={half * 0.55} fill="#38bdf8" />
                <rect x={p.x - hitHalf} y={p.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
              </g>
            );
          })}

          {/* Monster spotlight — rendered last so pins sit above every other
              marker layer, with a gold halo so they read instantly. */}
          {highlightSpawns && highlightSpawns.map((m, i) => {
            const p = worldToScreen(m.x, m.y);
            const isBoss = m.grade.endsWith('Boss');
            const isElite = m.grade === 'Elite';
            const tierScale = m.grade === 'HighBoss' ? 1.35 : m.grade === 'MidBoss' ? 1.15 : 1.0;
            const px = (poiIconPx * (isBoss ? tierScale : isElite ? 0.9 : 0.75)) / zoom;
            const half = px / 2;
            const halo = half * 1.35;
            if (p.x < visRect.minSx - halo || p.x > visRect.maxSx + halo || p.y < visRect.minSy - halo || p.y > visRect.maxSy + halo) return null;
            const hitHalf = half * 1.2;
            const iconHref = isBoss
              ? `${ICON_BASE}/TX_Icon_Monster_M2.png`
              : isElite
                ? `${ICON_BASE}/TX_Icon_Monster_M.png`
                : null;
            return (
              <g
                key={`hl-${i}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    content: (
                      <div>
                        <div className="text-accent-gold font-medium">{m.name}</div>
                        <div className="text-text-muted text-xs">
                          {m.grade} &middot; {m.spawnCount} spawn{m.spawnCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    ),
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle cx={p.x} cy={p.y} r={half * 1.35} fill="#c8a84e" opacity={0.25} />
                <circle cx={p.x} cy={p.y} r={half * 1.1} fill="none" stroke="#c8a84e" strokeWidth={1.5 / zoom} />
                {iconHref ? (
                  <image
                    href={iconHref}
                    x={p.x - half}
                    y={p.y - half}
                    width={px}
                    height={px}
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  <circle cx={p.x} cy={p.y} r={half * 0.55} fill="#c8a84e" />
                )}
                <rect x={p.x - hitHalf} y={p.y - hitHalf} width={hitHalf * 2} height={hitHalf * 2} fill="transparent" />
              </g>
            );
          })}

        </svg>

        {/* Tooltip */}
        {tooltip && <MapTooltip x={tooltip.x} y={tooltip.y}>{tooltip.content}</MapTooltip>}

        {/* Zoom +/- buttons (embed only) */}
        {embed && (
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <button
              onClick={() => zoomBy(1.25)}
              aria-label="Zoom in"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-deep-night/85 border border-accent-gold-dim/60 text-white text-xl leading-none shadow-xl backdrop-blur-sm hover:border-accent-gold hover:bg-deep-night transition-colors"
            >
              +
            </button>
            <button
              onClick={() => zoomBy(0.8)}
              aria-label="Zoom out"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-deep-night/85 border border-accent-gold-dim/60 text-white text-xl leading-none shadow-xl backdrop-blur-sm hover:border-accent-gold hover:bg-deep-night transition-colors"
            >
              &minus;
            </button>
          </div>
        )}

        {/* Ctrl-to-zoom hint (embed only) */}
        {embed && (
          <div
            className={`absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity duration-200 ${
              ctrlHintVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="bg-void-black/75 border border-accent-gold-dim rounded-lg px-4 py-2 text-sm text-white shadow-xl">
              Hold <span className="text-accent-gold font-semibold">Ctrl</span> and scroll to zoom
            </div>
          </div>
        )}

        {/* Coordinate readout — textContent written imperatively in handleMouseMove. */}
        {!embed && (
          <div
            ref={coordsRef}
            className="absolute bottom-3 left-3 bg-deep-night/90 border border-border-subtle rounded px-2.5 py-1 font-mono text-[11px] text-accent-gold-dim pointer-events-none min-h-[22px]"
          />
        )}

        {/* Combined spotlight banner — shows enemy + NPC selection counts. */}
        {!embed && (highlightSummaries.length > 0 || highlightNpcSummaries.length > 0) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-deep-night/95 border border-accent-gold rounded-lg shadow-xl text-sm text-white flex items-center gap-3 pl-4 pr-2 py-2 z-30 max-w-[80%]">
            <div className="flex flex-col">
              {highlightSummaries.length === 1 && (
                <span className="text-accent-gold font-medium">
                  {highlightSummaries[0].name}
                  <span className="text-text-muted text-xs font-normal">
                    {' '}&middot; {ENEMY_GRADE_LABELS[highlightSummaries[0].grade] ?? highlightSummaries[0].grade}
                    {(() => {
                      const lv = formatLevelRange(highlightSummaries[0].levelMin, highlightSummaries[0].levelMax);
                      return lv ? <> &middot; {lv}</> : null;
                    })()}
                    {' '}&middot; {highlightSummaries[0].pinCount} location{highlightSummaries[0].pinCount === 1 ? '' : 's'}
                  </span>
                </span>
              )}
              {highlightSummaries.length > 1 && (
                <span className="text-accent-gold font-medium">{highlightSummaries.length} enemies selected</span>
              )}
              {highlightNpcSummaries.length === 1 && (
                <span className="text-sky-300 font-medium">
                  {highlightNpcSummaries[0].name}
                  <span className="text-text-muted text-xs font-normal">
                    {' '}&middot; {highlightNpcSummaries[0].pinCount} location{highlightNpcSummaries[0].pinCount === 1 ? '' : 's'}
                  </span>
                </span>
              )}
              {highlightNpcSummaries.length > 1 && (
                <span className="text-sky-300 font-medium">{highlightNpcSummaries.length} NPCs selected</span>
              )}
            </div>
            {highlightSummaries.length === 1 && highlightNpcSummaries.length === 0 && (
              <a
                href={`/database/monsters/${[...highlightEnemyIds][0]}`}
                className="px-2 py-1 rounded border border-accent-gold-dim text-xs text-accent-gold hover:bg-accent-gold/10"
              >
                Details
              </a>
            )}
            {highlightNpcSummaries.length === 1 && highlightSummaries.length === 0 && (
              <a
                href={`/database/npcs/${[...highlightNpcIds][0]}`}
                className="px-2 py-1 rounded border border-sky-400/60 text-xs text-sky-300 hover:bg-sky-400/10"
              >
                Details
              </a>
            )}
            <button
              onClick={clearAllHighlights}
              aria-label="Clear all spotlights"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-text-muted text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Enemies popup — floating panel for picking enemies via tick boxes. */}
        {!embed && enemiesOpen && (
          <PickerPanel
            title="Enemies"
            color="accent-gold"
            onClose={() => setEnemiesOpen(false)}
            search={enemySearch}
            setSearch={setEnemySearch}
            placeholder="Search enemies..."
            extraHeader={(
              <div className="flex items-center gap-1 text-xs">
                {(['all', 'Boss', 'Elite', 'Normal'] as const).map((tab) => {
                  const active = enemyTab === tab && !enemySearchLower;
                  const muted = !!enemySearchLower;
                  const label = tab === 'all' ? 'All' : tab === 'Boss' ? 'Bosses' : tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => { setEnemyTab(tab); setEnemySearch(''); }}
                      className={`px-2 py-0.5 rounded border transition-colors ${
                        active
                          ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                          : muted
                            ? 'border-white/10 text-text-muted/60'
                            : 'border-accent-gold/40 text-text-muted hover:border-accent-gold-dim'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {enemySearchLower && (
                  <span className="ml-auto text-[10px] text-text-muted italic">search overrides tab</span>
                )}
              </div>
            )}
            onSelectAllVisible={() => {
              const allIds = enemyMatches.flatMap((g) => g.monsterIds);
              if (allIds.length === 0) return;
              setHighlightEnemyIds((prev) => {
                const next = new Set(prev);
                const allOn = allIds.every((id) => next.has(id));
                if (allOn) for (const id of allIds) next.delete(id);
                else for (const id of allIds) next.add(id);
                return next;
              });
            }}
            selectAllLabel={(() => {
              const allIds = enemyMatches.flatMap((g) => g.monsterIds);
              const allOn = allIds.length > 0 && allIds.every((id) => highlightEnemyIds.has(id));
              return allOn ? 'Deselect all' : `Select all (${enemyMatches.length})`;
            })()}
            pickedCount={highlightEnemyIds.size}
            onClearPicks={() => setHighlightEnemyIds(new Set())}
            rows={enemyMatches.map((g) => {
              const color = ENEMY_GRADE_COLORS[g.grade] ?? '#94a3b8';
              const label = ENEMY_GRADE_LABELS[g.grade] ?? g.grade;
              const checked = g.monsterIds.every((id) => highlightEnemyIds.has(id));
              const partial = !checked && g.monsterIds.some((id) => highlightEnemyIds.has(id));
              return (
                <button
                  key={g.key}
                  onClick={() => toggleEnemyGroupHighlight(g.monsterIds)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                    checked || partial ? 'bg-accent-gold/15' : 'hover:bg-dark-surface/60'
                  }`}
                  title={`${g.pinCount} spawn locations${g.monsterIds.length > 1 ? ` across ${g.monsterIds.length} variants` : ''}`}
                >
                  <span
                    className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ${
                      checked ? 'bg-accent-gold/30 border-accent-gold' : partial ? 'bg-accent-gold/15 border-accent-gold/70' : 'border-accent-gold/40'
                    }`}
                  >
                    {checked && (
                      <svg className="w-3 h-3 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                    {partial && <span className="w-2 h-0.5 bg-accent-gold rounded" />}
                  </span>
                  <span className="truncate flex-1 text-white">
                    {g.name}
                    {g.monsterIds.length > 1 && (
                      <span className="text-text-muted ml-1">×{g.monsterIds.length}</span>
                    )}
                  </span>
                  {(() => {
                    const lvLabel = formatLevelRange(g.levelMin, g.levelMax);
                    return lvLabel ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] shrink-0 text-text-muted border border-white/10">
                        {lvLabel}
                      </span>
                    ) : null;
                  })()}
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                    style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0 w-10 text-right" title="Spawn locations">{g.pinCount}</span>
                </button>
              );
            })}
            emptyHint={enemySearchLower ? 'No enemies match.' : 'Type a name to search 1,300+ enemies.'}
          />
        )}

        {/* NPCs popup — floating panel for picking NPCs via tick boxes. */}
        {!embed && npcsOpen && (
          <PickerPanel
            title="NPCs"
            color="sky-400"
            onClose={() => setNpcsOpen(false)}
            search={npcSearch}
            setSearch={setNpcSearch}
            placeholder="Search NPCs..."
            extraHeader={(
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => toggleLayer('npcs')}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    layers.npcs ? 'border-sky-400 bg-sky-400/10 text-sky-300' : 'border-sky-400/40 text-text-muted hover:border-sky-400/70'
                  }`}
                >
                  Show all NPC dots
                </button>
              </div>
            )}
            onSelectAllVisible={() => {
              const allIds = npcMatches.flatMap((g) => g.characterIds);
              if (allIds.length === 0) return;
              setHighlightNpcIds((prev) => {
                const next = new Set(prev);
                const allOn = allIds.every((id) => next.has(id));
                if (allOn) for (const id of allIds) next.delete(id);
                else for (const id of allIds) next.add(id);
                return next;
              });
            }}
            selectAllLabel={(() => {
              const allIds = npcMatches.flatMap((g) => g.characterIds);
              const allOn = allIds.length > 0 && allIds.every((id) => highlightNpcIds.has(id));
              return allOn ? 'Deselect all' : `Select all (${npcMatches.length})`;
            })()}
            pickedCount={highlightNpcIds.size}
            onClearPicks={() => setHighlightNpcIds(new Set())}
            rows={npcMatches.map((g) => {
              const checked = g.characterIds.every((id) => highlightNpcIds.has(id));
              const partial = !checked && g.characterIds.some((id) => highlightNpcIds.has(id));
              return (
                <button
                  key={g.key}
                  onClick={() => toggleNpcGroupHighlight(g.characterIds)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                    checked || partial ? 'bg-sky-400/15' : 'hover:bg-dark-surface/60'
                  }`}
                  title={`${g.pinCount} locations${g.characterIds.length > 1 ? ` across ${g.characterIds.length} variants` : ''}`}
                >
                  <span
                    className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ${
                      checked ? 'bg-sky-400/30 border-sky-400' : partial ? 'bg-sky-400/15 border-sky-400/70' : 'border-sky-400/40'
                    }`}
                  >
                    {checked && (
                      <svg className="w-3 h-3 text-sky-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                    {partial && <span className="w-2 h-0.5 bg-sky-400 rounded" />}
                  </span>
                  <span className="truncate flex-1 text-white">
                    {g.name}
                    {g.characterIds.length > 1 && (
                      <span className="text-text-muted ml-1">×{g.characterIds.length}</span>
                    )}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0 w-10 text-right" title="Locations">{g.pinCount}</span>
                </button>
              );
            })}
            emptyHint={npcSearchLower ? 'No NPCs match.' : 'Type a name to search.'}
          />
        )}

        {/* Pinning prompt */}
        {pinningLandmark && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-accent-gold/95 text-void-black px-4 py-2 rounded shadow-xl text-sm font-medium pointer-events-none">
            Click on the parchment where <span className="font-bold">{pinningLandmark}</span> is drawn
          </div>
        )}


        {/* Dungeon detail overlay */}
        {selectedDungeon && <DungeonPanel dungeon={selectedDungeon} onClose={() => setSelectedDungeon(null)} />}
      </div>
    </div>
  );
}
