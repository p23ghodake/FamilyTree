import {
  RawFamilyMember,
  RawSpouseRelation,
  StyledRelationships,
  SpouseRelationship,
  ParentChildRelationship,
} from '../types/FamilyTypes';

export function buildRelationships(
  members: RawFamilyMember[],
  treeAccentHex: string,
  rawSpouses: RawSpouseRelation[] = []
): StyledRelationships {
  const spouses: SpouseRelationship[] = [];
  const parentChild: ParentChildRelationship[] = [];

  const seenPC = new Set<string>();

  // Desaturated accent for parent-child lines
  const pcStroke = desaturate(treeAccentHex, 0.5);

  // Build styled spouse relationships from raw data (preserves status + temporal fields)
  rawSpouses.forEach(raw => {
    const isCurrent = !raw.endYear;
    spouses.push(
      isCurrent
        ? {
            spouse1Id:     raw.spouse1Id,
            spouse2Id:     raw.spouse2Id,
            status:        'current',
            marriageYear:  raw.marriageYear,
            showHeart:     true,
            heartIconType: 'solid',
            heartColorHex: '#E53935',
            heartSizePx:   16,
            lineStyle: {
              strokeColorHex: '#E53935',
              strokeWidthPx:  2,
              lineStyle:      'solid',
            },
          }
        : {
            spouse1Id:     raw.spouse1Id,
            spouse2Id:     raw.spouse2Id,
            status:        'former',
            marriageYear:  raw.marriageYear,
            endYear:       raw.endYear,
            endReason:     raw.endReason,
            showHeart:     false,
            heartIconType: 'outline',
            heartColorHex: '#94a3b8',
            heartSizePx:   14,
            lineStyle: {
              strokeColorHex: '#94a3b8',
              strokeWidthPx:  2,
              lineStyle:      'dashed',
            },
          }
    );
  });

  // Fallback: build from member spouseId field (handles legacy data without relationships block)
  if (rawSpouses.length === 0) {
    const seenSpouse = new Set<string>();
    members.forEach(m => {
      if (m.spouseId) {
        const key = [m.id, m.spouseId].sort().join('-');
        if (!seenSpouse.has(key)) {
          seenSpouse.add(key);
          spouses.push({
            spouse1Id:     m.id,
            spouse2Id:     m.spouseId,
            status:        'current',
            showHeart:     true,
            heartIconType: 'solid',
            heartColorHex: '#E53935',
            heartSizePx:   16,
            lineStyle: {
              strokeColorHex: '#E53935',
              strokeWidthPx:  2,
              lineStyle:      'solid',
            },
          });
        }
      }
    });
  }

  // Parent-child connections
  members.forEach(m => {
    (m.childrenIds ?? []).forEach(childId => {
      const key = `${m.id}->${childId}`;
      if (!seenPC.has(key)) {
        seenPC.add(key);
        parentChild.push({
          parentId: m.id,
          childId,
          lineStyle: {
            strokeColorHex: pcStroke,
            strokeWidthPx:  2,
            lineStyle:      'solid',
            cornerRadiusPx: 8,
          },
        });
      }
    });
  });

  return { spouses, parentChild };
}

// Blend a color toward gray to desaturate it
function desaturate(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const blend = (c: number) => Math.round(c + (gray - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`;
}
