import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DisplaySettings, StyledFamilyMember, StyledRelationships } from '../../types/FamilyTypes';
import { TreeNode, computeLineage } from '../../processing/treeBuilder';
import './ConnectorFlow.css';

/** Anyone with no death year is living, unless born so long ago that the year is just missing. */
const MAX_PLAUSIBLE_AGE = 110;
const CORNER_RADIUS = 14;
const SPEED_FACTOR: Record<DisplaySettings['connectorSpeed'], number> = { slow: 2, normal: 1, fast: 0.55 };

interface Connector {
  key: string;
  parentId: string;
  childId: string;
  d: string;
  /** Pulse bead length in pathLength=100 units, so beads look the same on short and long lines. */
  bead: number;
  /** Hops from the oldest living couple of this branch (drives Cascade timing); null when the line stays static. */
  depth: number | null;
  endX: number;
  endY: number;
}

interface ConnectorFlowProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  treeNodes: TreeNode[];
  members: StyledFamilyMember[];
  relationships: StyledRelationships;
  settings: DisplaySettings;
  selectedId: string | null;
  /** Anything that can move nodes without resizing the chart (e.g. avatar style, language). */
  layoutKey: string;
}

function elbowPath(x0: number, y0: number, bus: number, x1: number, y1: number): { d: string; length: number } {
  const dx = x1 - x0;
  if (Math.abs(dx) < 1) return { d: `M${x0} ${y0} V${y1}`, length: y1 - y0 };
  const r = Math.max(0, Math.min(CORNER_RADIUS, Math.abs(dx) / 2, bus - y0, y1 - bus));
  const sx = Math.sign(dx);
  const d = `M${x0} ${y0} V${bus - r} Q${x0} ${bus} ${x0 + sx * r} ${bus} H${x1 - sx * r} Q${x1} ${bus} ${x1} ${bus + r} V${y1}`;
  return { d, length: (bus - y0) + Math.abs(dx) + (y1 - bus) - r * (4 - Math.PI) };
}

/** S-curve from the parents straight down into the child (the "Curved" line shape). */
function curvePath(x0: number, y0: number, x1: number, y1: number): { d: string; length: number } {
  const h = y1 - y0;
  const c1 = y0 + h * 0.55;
  const c2 = y1 - h * 0.45;
  const d = `M${x0} ${y0} C${x0} ${c1} ${x1} ${c2} ${x1} ${y1}`;
  // Bezier length by sampling; only used to size the pulse bead.
  let length = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x0 + 3 * u * t * t * x1 + t * t * t * x1;
    const y = u * u * u * y0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * y1;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return { d, length };
}

const childElements = (el: Element, tag: string) =>
  Array.from(el.children).filter(child => child.tagName === tag) as HTMLElement[];

/**
 * SVG overlay for the parent-to-child lines.
 * Elbow shape: the CSS lines stay as the static base and this only adds the animation.
 * Curved shape: the CSS lines are hidden and this draws every line as a curve, plus the animation.
 * Animation runs only on lines that lead down from living members.
 */
const ConnectorFlow: React.FC<ConnectorFlowProps> = ({
  chartRef, treeNodes, members, relationships, settings, selectedId, layoutKey,
}) => {
  const animated = settings.connectorStyle !== 'static';
  const curved = settings.connectorShape === 'curve';
  const enabled = animated || curved;
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Bumped to re-create the SVG so every animation restarts in step (cascade timing relies on it).
  const [cycle, setCycle] = useState(0);

  // A line is live when at least one of the child's real parents is living (hidden members included).
  const livingParentOf = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const living = new Set(members
      .filter(m => m.deathYear == null && !(m.birthYear && currentYear - m.birthYear > MAX_PLAUSIBLE_AGE))
      .map(m => m.id));
    const parents = new Map<string, Set<string>>();
    const add = (parentId: string, childId: string) => {
      if (!parents.has(childId)) parents.set(childId, new Set());
      parents.get(childId)!.add(parentId);
    };
    relationships.parentChild.forEach(r => add(r.parentId, r.childId));
    members.forEach(m => m.parentIds?.forEach(pid => add(pid, m.id)));
    return { living, parents };
  }, [members, relationships]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!enabled || !chart) {
      setConnectors([]);
      return;
    }

    const isLive = (parentLiId: string, coupleIds: string[], childId: string) => {
      const real = livingParentOf.parents.get(childId);
      const ids = real && real.size > 0 ? Array.from(real) : [parentLiId, ...coupleIds];
      return ids.some(id => livingParentOf.living.has(id));
    };

    const measure = () => {
      const chartRect = chart.getBoundingClientRect();
      const scale = chart.offsetWidth > 0 ? chartRect.width / chart.offsetWidth : 0;
      if (!scale) {
        setConnectors([]);
        return;
      }
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return {
          left: (r.left - chartRect.left) / scale,
          top: (r.top - chartRect.top) / scale,
          width: r.width / scale,
          height: r.height / scale,
        };
      };

      const found: Connector[] = [];
      const walk = (li: HTMLElement, incomingDepth: number | null) => {
        const parentId = li.dataset.branchId;
        const ul = childElements(li, 'UL')[0];
        if (!parentId || !ul) return;
        const couple = Array.from(li.children).find(el => el.classList.contains('tree-couple'));
        const coupleIds = couple
          ? Array.from(couple.querySelectorAll<HTMLElement>('[data-member-id]')).map(el => el.dataset.memberId ?? '')
          : [];
        const ulBox = box(ul);
        const x0 = ulBox.left + ulBox.width / 2;
        const y0 = ulBox.top;
        for (const childLi of childElements(ul, 'LI')) {
          const childId = childLi.dataset.branchId;
          if (!childId) continue;
          const live = isLive(parentId, coupleIds, childId);
          const depth = live ? (incomingDepth === null ? 0 : incomingDepth + 1) : null;
          if (depth !== null || curved) {
            const liBox = box(childLi);
            const padTop = parseFloat(getComputedStyle(childLi).paddingTop) || 0;
            const x1 = liBox.left + liBox.width / 2;
            const y1 = liBox.top + padTop;
            const { d, length } = curved ? curvePath(x0, y0, x1, y1) : elbowPath(x0, y0, liBox.top, x1, y1);
            found.push({
              key: `${parentId}>${childId}`,
              parentId,
              childId,
              d,
              bead: Math.min(8, Math.max(0.5, (7 / Math.max(length, 1)) * 100)),
              depth,
              endX: x1,
              endY: y1,
            });
          }
          walk(childLi, depth);
        }
      };

      const rootUl = childElements(chart, 'UL')[0];
      if (rootUl) childElements(rootUl, 'LI').forEach(li => walk(li, null));
      setSize({ width: chart.offsetWidth, height: chart.offsetHeight });
      setConnectors(found);
      setCycle(c => c + 1);
    };

    measure();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(chart);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [enabled, curved, chartRef, treeNodes, livingParentOf, layoutKey]);

  // Selected lineage: only that member's ancestors and descendants animate. A spouse follows their partner's line.
  const lineageIds = useMemo(() => {
    if (!animated || settings.connectorScope !== 'lineage' || !selectedId) return null;
    const ids = computeLineage(selectedId, members, relationships);
    const findPartner = (nodes: TreeNode[]): string | null => {
      for (const node of nodes) {
        if ([...node.currentSpouses, ...node.formerSpouses].some(s => s.member.id === selectedId)) return node.member.id;
        const inner = findPartner(node.children);
        if (inner) return inner;
      }
      return null;
    };
    const partner = findPartner(treeNodes);
    if (partner) computeLineage(partner, members, relationships).forEach(id => ids.add(id));
    return ids;
  }, [animated, settings.connectorScope, selectedId, members, relationships, treeNodes]);

  useEffect(() => setCycle(c => c + 1), [settings.connectorStyle, settings.connectorShape, settings.connectorTiming, settings.connectorSpeed, lineageIds]);

  if (!enabled || connectors.length === 0) return null;

  const isAnimated = (c: Connector) => animated && c.depth !== null
    && (!lineageIds || (lineageIds.has(c.parentId) && lineageIds.has(c.childId)));
  const pulse = settings.connectorStyle === 'pulse';

  return (
    <svg
      key={cycle}
      className={`conn-flow conn-flow--${settings.connectorStyle} conn-flow--${settings.connectorTiming}`}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{ '--conn-speed': SPEED_FACTOR[settings.connectorSpeed] } as React.CSSProperties}
      aria-hidden="true"
      data-testid="connector-flow"
    >
      {connectors.map(c => (
        <g key={c.key} style={{ '--g': c.depth ?? 0, '--d': c.bead.toFixed(2) } as React.CSSProperties}>
          {curved && <path className="conn-flow__ln conn-flow__base" d={c.d} />}
          {isAnimated(c) && (pulse ? (
            <>
              <path className="conn-flow__ln conn-flow__fx conn-flow__pulse-halo" d={c.d} pathLength={100} />
              <path className="conn-flow__ln conn-flow__fx conn-flow__pulse-core" d={c.d} pathLength={100} />
              <circle className="conn-flow__fx conn-flow__arrive" cx={c.endX} cy={c.endY} r={6} />
            </>
          ) : (
            <>
              <path className="conn-flow__ln conn-flow__fx conn-flow__particle-halo" d={c.d} />
              <path className="conn-flow__ln conn-flow__fx conn-flow__particle-a" d={c.d} />
              <path className="conn-flow__ln conn-flow__fx conn-flow__particle-b" d={c.d} />
            </>
          ))}
        </g>
      ))}
    </svg>
  );
};

export default ConnectorFlow;
