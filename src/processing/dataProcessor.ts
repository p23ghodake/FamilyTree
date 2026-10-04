import {
  RawFamilyData,
  RawFamilyTree,
  RawFamilyMember,
  ProcessedFamilyData,
  StyledFamilyTree,
  StyledFamilyMember,
} from '../types/FamilyTypes';
import { computeAge, getAgeCategory } from './ageCalculation';
import { detectGenerations } from './generationDetection';
import { getTreeAccent, getNodeColors } from './nodeStyling';
import { getImageConfig } from './imageRules';
import { buildRelationships } from './relationshipStyling';

/**
 * If the tree has a separate `relationships` object (new format),
 * enrich members with spouseId / spouseIds / parentIds / childrenIds so the
 * rest of the pipeline works uniformly.
 */
function enrichMembersFromRelationships(tree: RawFamilyTree): RawFamilyMember[] {
  const members = tree.members.map(m => ({ ...m })); // shallow clone

  if (!tree.relationships) return members;

  const memberMap = new Map(members.map(m => [m.id, m]));

  // Build spouseIds (all) and spouseId (first current spouse for backward compat)
  type SpouseEntry = { id: string; isCurrent: boolean };
  const spousesMap = new Map<string, SpouseEntry[]>();

  tree.relationships.spouses.forEach(({ spouse1Id, spouse2Id, endYear }) => {
    const isCurrent = !endYear;
    if (!spousesMap.has(spouse1Id)) spousesMap.set(spouse1Id, []);
    if (!spousesMap.has(spouse2Id)) spousesMap.set(spouse2Id, []);
    spousesMap.get(spouse1Id)!.push({ id: spouse2Id, isCurrent });
    spousesMap.get(spouse2Id)!.push({ id: spouse1Id, isCurrent });
  });

  members.forEach(m => {
    const entries = spousesMap.get(m.id) ?? [];
    m.spouseIds = entries.map(e => e.id);
    // spouseId = first current spouse (backward compat for single-spouse checks)
    const current = entries.find(e => e.isCurrent);
    if (current) m.spouseId = current.id;
    else if (entries.length > 0) m.spouseId = entries[entries.length - 1].id;
  });

  // Build parent→children and child→parents links
  tree.relationships.parentChild.forEach(({ parentId, childId }) => {
    const parent = memberMap.get(parentId);
    const child  = memberMap.get(childId);
    if (parent) {
      if (!parent.childrenIds) parent.childrenIds = [];
      if (!parent.childrenIds.includes(childId)) parent.childrenIds.push(childId);
    }
    if (child) {
      if (!child.parentIds) child.parentIds = [];
      if (!child.parentIds.includes(parentId)) child.parentIds.push(parentId);
    }
  });

  return members;
}

export function processAllFamilyData(raw: RawFamilyData): ProcessedFamilyData {
  const familyTreesStyled: StyledFamilyTree[] = raw.familyTrees.map((tree, treeIndex) => {
    // Enrich members from separate relationships (if present)
    const enrichedMembers = enrichMembersFromRelationships(tree);

    // Generation detection
    const generationMap = detectGenerations(enrichedMembers);

    // Tree accent color
    const treeAccent = getTreeAccent(treeIndex);

    // Process each member
    const members: StyledFamilyMember[] = enrichedMembers.map(m => {
      const age = computeAge(m.birthYear, m.deathYear);
      const ageCategory = getAgeCategory(age);
      const generationIndex = generationMap.get(m.id) ?? null;
      const colors = getNodeColors(ageCategory, treeAccent.hex);
      const imageConfig = getImageConfig(
        m.imageUrl ?? undefined, m.gender, ageCategory, colors.nodeBorderColorHex, m.isPrimaryInTree
      );

      return {
        ...m,
        fullName: `${m.firstName} ${m.lastName}`,
        age,
        ageCategory,
        generationIndex,
        baseColorHex: colors.baseColorHex,
        baseColorDescription: colors.baseColorDescription,
        nodeBorderColorHex: colors.nodeBorderColorHex,
        imageConfig,
      };
    });

    // Relationships — structured with heart/line config
    const relationships = buildRelationships(enrichedMembers, treeAccent.hex, tree.relationships?.spouses ?? []);

    return {
      familyTreeId: tree.familyTreeId,
      familyTreeDisplayName: tree.familyTreeDisplayName,
      familyTreeDisplayName_mr: tree.familyTreeDisplayName_mr,
      treeAccentColorHex: treeAccent.hex,
      treeAccentColorDescription: treeAccent.description,
      treeColorNotes: treeAccent.notes,
      members,
      relationships,
    };
  });

  return { familyTreesStyled };
}
