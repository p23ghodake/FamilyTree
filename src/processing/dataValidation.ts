// ─── Data validation & sanitization for untrusted input ───
//
// All external data (JSON import, localStorage, and the shareable `?tree=` URL
// param) flows through here before reaching the processing pipeline. Structural
// problems are rejected with a human-readable message; recoverable issues
// (dangling relationship edges, unsafe image URLs) are repaired and reported as
// warnings so a partially-corrupt file still loads instead of crashing the app.

import {
  RawFamilyData,
  RawFamilyTree,
  RawFamilyMember,
  RawSpouseRelation,
  RawParentChildRelation,
} from '../types/FamilyTypes';

const VALID_GENDERS = new Set(['male', 'female', 'unknown']);

/**
 * Returns the URL if it uses a safe scheme for an <img src>, otherwise null.
 * Only `http:`, `https:` and `data:image/...` are permitted — this blocks
 * `javascript:` and other script-bearing or unexpected schemes.
 */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
  } catch {
    // Not a parseable absolute URL — treat as unsafe.
  }
  return null;
}

export interface ValidationResult {
  ok: boolean;
  /** Present and repaired when `ok` is true. */
  data?: RawFamilyData;
  /** Human-readable reason the data was rejected; present when `ok` is false. */
  error?: string;
  /** Non-fatal repairs that were applied. */
  warnings: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateMember(
  raw: unknown,
  treeLabel: string,
  index: number,
  warnings: string[]
): RawFamilyMember | { error: string } {
  if (!isObject(raw)) return { error: `${treeLabel}: member #${index + 1} is not an object.` };
  if (typeof raw.id !== 'string' || raw.id.trim() === '') {
    return { error: `${treeLabel}: member #${index + 1} is missing a valid "id".` };
  }
  if (typeof raw.firstName !== 'string' || typeof raw.lastName !== 'string') {
    return { error: `${treeLabel}: member "${raw.id}" is missing "firstName" or "lastName".` };
  }

  const member = { ...raw } as unknown as RawFamilyMember;

  if (!VALID_GENDERS.has(member.gender)) {
    warnings.push(`Member "${member.id}" had an invalid gender; defaulted to "unknown".`);
    member.gender = 'unknown';
  }
  if (member.birthYear !== null && typeof member.birthYear !== 'number') member.birthYear = null;
  if (member.deathYear !== null && typeof member.deathYear !== 'number') member.deathYear = null;

  const safeImage = sanitizeImageUrl(member.imageUrl);
  if (member.imageUrl && !safeImage) {
    warnings.push(`Member "${member.id}" had an unsafe image URL; it was removed.`);
  }
  member.imageUrl = safeImage;

  return member;
}

function validateTree(raw: unknown, index: number, warnings: string[]): RawFamilyTree | { error: string } {
  if (!isObject(raw)) return { error: `Tree #${index + 1} is not an object.` };
  if (typeof raw.familyTreeId !== 'string' || raw.familyTreeId.trim() === '') {
    return { error: `Tree #${index + 1} is missing a valid "familyTreeId".` };
  }
  if (typeof raw.familyTreeDisplayName !== 'string') {
    return { error: `Tree "${raw.familyTreeId}" is missing "familyTreeDisplayName".` };
  }
  if (!Array.isArray(raw.members)) {
    return { error: `Tree "${raw.familyTreeId}" is missing a "members" array.` };
  }

  const treeLabel = `Tree "${raw.familyTreeId}"`;
  const members: RawFamilyMember[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < raw.members.length; i++) {
    const result = validateMember(raw.members[i], treeLabel, i, warnings);
    if ('error' in result) return { error: result.error };
    if (seenIds.has(result.id)) {
      return { error: `${treeLabel}: duplicate member id "${result.id}".` };
    }
    seenIds.add(result.id);
    members.push(result);
  }

  // Relationships are optional; drop any edge that references an unknown member.
  const rawRel = isObject(raw.relationships) ? raw.relationships : undefined;
  const spouses = Array.isArray(rawRel?.spouses) ? rawRel!.spouses : [];
  const parentChild = Array.isArray(rawRel?.parentChild) ? rawRel!.parentChild : [];

  const validSpouses = spouses.filter((s: unknown) => {
    if (!isObject(s)) return false;
    const ok = seenIds.has(s.spouse1Id as string) && seenIds.has(s.spouse2Id as string);
    if (!ok) warnings.push(`${treeLabel}: dropped a spouse relationship referencing an unknown member.`);
    return ok;
  });

  const validParentChild = parentChild.filter((pc: unknown) => {
    if (!isObject(pc)) return false;
    const ok = seenIds.has(pc.parentId as string) && seenIds.has(pc.childId as string);
    if (!ok) warnings.push(`${treeLabel}: dropped a parent-child relationship referencing an unknown member.`);
    if (ok && pc.parentId === pc.childId) {
      warnings.push(`${treeLabel}: dropped a self-referencing parent-child relationship.`);
      return false;
    }
    return ok;
  });

  const tree: RawFamilyTree = {
    familyTreeId: raw.familyTreeId,
    familyTreeDisplayName: raw.familyTreeDisplayName,
    members,
    relationships: {
      spouses: validSpouses as unknown as RawSpouseRelation[],
      parentChild: validParentChild as unknown as RawParentChildRelation[],
    },
  };
  if (typeof raw.familyTreeDisplayName_mr === 'string') {
    tree.familyTreeDisplayName_mr = raw.familyTreeDisplayName_mr;
  }
  return tree;
}

/**
 * Validates and repairs untrusted data into a safe `RawFamilyData` shape.
 * Never throws — returns `{ ok: false, error }` for unrecoverable problems.
 */
export function validateRawFamilyData(input: unknown): ValidationResult {
  const warnings: string[] = [];

  if (!isObject(input)) {
    return { ok: false, error: 'Data is not a valid object.', warnings };
  }
  if (!Array.isArray(input.familyTrees)) {
    return { ok: false, error: 'Data is missing a "familyTrees" array.', warnings };
  }
  if (input.familyTrees.length === 0) {
    return { ok: false, error: 'Data contains no family trees.', warnings };
  }

  const familyTrees: RawFamilyTree[] = [];
  for (let i = 0; i < input.familyTrees.length; i++) {
    const result = validateTree(input.familyTrees[i], i, warnings);
    if ('error' in result) return { ok: false, error: result.error, warnings };
    familyTrees.push(result);
  }

  return { ok: true, data: { familyTrees }, warnings };
}
