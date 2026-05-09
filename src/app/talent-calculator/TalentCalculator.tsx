'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TALENT_DATA,
  CLASS_RESOURCES,
  type WeaponMasteryNode,
  type ClassTalentData,
  type WeaponTree,
} from '@/data/talent-calculator';
import GamePanel from '@/components/GamePanel';

type NodeLevels = Record<number, number>;

const CLASS_SLUG: Record<string, string> = {
  Swordman: 'swordsman',
  Archer: 'ranger',
  Paladin: 'paladin',
  Sorcerer: 'sorcerer',
  Berserker: 'berserker',
  Assassin: 'assassin',
};

const WEAPON_ICON: Record<string, string> = {
  GreatSword: 'TX_ClassIcon_GreatSword',
  LongSword: 'TX_ClassIcon_LongSword',
  DualSwords: 'TX_ClassIcon_DualSwords',
  LongBow: 'TX_ClassIcon_LongBow',
  Crossbows: 'TX_ClassIcon_Crossbows',
  Rapier: 'TX_ClassIcon_Rapier',
  Lance: 'TX_ClassIcon_Lance',
  Halberd: 'TX_ClassIcon_Halberd',
  Mace: 'TX_ClassIcon_Mace',
  Staff: 'TX_ClassIcon_Staff',
  MagicOrb: 'TX_ClassIcon_MagicOrb',
  Spellbook: 'TX_ClassIcon_Spellbook',
  ChainSwords: 'TX_ClassIcon_ChainSwords',
  Hatchets: 'TX_ClassIcon_Hatchets',
  BattleAxe: 'TX_ClassIcon_BattleAxe',
  Sabre: 'TX_ClassIcon_Sabre',
  WristBlades: 'TX_ClassIcon_WristBlades',
  Musket: 'TX_ClassIcon_Musket',
};

const TYPE_LABELS: Record<string, string> = {
  Active: 'Active',
  ActiveEnforce: 'Enhancement',
  Passive: 'Passive',
  PassiveSynergy: 'Synergy',
  SpecialAction: 'Special Move',
};

const RESOURCE_COLORS: Record<string, string> = {
  Rage: '#f87171',
  Vigor: '#4ade80',
  Mana: '#60a5fa',
  Vigor2: '#2dd4bf',
};

const HEXAGON_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

// Grid constants — 7 columns filling the tree panel width
const NODE_SIZE = 65; // px for Active circles
const HEX_SIZE = 55;  // px for hexagons
const COL_SPACING = 115; // center-to-center horizontal
const ROW_SPACING = 105; // center-to-center vertical

// --- URL State ---
function encodeState(classIdx: number, weaponIdx: number, levels: NodeLevels, masterySet: Set<number>): string {
  const lvlPairs = Object.entries(levels).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(',');
  const masteryStr = Array.from(masterySet).join(',');
  const parts: string[] = [`c=${classIdx}`, `w=${weaponIdx}`];
  if (lvlPairs) parts.push(`n=${lvlPairs}`);
  if (masteryStr) parts.push(`m=${masteryStr}`);
  return parts.join('&');
}

function decodeState(search: string) {
  const params = new URLSearchParams(search);
  const classIdx = parseInt(params.get('c') || '0', 10) || 0;
  const weaponIdx = parseInt(params.get('w') || '0', 10) || 0;
  const levels: NodeLevels = {};
  const nStr = params.get('n') || '';
  if (nStr) for (const pair of nStr.split(',')) { const [k, v] = pair.split(':'); if (k && v) levels[Number(k)] = Number(v); }
  const masterySet = new Set<number>();
  const mStr = params.get('m') || '';
  if (mStr) for (const id of mStr.split(',')) { if (id) masterySet.add(Number(id)); }
  return { classIdx, weaponIdx, levels, masterySet };
}

// --- Game Logic ---
function canAllocate(node: WeaponMasteryNode, levels: NodeLevels, weaponNodes: WeaponMasteryNode[]): boolean {
  if (node.maxLevel === 0) return false;
  if ((levels[node.id] || 0) >= node.maxLevel) return false;
  const totalSpent = weaponNodes.reduce((sum, n) => sum + (levels[n.id] || 0), 0);
  if (totalSpent < node.needMasteryLevel) return false;
  if (node.prereq1 && (levels[node.prereq1.id] || 0) < node.prereq1.level) return false;
  if (node.prereq2 && (levels[node.prereq2.id] || 0) < node.prereq2.level) return false;
  return true;
}

// Visual unlock: only checks skill prereqs, NOT mastery level spent.
// Mastery level is a soft gate (handled in canAllocate) — nodes should still
// look selectable/visible even before you've spent enough total points.
function isNodeUnlocked(node: WeaponMasteryNode, levels: NodeLevels, _weaponNodes: WeaponMasteryNode[]): boolean {
  if (node.maxLevel === 0) return true;
  if (node.prereq1 && (levels[node.prereq1.id] || 0) < node.prereq1.level) return false;
  if (node.prereq2 && (levels[node.prereq2.id] || 0) < node.prereq2.level) return false;
  return true;
}

// --- Tooltip (game-style, portals to body so it isn't clipped by the tree's overflow) ---
function NodeTooltip({ node, levels, weaponNodes, resourceName, anchorRect }: {
  node: WeaponMasteryNode; levels: NodeLevels; weaponNodes: WeaponMasteryNode[]; resourceName: string;
  anchorRect: DOMRect;
}) {
  const level = levels[node.id] || 0;
  const prereqInfo: { name: string; current: number; required: number }[] = [];
  if (node.prereq1) {
    const p = weaponNodes.find(n => n.id === node.prereq1!.id);
    if (p) prereqInfo.push({ name: p.name, current: levels[node.prereq1.id] || 0, required: node.prereq1.level });
  }
  if (node.prereq2) {
    const p = weaponNodes.find(n => n.id === node.prereq2!.id);
    if (p) prereqInfo.push({ name: p.name, current: levels[node.prereq2.id] || 0, required: node.prereq2.level });
  }

  const TOOLTIP_W = 280;
  const GAP = 16;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  // Prefer right-of-node; flip to left if it would overflow the viewport.
  const rightX = anchorRect.right + GAP;
  const leftX = anchorRect.left - GAP - TOOLTIP_W;
  const x = rightX + TOOLTIP_W <= window.innerWidth ? rightX : Math.max(8, leftX);

  return createPortal(
    <div
      className="fixed z-[1000] pointer-events-none"
      style={{
        left: x,
        top: anchorCenterY,
        transform: 'translateY(-50%)',
        width: TOOLTIP_W,
        filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.9))',
      }}
    >
      <div style={{
        background: '#2d2d2d',
        border: '1px solid rgba(200,168,78,0.3)',
        borderRadius: 8,
        padding: '14px 16px',
      }}>
        {/* Name + type */}
        <div className="font-heading text-[15px] text-accent-gold leading-tight">{node.name}</div>
        <div className="text-[11px] mt-1" style={{ color: '#e8e8e8' }}>{TYPE_LABELS[node.type]}</div>

        {/* Description */}
        {node.description && (
          <p className="text-[12px] text-text-muted leading-relaxed mt-3" style={{ whiteSpace: 'pre-line' }}>
            {node.description}
          </p>
        )}

        {/* Cooldown + costs */}
        {(node.cooldown > 0 || node.resourceCost > 0 || node.staminaCost > 0 || node.hpCost > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t" style={{ borderColor: 'rgba(200,168,78,0.15)' }}>
            {node.cooldown > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-text-muted">
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <span className="text-text-primary">{node.cooldown}s</span>
              </span>
            )}
            {node.resourceCost > 0 && (
              <span className="text-[11px] text-text-muted">
                {resourceName}: <span style={{ color: RESOURCE_COLORS[resourceName] || '#e0c068' }}>{node.resourceCost}</span>
              </span>
            )}
            {node.staminaCost > 0 && (
              <span className="text-[11px] text-text-muted">Stamina: <span className="text-text-primary">{node.staminaCost}</span></span>
            )}
            {node.hpCost > 0 && (
              <span className="text-[11px] text-text-muted">HP: <span className="text-red-400">{node.hpCost}%</span></span>
            )}
          </div>
        )}

        {/* Level */}
        {node.maxLevel > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t" style={{ borderColor: 'rgba(200,168,78,0.15)' }}>
            <span className="text-[11px] text-text-muted">Level</span>
            <div className="flex gap-0.5 flex-1">
              {Array.from({ length: node.maxLevel }).map((_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-sm" style={{
                  background: i < level ? '#c8a84e' : 'rgba(50,50,50,0.6)',
                }} />
              ))}
            </div>
            <span className="text-[11px] font-bold" style={{ color: level >= node.maxLevel ? '#c8a84e' : '#a8a8bc' }}>
              {level}/{node.maxLevel}
            </span>
          </div>
        )}

        {/* Prerequisites */}
        {(node.needMasteryLevel > 0 || prereqInfo.length > 0) && (
          <div className="mt-3 pt-2 border-t space-y-1" style={{ borderColor: 'rgba(200,168,78,0.15)' }}>
            {node.needMasteryLevel > 0 && (
              <p className="text-[11px] text-text-muted">
                Unlocks at Mastery Level {node.needMasteryLevel}
              </p>
            )}
            {prereqInfo.map((p, i) => (
              <p key={i} className="text-[11px]" style={{ color: '#d97706' }}>
                {p.name} : {p.current}/{p.required}
              </p>
            ))}
          </div>
        )}

        {/* Usage hint */}
        {node.maxLevel > 0 && (
          <p className="text-[10px] mt-3 pt-2 border-t" style={{ borderColor: 'rgba(200,168,78,0.15)', color: 'rgba(168,168,188,0.4)' }}>
            Click to allocate / Right click to remove
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

// --- Node Component ---
function TalentNode({ node, level, unlocked, canLevel, onAllocate, onDeallocate, weaponNodes, levels, resourceName }: {
  node: WeaponMasteryNode; level: number; unlocked: boolean; canLevel: boolean;
  onAllocate: () => void; onDeallocate: () => void;
  weaponNodes: WeaponMasteryNode[]; levels: NodeLevels; resourceName: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isMaxed = level >= node.maxLevel && node.maxLevel > 0;
  const isSpecial = node.type === 'SpecialAction';
  const hasPoints = level > 0;
  const isCircle = node.type === 'Active';
  const size = isCircle ? NODE_SIZE : HEX_SIZE;

  // State-based styling
  const getNodeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: size,
      height: size,
      position: 'relative',
      cursor: isSpecial && node.maxLevel === 0 ? 'default' : canLevel || hasPoints ? 'pointer' : 'default',
    };

    if (isCircle) {
      base.borderRadius = '50%';
      if (isMaxed) {
        base.border = '2px solid #e0c068';
        base.background = 'radial-gradient(circle, rgba(200,168,78,0.25) 0%, rgba(200,168,78,0.08) 100%)';
        base.boxShadow = '0 0 16px rgba(200,168,78,0.4), inset 0 0 12px rgba(200,168,78,0.15)';
      } else if (hasPoints) {
        base.border = '2px solid rgba(224,192,104,0.7)';
        base.background = 'radial-gradient(circle, rgba(200,168,78,0.15) 0%, rgba(200,168,78,0.05) 100%)';
        base.boxShadow = '0 0 10px rgba(200,168,78,0.25)';
      } else if (unlocked) {
        base.border = '2px solid rgba(224,192,104,0.35)';
        base.background = 'rgba(40,40,40,0.4)';
      } else {
        base.border = '2px solid rgba(65,65,65,0.4)';
        base.background = 'rgba(40,40,40,0.3)';
      }
    } else {
      // Hexagon
      base.clipPath = HEXAGON_CLIP;
      if (isMaxed) {
        base.background = 'linear-gradient(180deg, rgba(200,168,78,0.3) 0%, rgba(200,168,78,0.1) 100%)';
      } else if (hasPoints) {
        base.background = 'linear-gradient(180deg, rgba(200,168,78,0.2) 0%, rgba(200,168,78,0.06) 100%)';
      } else if (unlocked) {
        base.background = 'rgba(40,40,40,0.5)';
      } else {
        base.background = 'rgba(45,45,45,0.4)';
      }
    }

    return base;
  };

  // Hexagon border: we need an outer hex with border color, and inner hex with bg
  const getHexBorderColor = (): string => {
    if (isMaxed) return 'rgba(224,192,104,0.8)';
    if (hasPoints) return 'rgba(224,192,104,0.55)';
    if (unlocked) return 'rgba(224,192,104,0.25)';
    return 'rgba(65,65,65,0.35)';
  };

  const iconFilter = (() => {
    if (hasPoints || isMaxed) return 'brightness(1.4) drop-shadow(0 0 4px rgba(224,192,104,0.3))';
    if (isSpecial) return 'brightness(0.9)';
    if (unlocked) return 'brightness(0) invert(1)';
    return 'brightness(0.7) saturate(0)';
  })();

  const opacity = !unlocked && !hasPoints && !isSpecial ? 0.75 : 1;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{ width: size, height: size + 18, opacity }}
      onMouseEnter={() => {
        if (wrapperRef.current) setAnchorRect(wrapperRef.current.getBoundingClientRect());
        setShowTooltip(true);
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* The node button */}
      {isCircle ? (
        <button
          onClick={() => { if (canLevel) onAllocate(); }}
          onContextMenu={(e) => { e.preventDefault(); onDeallocate(); }}
          disabled={isSpecial && node.maxLevel === 0}
          className="flex items-center justify-center transition-all duration-150 hover:brightness-110"
          style={getNodeStyle()}
        >
          {node.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={node.icon} alt=""
              className="object-contain"
              style={{ width: '62%', height: '62%', filter: iconFilter, transition: 'filter 0.15s' }}
            />
          )}
        </button>
      ) : (
        /* Hexagon: outer border hex + inner hex */
        <button
          onClick={() => { if (canLevel) onAllocate(); }}
          onContextMenu={(e) => { e.preventDefault(); onDeallocate(); }}
          disabled={isSpecial && node.maxLevel === 0}
          className="flex items-center justify-center transition-all duration-150"
          style={{
            width: size,
            height: size,
            clipPath: HEXAGON_CLIP,
            background: getHexBorderColor(),
            cursor: isSpecial && node.maxLevel === 0 ? 'default' : canLevel || hasPoints ? 'pointer' : 'default',
            position: 'relative',
          }}
        >
          {/* Inner hex (2px inset for border effect) */}
          <div
            className="flex items-center justify-center"
            style={{
              width: size - 4,
              height: size - 4,
              clipPath: HEXAGON_CLIP,
              ...((() => {
                if (isMaxed) return { background: 'linear-gradient(180deg, rgba(200,168,78,0.3) 0%, rgba(20,18,12,0.95) 100%)' };
                if (hasPoints) return { background: 'linear-gradient(180deg, rgba(200,168,78,0.18) 0%, rgba(45,45,45,0.95) 100%)' };
                if (unlocked) return { background: 'linear-gradient(180deg, rgba(35,35,35,0.8) 0%, rgba(40,40,40,0.95) 100%)' };
                return { background: 'rgba(40,40,40,0.9)' };
              })()),
            }}
          >
            {node.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.icon} alt=""
                className="object-contain"
                style={{ width: '58%', height: '58%', filter: iconFilter, transition: 'filter 0.15s' }}
              />
            )}
          </div>
        </button>
      )}

      {/* Maxed glow for hexagons */}
      {isMaxed && !isCircle && (
        <div style={{
          position: 'absolute',
          top: -4,
          left: -4,
          right: -4,
          bottom: 14,
          clipPath: HEXAGON_CLIP,
          boxShadow: '0 0 20px rgba(200,168,78,0.4)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Level text below node */}
      {node.maxLevel > 0 && (
        <div style={{
          textAlign: 'center',
          marginTop: 2,
          fontSize: 11,
          fontWeight: 600,
          color: isMaxed ? '#e0c068' : hasPoints ? 'rgba(224,192,104,0.8)' : 'rgba(168,168,188,0.4)',
          lineHeight: '14px',
        }}>
          {level}/{node.maxLevel}
        </div>
      )}

      {/* Tooltip — portaled to body so the tree's overflow clipping can't hide it */}
      {showTooltip && anchorRect && (
        <NodeTooltip node={node} levels={levels} weaponNodes={weaponNodes} resourceName={resourceName} anchorRect={anchorRect} />
      )}
    </div>
  );
}

// --- Layout ---
// Positions come from the game widget (WBP_SkillTree_Type6) which every weapon uses.
// MasteryIndex → column is universal across all 18 weapons; only the skill content changes.
// Layout: 3 A-side chain columns | S passives zigzag | 3 B-side chain columns.
// Chains that don't overlap in tiers share a column (A01+A05, A02+A04, B01+B05, B02+B04).
// SpecialAction (MI 0) is rendered separately in the InfoPanel, not in the grid.

const GRID_COL_COUNT = 7;

// MasteryIndex → { col, nudgeX?, nudgeY? }. S-middle passives zigzag left/right in the
// game UI and stagger vertically onto half-rows so pairs sharing a tier don't collide.
const MI_LAYOUT: Record<number, { col: number; nudgeX?: number; nudgeY?: number }> = {
  // Col 0 — A-left (A01 chain + A05 unused)
  1: { col: 0 }, 6: { col: 0 }, 17: { col: 0 },
  30: { col: 0 }, 35: { col: 0 },

  // Col 1 — A-middle (A03 chain)
  13: { col: 1 }, 21: { col: 1 }, 29: { col: 1 },

  // Col 2 — A-inner (A02 chain + A04 chain)
  4: { col: 2 }, 9: { col: 2 }, 18: { col: 2 },
  22: { col: 2 }, 26: { col: 2 }, 34: { col: 2 },

  // Col 3 — S middle (passives zigzag + synergy chain). Right-nudge passives sit on
  // the half-row below their tier so they don't crowd the left-nudge partner.
  2:  { col: 3, nudgeX: -30, nudgeY: -26 },
  5:  { col: 3, nudgeX: 30,  nudgeY: 26  },
  7:  { col: 3, nudgeX: -30 },
  10: { col: 3, nudgeY: 30 },
  11: { col: 3, nudgeX: 30,  nudgeY: -60 },
  14: { col: 3, nudgeX: -30 },
  15: { col: 3, nudgeX: 30 },
  23: { col: 3, nudgeX: -30 },
  27: { col: 3, nudgeX: 30 },

  // Col 4 — B-inner (B02 chain + B04 chain)
  8:  { col: 4 }, 16: { col: 4 }, 25: { col: 4 },
  28: { col: 4 }, 32: { col: 4 }, 37: { col: 4 },

  // Col 5 — B-middle (B03 chain)
  19: { col: 5 }, 24: { col: 5 }, 33: { col: 5 },

  // Col 6 — B-right (B01 chain + B05 unused)
  3:  { col: 6 }, 12: { col: 6 }, 20: { col: 6 },
  31: { col: 6 }, 36: { col: 6 },
};

interface GridLayout {
  positions: Map<number, { cx: number; cy: number; size: number }>;
  width: number;
  height: number;
}

function buildGridLayout(weapon: WeaponTree): GridLayout {
  const gridNodes = weapon.nodes.filter(n => n.type !== 'SpecialAction');

  const allLevels = [...new Set(gridNodes.map(n => n.needMasteryLevel))].sort((a, b) => a - b);
  const levelToRow = new Map<number, number>();
  allLevels.forEach((lv, i) => levelToRow.set(lv, i));
  const totalRows = allLevels.length;

  const positions = new Map<number, { cx: number; cy: number; size: number }>();

  for (const node of gridNodes) {
    const layout = MI_LAYOUT[node.gridIndex];
    if (!layout) continue;
    const row = levelToRow.get(node.needMasteryLevel) ?? 0;
    const cx = layout.col * COL_SPACING + COL_SPACING / 2 + (layout.nudgeX ?? 0);
    const cy = row * ROW_SPACING + ROW_SPACING / 2 + (layout.nudgeY ?? 0);
    positions.set(node.id, {
      cx,
      cy,
      size: (node.type === 'Active' && node.maxLevel >= 3) ? NODE_SIZE : HEX_SIZE,
    });
  }

  return {
    positions,
    width: GRID_COL_COUNT * COL_SPACING,
    height: totalRows * ROW_SPACING,
  };
}

// --- Connection Lines SVG ---
// Draws lines for all prereq1/prereq2 relationships.
function ConnectionLines({ layout, levels, weapon }: {
  layout: GridLayout; levels: NodeLevels; weapon: WeaponTree;
}) {
  const lineSet = new Set<string>();
  const lines: { fromId: number; toId: number }[] = [];

  for (const node of weapon.nodes) {
    // Only draw the direct chain link:
    // - If node has prereq2, draw from prereq2 (II→III link)
    // - If node has only prereq1 (no prereq2), draw from prereq1 (I→II or synergy→child)
    const directPrereq = node.prereq2 ?? node.prereq1;
    if (!directPrereq) continue;
    const key = `${directPrereq.id}-${node.id}`;
    if (lineSet.has(key)) continue;
    lineSet.add(key);
    lines.push({ fromId: directPrereq.id, toId: node.id });
  }

  return (
    <>
      {lines.map(({ fromId, toId }) => {
        const from = layout.positions.get(fromId);
        const to = layout.positions.get(toId);
        if (!from || !to) return null;
        const active = (levels[fromId] || 0) > 0;
        return (
          <line key={`${fromId}-${toId}`}
            x1={from.cx} y1={from.cy + from.size / 2}
            x2={to.cx} y2={to.cy - to.size / 2}
            stroke={active ? 'rgba(224,192,104,0.85)' : 'rgba(190,190,190,0.55)'}
            strokeWidth={1.5}
          />
        );
      })}
    </>
  );
}

// --- Weapon Tree Grid (chain-based) ---
function WeaponTreeGrid({ weapon, levels, onAllocate, onDeallocate, resourceName }: {
  weapon: WeaponTree; levels: NodeLevels;
  onAllocate: (nodeId: number) => void; onDeallocate: (nodeId: number) => void; resourceName: string;
}) {
  const layout = useMemo(() => buildGridLayout(weapon), [weapon]);

  return (
    <div className="relative">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        {/* SVG connection lines */}
        <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height} style={{ zIndex: 1 }}>
          <ConnectionLines layout={layout} levels={levels} weapon={weapon} />
        </svg>

        {/* Nodes */}
        {weapon.nodes.map(node => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          return (
            <div key={node.id} className="absolute z-[2] hover:z-[100]" style={{
              left: pos.cx - pos.size / 2,
              top: pos.cy - pos.size / 2,
            }}>
              <TalentNode
                node={node}
                level={levels[node.id] || 0}
                unlocked={isNodeUnlocked(node, levels, weapon.nodes)}
                canLevel={canAllocate(node, levels, weapon.nodes)}
                onAllocate={() => onAllocate(node.id)}
                onDeallocate={() => onDeallocate(node.id)}
                weaponNodes={weapon.nodes}
                levels={levels}
                resourceName={resourceName}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Right Info Panel ---
function InfoPanel({ weapon, levels, classData }: {
  weapon: WeaponTree; levels: NodeLevels; classData: ClassTalentData;
}) {
  const totalSpent = weapon.nodes.reduce((sum, n) => sum + (levels[n.id] || 0), 0);
  const maxPossible = weapon.nodes.reduce((sum, n) => sum + n.maxLevel, 0);
  const specialNode = weapon.nodes.find(n => n.type === 'SpecialAction');
  const equippedActives = weapon.nodes
    .filter(n => n.type === 'Active' && (levels[n.id] || 0) > 0)
    .slice(0, 4);

  const wepIcon = WEAPON_ICON[weapon.weaponKey];
  const slug = CLASS_SLUG[classData.classKey] || classData.classKey.toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      {/* Weapon name + silhouette bg */}
      <GamePanel padding="p-4" className="overflow-hidden" style={{ minHeight: 120 }}>
        {/* Background weapon icon (large, faded) */}
        {wepIcon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/images/game-icons/weapons/${wepIcon}.png`}
            alt=""
            className="absolute right-[-20px] top-[-10px] opacity-[0.06] z-0"
            style={{ width: 180, height: 180, filter: 'brightness(2)', pointerEvents: 'none' }}
          />
        )}
        <div className="font-heading text-2xl text-accent-gold mb-1">{weapon.displayName}</div>
        <div className="text-[12px] text-text-muted mb-4">{classData.displayName}</div>

        {/* Mastery Level progress */}
        <div className="text-[11px] text-text-muted mb-1.5">
          Mastery Level <span className="text-accent-gold font-bold">{totalSpent}</span>
          <span className="text-text-muted">/{maxPossible}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(50,50,50,0.5)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: maxPossible > 0 ? `${(totalSpent / maxPossible) * 100}%` : '0%',
              background: 'linear-gradient(90deg, #8a6e2f, #c8a84e, #e0c068)',
            }}
          />
        </div>
      </GamePanel>

      {/* Special Move */}
      {specialNode && (
        <GamePanel padding="p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-wider mb-3 font-heading">Special Move</div>
          <div className="flex items-center gap-3">
            <div style={{
              width: 52,
              height: 52,
              clipPath: HEXAGON_CLIP,
              background: 'rgba(200,168,78,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 48,
                height: 48,
                clipPath: HEXAGON_CLIP,
                background: 'rgba(45,45,45,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {specialNode.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={specialNode.icon} alt="" style={{ width: '60%', height: '60%', objectFit: 'contain', filter: 'brightness(1.1)' }} />
                )}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-accent-gold font-heading">{specialNode.name}</div>
              {specialNode.cooldown > 0 && (
                <div className="text-[10px] text-text-muted mt-0.5">Cooldown: {specialNode.cooldown}s</div>
              )}
            </div>
          </div>
        </GamePanel>
      )}

      {/* Equipped Skills */}
      <GamePanel padding="p-4">
        <div className="text-[11px] text-text-muted uppercase tracking-wider mb-3 font-heading">Equipped Skills</div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const skill = equippedActives[i];
            return (
              <div key={i} style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: skill ? '2px solid rgba(224,192,104,0.5)' : '2px solid rgba(50,50,50,0.3)',
                background: skill ? 'rgba(200,168,78,0.08)' : 'rgba(45,45,45,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {skill?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={skill.icon} alt="" style={{ width: '60%', height: '60%', objectFit: 'contain', filter: 'brightness(1.2)' }} />
                ) : (
                  <span style={{ fontSize: 18, color: 'rgba(50,50,50,0.4)' }}>+</span>
                )}
              </div>
            );
          })}
        </div>
        {equippedActives.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {equippedActives.map(s => (
              <div key={s.id} className="text-[10px] text-text-muted truncate">{s.name}</div>
            ))}
          </div>
        )}
      </GamePanel>

      {/* Class portrait */}
      <GamePanel padding="p-0" className="overflow-hidden">
        <div className="relative" style={{ height: 120 }}>
          <Image
            src={`/images/game-icons/classes/${slug}-portrait.png`}
            alt={classData.displayName}
            fill
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 flex items-end p-3" style={{
            background: 'linear-gradient(transparent, rgba(20,18,28,0.9))',
          }}>
            <span className="font-heading text-lg text-accent-gold">{classData.displayName}</span>
          </div>
        </div>
      </GamePanel>
    </div>
  );
}

// --- Class Mastery Sidebar ---
function ClassMasterySection({ classData, selectedMastery, onToggle }: {
  classData: ClassTalentData; selectedMastery: Set<number>; onToggle: (id: number) => void;
}) {
  const tiers = [
    { level: 10, label: 'Lv 10', isShared: false },
    { level: 15, label: 'Lv 15', isShared: false },
    { level: 20, label: 'Lv 20', isShared: false },
    { level: 25, label: 'Lv 25', isShared: true },
    { level: 30, label: 'Lv 30', isShared: true },
    { level: 40, label: 'Lv 40', isShared: true },
  ];

  return (
    <div>
      <h3 className="font-heading text-sm text-accent-gold mb-3">Class Mastery</h3>
      <div className="space-y-4">
        {tiers.map(({ level, label, isShared }) => {
          const nodes = classData.classMastery.filter(n => n.unlockLevel === level && n.isShared === isShared);
          if (nodes.length === 0) return null;
          return (
            <div key={`${level}-${isShared}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-px flex-1 bg-border-subtle/40" />
                <span className="text-[9px] font-heading uppercase tracking-widest text-text-muted whitespace-nowrap">
                  {isShared ? `Shared ${label}` : label}
                </span>
                <div className="h-px flex-1 bg-border-subtle/40" />
              </div>
              <div className="space-y-1.5">
                {nodes.map(node => {
                  const selected = selectedMastery.has(node.id);
                  return (
                    <button key={node.id} onClick={() => onToggle(node.id)}
                      className="relative p-2 rounded border text-left transition-all duration-150 w-full"
                      style={{
                        borderColor: selected ? '#c8a84e' : 'rgba(50,50,50,0.6)',
                        background: selected ? 'rgba(200,168,78,0.08)' : 'rgba(22,22,42,0.4)',
                      }}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'border-accent-gold bg-accent-gold' : 'border-border-subtle'}`}>
                          {selected && <svg className="w-2 h-2 text-void-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-medium ${selected ? 'text-accent-gold' : 'text-text-primary'}`}>{node.name}</span>
                          <span className={`text-[9px] ml-1.5 ${node.type === 'Active' ? 'text-blue-400' : 'text-green-400'}`}>{node.type}</span>
                          {node.description && <p className="text-[9px] text-text-muted leading-relaxed mt-0.5 line-clamp-2">{node.description}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Share Button ---
function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  }, [url]);

  return (
    <button onClick={handleCopy}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${copied ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-border-subtle bg-card-bg/60 text-text-muted hover:text-text-primary hover:border-accent-gold-dim'}`}>
      {copied ? 'Copied!' : 'Share Build'}
    </button>
  );
}

// --- Main ---
export default function TalentCalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialState = useMemo(() => {
    const search = searchParams.toString();
    return search ? decodeState(search) : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedClass, setSelectedClass] = useState(Math.min(initialState?.classIdx ?? 0, TALENT_DATA.length - 1));
  const [selectedWeapon, setSelectedWeapon] = useState(initialState?.weaponIdx ?? 0);
  const [nodeLevels, setNodeLevels] = useState<NodeLevels>(initialState?.levels ?? {});
  const [selectedMastery, setSelectedMastery] = useState<Set<number>>(initialState?.masterySet ?? new Set());
  const [showClassMastery, setShowClassMastery] = useState(false);

  const classData = TALENT_DATA[selectedClass];
  const weaponIdx = Math.min(selectedWeapon, classData.weapons.length - 1);
  const weaponData = classData.weapons[weaponIdx];
  const resourceName = CLASS_RESOURCES[classData.classKey] || 'Resource';

  useEffect(() => {
    router.replace(`?${encodeState(selectedClass, weaponIdx, nodeLevels, selectedMastery)}`, { scroll: false });
  }, [selectedClass, weaponIdx, nodeLevels, selectedMastery, router]);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/talent-calculator?${encodeState(selectedClass, weaponIdx, nodeLevels, selectedMastery)}`
    : '';

  const handleAllocate = useCallback((nodeId: number) => {
    const node = weaponData.nodes.find(n => n.id === nodeId);
    if (!node || !canAllocate(node, nodeLevels, weaponData.nodes)) return;
    setNodeLevels(prev => ({ ...prev, [nodeId]: (prev[nodeId] || 0) + 1 }));
  }, [weaponData, nodeLevels]);

  const handleDeallocate = useCallback((nodeId: number) => {
    const current = nodeLevels[nodeId] || 0;
    if (current <= 0) return;
    const newLevels = { ...nodeLevels, [nodeId]: current - 1 };
    const newTotalSpent = weaponData.nodes.reduce((sum, n) => sum + (newLevels[n.id] || 0), 0);

    const wouldBreak = weaponData.nodes.some(n => {
      const nLevel = newLevels[n.id] || 0;
      if (nLevel <= 0) return false;
      // Check direct prereq links
      if (n.prereq1?.id === nodeId && current - 1 < n.prereq1.level) return true;
      if (n.prereq2?.id === nodeId && current - 1 < n.prereq2.level) return true;
      // Check mastery-tier gate: would removing this point drop total below a still-allocated node's requirement?
      if (n.needMasteryLevel > 0 && newTotalSpent < n.needMasteryLevel) return true;
      return false;
    });
    if (wouldBreak) return;
    setNodeLevels(prev => ({ ...prev, [nodeId]: current - 1 }));
  }, [weaponData, nodeLevels]);

  const handleToggleMastery = useCallback((id: number) => {
    setSelectedMastery(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleReset = useCallback(() => { setNodeLevels({}); setSelectedMastery(new Set()); }, []);
  const handleResetWeapon = useCallback(() => {
    const ids = new Set(weaponData.nodes.map(n => n.id));
    setNodeLevels(prev => { const next: NodeLevels = {}; for (const [k, v] of Object.entries(prev)) if (!ids.has(Number(k))) next[Number(k)] = v; return next; });
  }, [weaponData]);

  const handleClassChange = useCallback((idx: number) => {
    setSelectedClass(idx); setSelectedWeapon(0); setNodeLevels({}); setSelectedMastery(new Set());
  }, []);

  const totalWeaponPoints = useMemo(() => classData.weapons.reduce((sum, wep) => sum + wep.nodes.reduce((s, n) => s + (nodeLevels[n.id] || 0), 0), 0), [classData, nodeLevels]);

  return (
    <div className="space-y-2">

      {/* Class Selector */}
      <div className="flex flex-wrap gap-1.5">
        {TALENT_DATA.map((cls, i) => {
          const slug = CLASS_SLUG[cls.classKey] || cls.classKey.toLowerCase();
          const isActive = i === selectedClass;
          return (
            <button key={cls.classKey} onClick={() => handleClassChange(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border font-heading text-[13px] transition-all ${isActive ? 'border-accent-gold bg-accent-gold/10 text-accent-gold' : 'border-border-subtle/60 bg-card-bg/40 text-text-muted hover:border-accent-gold-dim hover:text-text-primary'}`}>
              <div className={`w-6 h-6 rounded overflow-hidden shrink-0 border ${isActive ? 'border-accent-gold/40' : 'border-border-subtle/40'}`}>
                <Image src={`/images/game-icons/classes/${slug}-portrait.png`} alt={cls.displayName} width={24} height={24} className="w-full h-full object-cover" />
              </div>
              {cls.displayName}
            </button>
          );
        })}
      </div>

      {/* Weapon Tabs + Controls */}
      <div className="flex items-end justify-between gap-2 border-b border-border-subtle/60">
        <div className="flex">
          {classData.weapons.map((wep, i) => {
            const isActive = i === weaponIdx && !showClassMastery;
            const wepIcon = WEAPON_ICON[wep.weaponKey];
            const wepPts = wep.nodes.reduce((s, n) => s + (nodeLevels[n.id] || 0), 0);
            return (
              <button key={wep.weaponKey} onClick={() => { setSelectedWeapon(i); setShowClassMastery(false); }}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm transition-all ${isActive ? 'text-accent-gold' : 'text-text-muted hover:text-text-primary'}`}>
                {wepIcon && (
                  <div className="w-5 h-5 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/images/game-icons/weapons/${wepIcon}.png`} alt="" className="w-full h-full object-contain"
                      style={{ filter: isActive ? 'brightness(1.2) sepia(0.3) saturate(2) hue-rotate(10deg)' : 'brightness(0.5)' }} />
                  </div>
                )}
                <span className="font-medium">{wep.displayName}</span>
                {wepPts > 0 && (
                  <span className={`text-[10px] px-1 py-0.5 rounded ${isActive ? 'bg-accent-gold/15 text-accent-gold' : 'bg-dark-surface text-text-muted'}`}>{wepPts}</span>
                )}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold rounded-t-full" />}
              </button>
            );
          })}
          <button onClick={() => setShowClassMastery(true)}
            className={`relative flex items-center gap-2 px-4 py-2 text-sm transition-all ${showClassMastery ? 'text-accent-gold' : 'text-text-muted hover:text-text-primary'}`}>
            <span className="font-medium">Class Mastery</span>
            {selectedMastery.size > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded ${showClassMastery ? 'bg-accent-gold/15 text-accent-gold' : 'bg-dark-surface text-text-muted'}`}>{selectedMastery.size}</span>
            )}
            {showClassMastery && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold rounded-t-full" />}
          </button>
        </div>
        <div className="flex gap-1.5 pb-1.5">
          {/* Mastery point counter */}
          <div className="flex items-center gap-1 px-2.5 py-1 text-[11px]">
            <span className="text-text-muted">MASTERY POINT</span>
            <span className="text-accent-gold font-bold">{totalWeaponPoints}</span>
          </div>
          <ShareButton url={shareUrl} />
          <button onClick={handleResetWeapon} className="px-2.5 py-1 rounded text-[11px] border border-border-subtle bg-card-bg/60 text-text-muted hover:border-red-500/40 hover:text-red-400 transition-colors">Reset Tree</button>
          <button onClick={handleReset} className="px-2.5 py-1 rounded text-[11px] border border-border-subtle bg-card-bg/60 text-red-400/60 hover:border-red-500/50 hover:text-red-400 transition-colors">Reset All</button>
        </div>
      </div>

      {/* Main layout: Tree/Mastery (left) + Info Panel (right) */}
      <div className="flex gap-5">
        {/* Tree or Class Mastery area */}
        <GamePanel padding="p-0" className="flex-1">
          <div className="p-3 sm:p-4">
            {showClassMastery ? (
              <ClassMasterySection classData={classData} selectedMastery={selectedMastery} onToggle={handleToggleMastery} />
            ) : (
              <WeaponTreeGrid
                weapon={weaponData}
                levels={nodeLevels}
                onAllocate={handleAllocate}
                onDeallocate={handleDeallocate}
                resourceName={resourceName}
              />
            )}
          </div>
        </GamePanel>

        {/* Right info panel */}
        <div className="w-[280px] shrink-0 hidden lg:block">
          <InfoPanel weapon={weaponData} levels={nodeLevels} classData={classData} />
        </div>
      </div>

      {/* Build Summary */}
      {(Object.values(nodeLevels).some(v => v > 0) || selectedMastery.size > 0) && (
        <GamePanel padding="p-4">
          <h3 className="font-heading text-sm text-accent-gold mb-3">Build Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {classData.weapons.map(wep => {
              const allocated = wep.nodes.filter(n => (nodeLevels[n.id] || 0) > 0);
              if (allocated.length === 0) return null;
              const wepTotal = wep.nodes.reduce((s, n) => s + (nodeLevels[n.id] || 0), 0);
              return (
                <div key={wep.weaponKey}>
                  <div className="flex items-center gap-2 pb-1 mb-1.5 border-b border-border-subtle/40">
                    {WEAPON_ICON[wep.weaponKey] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/images/game-icons/weapons/${WEAPON_ICON[wep.weaponKey]}.png`} alt="" className="w-4 h-4 object-contain" style={{ filter: 'brightness(0.8)' }} />
                    )}
                    <span className="text-xs font-heading text-text-primary">{wep.displayName}</span>
                    <span className="ml-auto text-[10px] text-accent-gold">{wepTotal}pts</span>
                  </div>
                  {allocated.map(n => {
                    const lvl = nodeLevels[n.id];
                    return (
                      <div key={n.id} className="flex items-center gap-1.5 text-[10px] py-0.5">
                        {n.icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.icon} alt="" className="w-3.5 h-3.5 object-contain" style={{ filter: 'brightness(0.9)' }} />
                        )}
                        <span className="text-text-muted truncate flex-1">{n.name}</span>
                        <span className={`shrink-0 font-medium ${lvl >= n.maxLevel ? 'text-accent-gold' : 'text-text-muted'}`}>{lvl}/{n.maxLevel}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {selectedMastery.size > 0 && (
              <div>
                <div className="flex items-center gap-2 pb-1 mb-1.5 border-b border-border-subtle/40">
                  <span className="text-xs font-heading text-text-primary">Class Mastery</span>
                  <span className="ml-auto text-[10px] text-accent-gold">{selectedMastery.size}</span>
                </div>
                {classData.classMastery.filter(n => selectedMastery.has(n.id)).map(n => (
                  <div key={n.id} className="flex items-center gap-1.5 text-[10px] py-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${n.type === 'Active' ? 'bg-blue-400' : 'bg-green-400'}`} />
                    <span className="text-text-muted truncate">{n.name}</span>
                    <span className="ml-auto text-text-muted">Lv.{n.unlockLevel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GamePanel>
      )}
    </div>
  );
}
