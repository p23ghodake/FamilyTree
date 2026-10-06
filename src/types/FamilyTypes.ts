// ─── Raw data types (matching JSON file structure) ───

export interface RawFamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  firstName_mr?: string;
  lastName_mr?: string;
  middleName?: string;
  middleName_mr?: string;
  gender: 'male' | 'female' | 'unknown';
  birthYear: number | null;
  deathYear: number | null;
  /** Full birth date in ISO format: "YYYY-MM-DD", "YYYY-MM", or omitted if only year known */
  birthDate?: string | null;
  /** Full death date in ISO format: "YYYY-MM-DD", "YYYY-MM", or omitted if only year known */
  deathDate?: string | null;
  imageUrl?: string | null;
  isPrimaryInTree?: boolean;
  notes?: string | null;
  occupation?: string | null;
  location?: string | null;
  // Legacy embedded relationship fields (optional)
  spouseId?: string;       // current spouse ID (backward compat; derived from relationships)
  spouseIds?: string[];    // all spouse IDs including former
  parentIds?: string[];
  childrenIds?: string[];
}

export interface RawSpouseRelation {
  spouse1Id: string;
  spouse2Id: string;
  marriageYear?: number;
  marriageDate?: string;   // ISO date e.g. "1480-06-15" or "1480-06" or "1480"
  endYear?: number;        // present → current marriage; set → former
  endDate?: string;        // ISO date of separation/death/divorce
  endReason?: 'divorce' | 'death' | 'annulment' | 'separation';
}

export interface RawParentChildRelation {
  parentId: string;
  childId: string;
}

export interface RawRelationships {
  spouses: RawSpouseRelation[];
  parentChild: RawParentChildRelation[];
}

export interface RawFamilyTree {
  familyTreeId: string;
  familyTreeDisplayName: string;
  familyTreeDisplayName_mr?: string;
  members: RawFamilyMember[];
  relationships?: RawRelationships;
}

export interface RawFamilyData {
  familyTrees: RawFamilyTree[];
}

// ─── Processed / styled types ───

export type AgeCategory = 'infant' | 'toddler' | 'youth' | 'adult' | 'senior' | 'unknown';
export type AvatarStyle = 'silhouette' | 'silhouette-flat' | 'silhouette-bold' | 'initials' | 'emoji';

export interface MemberImageConfig {
  finalImageUrl: string;
  imageSourceType: 'provided' | 'defaultAvatar';
  imageShape: 'circle';
  imageBorderColorHex: string;
  imageBorderWidthPx: number;
  imageHasShadow: boolean;
}

export interface StyledFamilyMember extends RawFamilyMember {
  fullName: string;
  age: number | null;
  ageCategory: AgeCategory;
  generationIndex: number | null;
  baseColorHex: string;
  baseColorDescription: string;
  nodeBorderColorHex: string;
  imageConfig: MemberImageConfig;
}

// ─── Relationship types ───

export interface LineStyleConfig {
  strokeColorHex: string;
  strokeWidthPx: number;
  lineStyle: 'solid' | 'dashed';
  cornerRadiusPx?: number;
}

export interface SpouseRelationship {
  spouse1Id: string;
  spouse2Id: string;
  status: 'current' | 'former';
  marriageYear?: number;
  endYear?: number;
  endReason?: 'divorce' | 'death' | 'annulment' | 'separation';
  showHeart: boolean;
  heartIconType: 'solid' | 'outline';
  heartColorHex: string;
  heartSizePx: number;
  lineStyle: LineStyleConfig;
}

export interface ParentChildRelationship {
  parentId: string;
  childId: string;
  lineStyle: LineStyleConfig;
}

export interface StyledRelationships {
  spouses: SpouseRelationship[];
  parentChild: ParentChildRelationship[];
}

// ─── Config types ───

export interface StyledFamilyTree {
  familyTreeId: string;
  familyTreeDisplayName: string;
  familyTreeDisplayName_mr?: string;
  treeAccentColorHex: string;
  treeAccentColorDescription: string;
  treeColorNotes: string;
  members: StyledFamilyMember[];
  relationships: StyledRelationships;
}

export interface ProcessedFamilyData {
  familyTreesStyled: StyledFamilyTree[];
}
