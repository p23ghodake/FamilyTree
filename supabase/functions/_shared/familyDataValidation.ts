import { findInvalidDate, isValidIsoDate, isValidYear } from './dateValidation.ts';

const GENDERS = new Set(['male', 'female', 'unknown']);
const END_REASONS = new Set(['divorce', 'death', 'annulment', 'separation']);
const SETTINGS_OPTIONS: Record<string, readonly string[]> = {
  connectorStyle: ['static', 'pulse', 'particles'],
  connectorShape: ['elbow', 'curve'],
  connectorSpeed: ['normal', 'slow', 'fast'],
  connectorTiming: ['cascade', 'together'],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function optionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function optionalStringArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(item => typeof item === 'string'));
}

function isSafeImageUrl(value: string): boolean {
  if (value.startsWith('data:image/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateMember(member: unknown): string | null {
  if (!isObject(member)) return 'Each family member must be an object.';
  if (typeof member.id !== 'string' || member.id.trim() === '') return 'Each family member must have a valid id.';
  if (typeof member.firstName !== 'string' || typeof member.lastName !== 'string') {
    return `Member "${member.id}" must have firstName and lastName strings.`;
  }
  if (typeof member.gender !== 'string' || !GENDERS.has(member.gender)) {
    return `Member "${member.id}" has an invalid gender.`;
  }
  for (const field of ['firstName_mr', 'lastName_mr', 'middleName', 'middleName_mr', 'spouseId']) {
    if (!optionalString(member[field])) return `Member "${member.id}" has an invalid ${field}.`;
  }
  for (const field of ['birthDate', 'deathDate', 'imageUrl', 'notes', 'occupation', 'location']) {
    if (!optionalNullableString(member[field])) return `Member "${member.id}" has an invalid ${field}.`;
  }
  for (const field of ['birthYear', 'deathYear']) {
    if (member[field] != null && !isValidYear(member[field])) return `Member "${member.id}" has an invalid ${field}.`;
  }
  if (member.birthDate != null && member.birthDate !== '' && !isValidIsoDate(member.birthDate)) {
    return `Member "${member.id}" has an invalid birthDate.`;
  }
  if (member.deathDate != null && member.deathDate !== '' && !isValidIsoDate(member.deathDate)) {
    return `Member "${member.id}" has an invalid deathDate.`;
  }
  if (member.isDeceased !== undefined && typeof member.isDeceased !== 'boolean') {
    return `Member "${member.id}" has an invalid deceased status.`;
  }
  if (member.isPrimaryInTree !== undefined && typeof member.isPrimaryInTree !== 'boolean') {
    return `Member "${member.id}" has an invalid isPrimaryInTree value.`;
  }
  for (const field of ['spouseIds', 'parentIds', 'childrenIds']) {
    if (!optionalStringArray(member[field])) return `Member "${member.id}" has an invalid ${field}.`;
  }
  if (typeof member.imageUrl === 'string' && member.imageUrl !== '' && !isSafeImageUrl(member.imageUrl)) {
    return `Member "${member.id}" has an unsafe image URL.`;
  }
  return null;
}

function validateRelationships(
  relationships: unknown,
  memberIds: Set<string>,
  treeId: string,
): string | null {
  if (relationships === undefined) return null;
  if (!isObject(relationships)) return `Tree "${treeId}" has invalid relationships.`;

  if (relationships.spouses !== undefined) {
    if (!Array.isArray(relationships.spouses)) return `Tree "${treeId}" has invalid spouse relationships.`;
    for (const relation of relationships.spouses) {
      if (!isObject(relation)
        || typeof relation.spouse1Id !== 'string'
        || typeof relation.spouse2Id !== 'string'
        || !memberIds.has(relation.spouse1Id)
        || !memberIds.has(relation.spouse2Id)) {
        return `Tree "${treeId}" has a spouse relationship referencing an unknown member.`;
      }
      if (relation.endReason !== undefined
        && (typeof relation.endReason !== 'string' || !END_REASONS.has(relation.endReason))) {
        return `Tree "${treeId}" has an invalid marriage end reason.`;
      }
    }
  }

  if (relationships.parentChild !== undefined) {
    if (!Array.isArray(relationships.parentChild)) return `Tree "${treeId}" has invalid parent-child relationships.`;
    for (const relation of relationships.parentChild) {
      if (!isObject(relation)
        || typeof relation.parentId !== 'string'
        || typeof relation.childId !== 'string'
        || !memberIds.has(relation.parentId)
        || !memberIds.has(relation.childId)
        || relation.parentId === relation.childId) {
        return `Tree "${treeId}" has an invalid parent-child relationship.`;
      }
    }
  }
  return null;
}

/**
 * Rejects malformed writes before they can replace the shared family-data file.
 * The client may repair import data, but the server never silently rewrites a request.
 */
export function validateFamilyData(input: unknown): string | null {
  if (!isObject(input) || !Array.isArray(input.familyTrees) || input.familyTrees.length === 0) {
    return 'Family data must contain a non-empty familyTrees array.';
  }

  if (input.settings !== undefined) {
    if (!isObject(input.settings)) return 'Family data has invalid display settings.';
    for (const [key, allowed] of Object.entries(SETTINGS_OPTIONS)) {
      if (input.settings[key] !== undefined && !allowed.includes(input.settings[key] as string)) {
        return `Family data has an invalid ${key} setting.`;
      }
    }
  }

  const treeIds = new Set<string>();
  for (const tree of input.familyTrees) {
    if (!isObject(tree)
      || typeof tree.familyTreeId !== 'string'
      || tree.familyTreeId.trim() === ''
      || typeof tree.familyTreeDisplayName !== 'string'
      || (tree.familyTreeDisplayName_mr !== undefined && typeof tree.familyTreeDisplayName_mr !== 'string')
      || !Array.isArray(tree.members)) {
      return 'Each family tree must have a valid id, display name, and members array.';
    }
    if (treeIds.has(tree.familyTreeId)) return `Duplicate family tree id "${tree.familyTreeId}".`;
    treeIds.add(tree.familyTreeId);

    const memberIds = new Set<string>();
    for (const member of tree.members) {
      const memberError = validateMember(member);
      if (memberError) return memberError;
      const id = (member as Record<string, unknown>).id as string;
      if (memberIds.has(id)) return `Tree "${tree.familyTreeId}" contains duplicate member id "${id}".`;
      memberIds.add(id);
    }

    const relationshipError = validateRelationships(tree.relationships, memberIds, tree.familyTreeId);
    if (relationshipError) return relationshipError;
  }

  return findInvalidDate(input);
}
