import React from 'react';
import { PersonNode } from './PersonNode';
import { TreeNode } from '../../processing/treeBuilder';
import { StyledFamilyMember, AvatarStyle } from '../../types/FamilyTypes';

// ─── Recursive Tree Branch ───

export const TreeBranch = React.memo<{
  node: TreeNode;
  selectedId: string | null;
  isSearching: boolean;
  searchMatchedIds: Set<string>;
  onSelect: (id: string) => void;
  onMenuAction: (action: 'edit' | 'addChild' | 'addSpouse' | 'delete', memberId: string) => void;
  filterMatchedIds: Set<string>;
  filterDimMode: 'dim' | 'hide';
  relSource: string | null;
  relTarget: string | null;
  relPathSet: Set<string>;
  bloodPathIds: Set<string>;
  marriageFilterActive: boolean;
  avatarStyle: AvatarStyle;
  relStep: 1 | 2 | null;
}>(({ node, selectedId, isSearching, searchMatchedIds, onSelect, onMenuAction, filterMatchedIds, filterDimMode, relSource, relTarget, relPathSet, bloodPathIds, marriageFilterActive, avatarStyle, relStep }) => {
  const filterActive = filterMatchedIds.size > 0;

  const getHighlight = (id: string): boolean | null => {
    if (isSearching) {
      // When a filter is also active, dim members that pass the search but fail the filter
      // so the filter's intent is preserved during search (AND logic).
      if (filterActive && !filterMatchedIds.has(id)) return false;
      return searchMatchedIds.has(id);
    }
    if (filterActive) return filterMatchedIds.has(id);
    return null;
  };

  // Hide only when not searching; during search we dim but never hide so the
  // tree context remains visible and the user can still see where results live.
  const getHidden = (id: string): boolean =>
    filterActive && filterDimMode === 'hide' && !filterMatchedIds.has(id) && !isSearching;

  const getRelRole = (id: string): 'source' | 'target' | 'blood-path' | 'path' | null => {
    if (id === relSource) return 'source';
    if (id === relTarget) return 'target';
    if (bloodPathIds.has(id)) return 'blood-path';
    if (relPathSet.has(id)) return 'path';
    return null;
  };

  // Marriage badge: shown when filter is active + member is living + age-eligible (spouse check is in filter)
  const isBadgeEligible = (m: StyledFamilyMember): boolean => {
    if (!marriageFilterActive) return false;
    if (m.deathYear !== null || m.age === null || m.gender === 'unknown') return false;
    return m.age >= (m.gender === 'female' ? 18 : 21);
  };

  return (
    <li role="treeitem" aria-expanded={node.children.length > 0 ? true : undefined}>
      <div className="tree-couple">
        {/* Former spouses — rendered LEFT of primary, dashed connector */}
        {node.formerSpouses.map(({ member: fsp, rel }) => (
          <React.Fragment key={fsp.id}>
            <PersonNode
              member={fsp}
              isSelected={selectedId === fsp.id}
              isHighlighted={getHighlight(fsp.id)}
              isHidden={getHidden(fsp.id)}
              relRole={getRelRole(fsp.id)}
              showMarriageBadge={isBadgeEligible(fsp)}
              avatarStyle={avatarStyle}
              onClick={onSelect}
              onMenuAction={onMenuAction}
              isFormerSpouse
              relStep={relStep}
            />
            <div className="spouse-connector spouse-connector--former" title={
              rel.endYear
                ? `${rel.endReason ?? 'Separated'} ${rel.endYear}${rel.marriageYear ? ` (married ${rel.marriageYear})` : ''}`
                : 'Former spouse'
            }>
              <div className="spouse-connector__top">
                <span className="spouse-connector__line" />
                <div className="spouse-connector__mid">
                  {rel.marriageYear && (
                    <span className="spouse-connector__year">{rel.marriageYear}</span>
                  )}
                  <span className="spouse-connector__x">✕</span>
                </div>
                <span className="spouse-connector__line" />
              </div>
              <span className="spouse-connector__line spouse-connector__line--full" />
            </div>
          </React.Fragment>
        ))}

        {/* Primary member */}
        <PersonNode
          member={node.member}
          isSelected={selectedId === node.member.id}
          isHighlighted={getHighlight(node.member.id)}
          isHidden={getHidden(node.member.id)}
          relRole={getRelRole(node.member.id)}
          showMarriageBadge={isBadgeEligible(node.member)}
          avatarStyle={avatarStyle}
          onClick={onSelect}
          onMenuAction={onMenuAction}
          relStep={relStep}
        />

        {/* Current spouses — rendered RIGHT of primary, solid heart connectors */}
        {node.currentSpouses.map(({ member: cs, rel: crel }) => (
          <React.Fragment key={cs.id}>
            <div className="spouse-connector">
              <div className="spouse-connector__top">
                <span className="spouse-connector__line" />
                <div className="spouse-connector__mid">
                  {crel.marriageYear && (
                    <span className="spouse-connector__year">{crel.marriageYear}</span>
                  )}
                  {crel.showHeart !== false && (
                    <span
                      className="spouse-connector__heart"
                      style={{ color: crel.heartColorHex ?? '#E53935' }}
                    >
                      ♥
                    </span>
                  )}
                </div>
                <span className="spouse-connector__line" />
              </div>
              <span className="spouse-connector__line spouse-connector__line--full" />
            </div>
            <PersonNode
              member={cs}
              isSelected={selectedId === cs.id}
              isHighlighted={getHighlight(cs.id)}
              isHidden={getHidden(cs.id)}
              relRole={getRelRole(cs.id)}
              showMarriageBadge={isBadgeEligible(cs)}
              avatarStyle={avatarStyle}
              onClick={onSelect}
              onMenuAction={onMenuAction}
              relStep={relStep}
            />
          </React.Fragment>
        ))}
      </div>
      {node.children.length > 0 && (
        <ul role="group">
          {node.children.map(child => (
            <TreeBranch
              key={child.member.id}
              node={child}
              selectedId={selectedId}
              isSearching={isSearching}
              searchMatchedIds={searchMatchedIds}
              onSelect={onSelect}
              onMenuAction={onMenuAction}
              filterMatchedIds={filterMatchedIds}
              filterDimMode={filterDimMode}
              relSource={relSource}
              relTarget={relTarget}
              relPathSet={relPathSet}
              bloodPathIds={bloodPathIds}
              marriageFilterActive={marriageFilterActive}
              avatarStyle={avatarStyle}
              relStep={relStep}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

TreeBranch.displayName = 'TreeBranch';
