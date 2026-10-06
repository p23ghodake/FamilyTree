import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import { produce } from 'immer';
import toast from 'react-hot-toast';
import {
  ProcessedFamilyData,
  StyledFamilyTree,
  StyledFamilyMember,
  RawFamilyData,
  RawFamilyMember,
  AvatarStyle,
} from '../types/FamilyTypes';
import { processAllFamilyData } from '../processing/dataProcessor';
import { validateRawFamilyData } from '../processing/dataValidation';
import { computeAge, getAgeCategory } from '../processing/ageCalculation';
import { getNodeColors } from '../processing/nodeStyling';
import { getImageConfig } from '../processing/imageRules';
import { computeRelationship, RelationshipResult } from '../processing/relationshipFinder';
import { memberMatchesQuery } from '../processing/searchFilter';
import { ThemeName, applyTheme, loadSavedTheme } from '../theme/themeConfig';
import familyDataJson from '../data/g_familyData.json';
import { useAuth } from '../lib/AuthContext';
import { FamilyDataServiceError, getFamilyData, saveFamilyData } from '../services/familyDataService';

import { CONFIG } from '../constants/config';

const AVATAR_STYLE_KEY = CONFIG.storage.AVATAR_STYLE_KEY;

function loadSavedAvatarStyle(): AvatarStyle {
  try {
    const saved = localStorage.getItem(AVATAR_STYLE_KEY);
    if (
      saved === 'initials' || saved === 'emoji' ||
      saved === 'silhouette-flat' || saved === 'silhouette-bold'
    ) return saved as AvatarStyle;
  } catch {}
  return 'silhouette';
}

/** Strips computed/styling fields — produces raw format matching familyData.json */
function buildRawExport(data: ProcessedFamilyData): RawFamilyData {
  return {
    familyTrees: data.familyTreesStyled.map(tree => ({
      familyTreeId: tree.familyTreeId,
      familyTreeDisplayName: tree.familyTreeDisplayName,
      ...(tree.familyTreeDisplayName_mr && { familyTreeDisplayName_mr: tree.familyTreeDisplayName_mr }),
      members: tree.members.map(m => {
        const raw: RawFamilyMember = {
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          gender: m.gender,
          ...(m.middleName !== undefined && { middleName: m.middleName }),
          ...(m.middleName_mr !== undefined && { middleName_mr: m.middleName_mr }),
          birthYear: m.birthYear,
          deathYear: m.deathYear,
          imageUrl: m.imageUrl ?? null,
          isPrimaryInTree: m.isPrimaryInTree ?? false,
          notes: m.notes ?? null,
          occupation: m.occupation ?? null,
          location: m.location ?? null,
        };
        if (m.firstName_mr) raw.firstName_mr = m.firstName_mr;
        if (m.lastName_mr)  raw.lastName_mr  = m.lastName_mr;
        if (m.birthDate)    raw.birthDate    = m.birthDate;
        if (m.deathDate)    raw.deathDate    = m.deathDate;
        return raw;
      }),
      relationships: {
        spouses: tree.relationships.spouses.map(s => ({
          spouse1Id: s.spouse1Id,
          spouse2Id: s.spouse2Id,
          ...(s.marriageYear !== undefined && { marriageYear: s.marriageYear }),
          ...(s.endYear      && { endYear:      s.endYear }),
          ...(s.endReason    && { endReason:    s.endReason }),
        })),
        parentChild: tree.relationships.parentChild.map(pc => ({
          parentId: pc.parentId,
          childId:  pc.childId,
        })),
      },
    })),
  };
}

// ─── Member form mode ───

export type MemberFormMode = 'add' | 'edit' | 'addChild' | 'addSpouse' | null;

// ─── Advanced filters ───

export interface AdvancedFilters {
  livingOnly: boolean;
  location: string;
  occupation: string;
  gender: 'all' | 'male' | 'female';
  dimMode: 'dim' | 'hide';
  marriageEligible: boolean;
}

export const DEFAULT_FILTERS: AdvancedFilters = {
  livingOnly: false,
  location: '',
  occupation: '',
  gender: 'all',
  dimMode: 'dim',
  marriageEligible: false,
};

export function isFiltersActive(f: AdvancedFilters): boolean {
  return f.livingOnly || f.location !== '' || f.occupation !== '' || f.gender !== 'all' || f.marriageEligible;
}

// ─── Undo/redo ───

const MAX_HISTORY = CONFIG.ui.MAX_UNDO_HISTORY;

/** Push current data onto past[], cap at MAX_HISTORY, clear future */
function withHistory(state: State): Pick<State, 'past' | 'future'> {
  if (!state.data) return { past: state.past, future: state.future };
  const past = [...state.past, state.data];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, future: [] };
}

// ─── State ───

interface State {
  data: ProcessedFamilyData | null;
  past: ProcessedFamilyData[];
  future: ProcessedFamilyData[];
  selectedTreeId: string | null;
  selectedMemberId: string | null;
  searchQuery: string;
  error: string | null;
  memberFormMode: MemberFormMode;
  memberFormTargetId: string | null;
  advancedFilters: AdvancedFilters;
  relMode: boolean;
  relSource: string | null;
  relTarget: string | null;
  theme: ThemeName;
  avatarStyle: AvatarStyle;
}

const initialState: State = {
  data: null,
  past: [],
  future: [],
  selectedTreeId: null,
  selectedMemberId: null,
  searchQuery: '',
  error: null,
  memberFormMode: null,
  memberFormTargetId: null,
  advancedFilters: DEFAULT_FILTERS,
  relMode: false,
  relSource: null,
  relTarget: null,
  theme: loadSavedTheme(),
  avatarStyle: loadSavedAvatarStyle(),
};

// ─── Actions ───

type Action =
  | { type: 'SET_DATA'; payload: ProcessedFamilyData }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SELECT_TREE'; payload: string }
  | { type: 'SELECT_MEMBER'; payload: string | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'IMPORT_DATA'; payload: ProcessedFamilyData }
  | { type: 'SET_ADVANCED_FILTER'; payload: Partial<AdvancedFilters> }
  | { type: 'CLEAR_ADVANCED_FILTERS' }
  | { type: 'TOGGLE_REL_MODE' }
  | { type: 'SET_REL_NODE'; payload: string }
  | { type: 'CLEAR_REL_PATH' }
  | { type: 'SET_THEME'; payload: ThemeName }
  | { type: 'SET_AVATAR_STYLE'; payload: AvatarStyle }
  | { type: 'OPEN_MEMBER_FORM'; payload: { mode: MemberFormMode; targetId?: string } }
  | { type: 'CLOSE_MEMBER_FORM' }
  | { type: 'ADD_MEMBER'; payload: { treeId: string; member: StyledFamilyMember; relatedId?: string; relType?: 'child' | 'spouse' | 'parentOf' } }
  | { type: 'UPDATE_MEMBER'; payload: { treeId: string; member: StyledFamilyMember } }
  | { type: 'DELETE_MEMBER'; payload: { treeId: string; memberId: string } }
  | { type: 'END_MARRIAGE'; payload: { treeId: string; spouse1Id: string; spouse2Id: string; endYear: number; endReason?: 'divorce' | 'death' | 'annulment' | 'separation' } }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const DATA_MUTATION_ACTIONS = new Set<Action['type']>([
  'IMPORT_DATA',
  'ADD_MEMBER',
  'UPDATE_MEMBER',
  'DELETE_MEMBER',
  'END_MARRIAGE',
  'UNDO',
  'REDO',
]);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        past: [],
        future: [],
        data: action.payload,
        selectedTreeId: action.payload.familyTreesStyled[0]?.familyTreeId ?? null,
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SELECT_TREE':
      return { ...state, selectedTreeId: action.payload, selectedMemberId: null, relMode: false, relSource: null, relTarget: null };
    case 'SELECT_MEMBER':
      return { ...state, selectedMemberId: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'IMPORT_DATA':
      return {
        ...state,
        ...withHistory(state),
        data: action.payload,
        selectedTreeId: action.payload.familyTreesStyled[0]?.familyTreeId ?? null,
        selectedMemberId: null,
        relMode: false, relSource: null, relTarget: null,
        error: null,
      };

    case 'OPEN_MEMBER_FORM':
      return {
        ...state,
        memberFormMode: action.payload.mode,
        memberFormTargetId: action.payload.targetId ?? null,
      };
    case 'CLOSE_MEMBER_FORM':
      return { ...state, memberFormMode: null, memberFormTargetId: null };

    case 'ADD_MEMBER': {
      if (!state.data) return state;
      const { treeId, member, relatedId, relType } = action.payload;
      return produce(state, draft => {
        const tree = draft.data!.familyTreesStyled.find(t => t.familyTreeId === treeId);
        if (!tree) return;
        tree.members.push(member);
        if (relatedId && relType === 'spouse') {
          tree.relationships.spouses.push({
            spouse1Id: relatedId, spouse2Id: member.id,
            status: 'current',
            showHeart: true, heartIconType: 'solid',
            heartColorHex: CONFIG.colors.SPOUSE_CURRENT_COLOR, heartSizePx: 12,
            lineStyle: { strokeColorHex: CONFIG.colors.SPOUSE_CURRENT_COLOR, strokeWidthPx: 2, lineStyle: 'solid' },
          });
        }
        if (relatedId && relType === 'parentOf') {
          tree.relationships.parentChild.push({
            parentId: member.id, childId: relatedId,
            lineStyle: { strokeColorHex: CONFIG.colors.PARENT_CHILD_LINE_COLOR, strokeWidthPx: 2, lineStyle: 'solid' },
          });
        }
        if (relatedId && relType === 'child') {
          tree.relationships.parentChild.push({
            parentId: relatedId, childId: member.id,
            lineStyle: { strokeColorHex: CONFIG.colors.PARENT_CHILD_LINE_COLOR, strokeWidthPx: 2, lineStyle: 'solid' },
          });
        }
        Object.assign(draft, withHistory(state));
        draft.memberFormMode = null;
        draft.memberFormTargetId = null;
      });
    }

    case 'UPDATE_MEMBER': {
      if (!state.data) return state;
      const { treeId, member } = action.payload;
      return produce(state, draft => {
        const tree = draft.data!.familyTreesStyled.find(t => t.familyTreeId === treeId);
        if (!tree) return;
        const idx = tree.members.findIndex(m => m.id === member.id);
        if (idx !== -1) Object.assign(tree.members[idx], member);
        Object.assign(draft, withHistory(state));
        draft.memberFormMode = null;
        draft.memberFormTargetId = null;
      });
    }

    case 'DELETE_MEMBER': {
      if (!state.data) return state;
      const { treeId, memberId } = action.payload;
      return produce(state, draft => {
        const tree = draft.data!.familyTreesStyled.find(t => t.familyTreeId === treeId);
        if (!tree) return;
        tree.members = tree.members.filter(m => m.id !== memberId) as typeof tree.members;
        tree.relationships.spouses = tree.relationships.spouses.filter(
          r => r.spouse1Id !== memberId && r.spouse2Id !== memberId
        ) as typeof tree.relationships.spouses;
        tree.relationships.parentChild = tree.relationships.parentChild.filter(
          r => r.parentId !== memberId && r.childId !== memberId
        ) as typeof tree.relationships.parentChild;
        Object.assign(draft, withHistory(state));
        if (draft.selectedMemberId === memberId) draft.selectedMemberId = null;
      });
    }

    case 'SET_ADVANCED_FILTER':
      return { ...state, advancedFilters: { ...state.advancedFilters, ...action.payload } };

    case 'END_MARRIAGE': {
      if (!state.data) return state;
      const { treeId, spouse1Id, spouse2Id, endYear, endReason } = action.payload;
      return produce(state, draft => {
        const tree = draft.data!.familyTreesStyled.find(t => t.familyTreeId === treeId);
        if (!tree) return;
        tree.relationships.spouses.forEach(r => {
          const matches =
            (r.spouse1Id === spouse1Id && r.spouse2Id === spouse2Id) ||
            (r.spouse1Id === spouse2Id && r.spouse2Id === spouse1Id);
          if (!matches) return;
          r.status = 'former';
          r.endYear = endYear;
          r.endReason = endReason;
          r.showHeart = false;
          r.heartColorHex = CONFIG.colors.SPOUSE_FORMER_COLOR;
          r.lineStyle = { ...r.lineStyle, strokeColorHex: CONFIG.colors.SPOUSE_FORMER_COLOR, lineStyle: 'dashed' };
        });
        Object.assign(draft, withHistory(state));
      });
    }

    case 'CLEAR_ADVANCED_FILTERS':
      return { ...state, advancedFilters: DEFAULT_FILTERS };

    case 'TOGGLE_REL_MODE':
      return { ...state, relMode: !state.relMode, relSource: null, relTarget: null };
    case 'SET_REL_NODE': {
      const id = action.payload;
      if (!state.relSource || (state.relSource && state.relTarget)) {
        // Start fresh: set as source
        return { ...state, relSource: id, relTarget: null };
      }
      if (id === state.relSource) {
        // Clicking source again = deselect
        return { ...state, relSource: null, relTarget: null };
      }
      return { ...state, relTarget: id };
    }
    case 'CLEAR_REL_PATH':
      return { ...state, relSource: null, relTarget: null };

    case 'SET_THEME':
      applyTheme(action.payload);
      return { ...state, theme: action.payload };

    case 'SET_AVATAR_STYLE':
      try { localStorage.setItem(AVATAR_STYLE_KEY, action.payload); } catch {}
      return { ...state, avatarStyle: action.payload };

    case 'UNDO': {
      if (state.past.length === 0 || !state.data) return state;
      const past = [...state.past];
      const previous = past.pop()!;
      const future = [state.data, ...state.future];
      return { ...state, data: previous, past, future };
    }

    case 'REDO': {
      if (state.future.length === 0 || !state.data) return state;
      const future = [...state.future];
      const next = future.shift()!;
      const past = [...state.past, state.data];
      if (past.length > MAX_HISTORY) past.shift();
      return { ...state, data: next, past, future };
    }

    default:
      return state;
  }
}

// ─── Context ───

interface FamilyTreeContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  cloudReady: boolean;
  cloudError: string | null;
  isSaving: boolean;
  currentTree: StyledFamilyTree | null;
  filteredMembers: StyledFamilyMember[];
  matchedMemberIds: Set<string>;
  advancedMatchedIds: Set<string>;
  relResult: RelationshipResult | null;
  debouncedSearchQuery: string;
  exportData: () => void;
  importData: (jsonStr: string) => void;
  resetData: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  styleNewMember: (raw: Partial<StyledFamilyMember> & { id: string; firstName: string; lastName: string; gender: 'male' | 'female' | 'unknown' }) => StyledFamilyMember;
}

const FamilyTreeContext = createContext<FamilyTreeContextValue | null>(null);

// ─── Provider ───

export function FamilyTreeProvider({ children }: { children: ReactNode }) {
  const [state, reducerDispatch] = useReducer(reducer, initialState);
  const { session, loading: authLoading } = useAuth();
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const stateRef = useRef(state);
  const shaRef = useRef<string | null>(null);
  const cloudReadyRef = useRef(false);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const conflictGenerationRef = useRef(0);
  stateRef.current = state;

  const setCloudReadyState = useCallback((ready: boolean) => {
    cloudReadyRef.current = ready;
    setCloudReady(ready);
  }, []);

  const dispatch = useCallback((action: Action) => {
    if (!DATA_MUTATION_ACTIONS.has(action.type)) {
      stateRef.current = reducer(stateRef.current, action);
      reducerDispatch(action);
      return;
    }

    const generation = conflictGenerationRef.current;
    mutationQueueRef.current = mutationQueueRef.current.then(async () => {
      if (generation !== conflictGenerationRef.current) return;
      if (!session) {
        toast.error('Sign in before changing family data.', { id: 'family-save' });
        return;
      }
      if (!cloudReadyRef.current || !shaRef.current) {
        toast.error('Family data is not ready to save. Reload the latest data and try again.', { id: 'family-save' });
        return;
      }

      const currentState = stateRef.current;
      const nextState = reducer(currentState, action);
      if (!nextState.data || nextState.data === currentState.data) return;

      setIsSaving(true);
      try {
        shaRef.current = await saveFamilyData(buildRawExport(nextState.data), shaRef.current);
        stateRef.current = nextState;
        reducerDispatch(action);
        toast.success('Family data saved to GitHub.', { id: 'family-save' });
      } catch (error) {
        if (error instanceof FamilyDataServiceError && error.status === 409) {
          conflictGenerationRef.current += 1;
          setCloudReadyState(false);
          try {
            const latest = await getFamilyData();
            const validated = validateRawFamilyData(latest.data);
            if (!validated.ok || !validated.data) {
              throw new Error(validated.error ?? 'The latest GitHub family data is invalid.');
            }
            const refreshed = processAllFamilyData(validated.data);
            shaRef.current = latest.sha;
            stateRef.current = reducer(stateRef.current, { type: 'SET_DATA', payload: refreshed });
            reducerDispatch({ type: 'SET_DATA', payload: refreshed });
            setCloudReadyState(true);
            setCloudError(null);
            toast.error(`Another user saved changes first. The latest GitHub data has been loaded; reapply your change. (${error.message})`, {
              id: 'family-save-conflict',
              duration: 8000,
            });
          } catch (refreshError) {
            const message = refreshError instanceof Error ? refreshError.message : 'Unknown error';
            setCloudError(message);
            toast.error(
              `Save conflict detected, and the latest data could not be loaded: ${message}`,
              { id: 'family-save-conflict', duration: 8000 }
            );
          }
        } else {
          toast.error(
            `Family data was not saved: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { id: 'family-save' }
          );
        }
      } finally {
        setIsSaving(false);
      }
    }).catch(error => {
      console.error('Family data save queue failed:', error);
      toast.error('Family data could not be saved.', { id: 'family-save' });
    });
  }, [session, setCloudReadyState]);

  // Apply theme whenever it changes (including on mount)
  useEffect(() => {
    applyTheme(state.theme);
  }, [state.theme]);

  // Load the GitHub file for signed-in users; use the bundled file for guests or on load errors.
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const loadBundledData = () => {
      const result = validateRawFamilyData(familyDataJson);
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Bundled family data is invalid.');
      }
      const processed = processAllFamilyData(result.data);
      stateRef.current = reducer(stateRef.current, { type: 'SET_DATA', payload: processed });
      reducerDispatch({ type: 'SET_DATA', payload: processed });
    };

    shaRef.current = null;
    setCloudReadyState(false);
    setCloudError(null);
    if (!session) {
      try {
        loadBundledData();
      } catch (error) {
        reducerDispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load family data' });
      }
      return () => { active = false; };
    }

    getFamilyData().then(remote => {
      if (!active) return;
      const result = validateRawFamilyData(remote.data);
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'GitHub family data is invalid.');
      }
      const processed = processAllFamilyData(result.data);
      shaRef.current = remote.sha;
      stateRef.current = reducer(stateRef.current, { type: 'SET_DATA', payload: processed });
      reducerDispatch({ type: 'SET_DATA', payload: processed });
      setCloudReadyState(true);
      setCloudError(null);
    }).catch(error => {
      if (!active) return;
      console.error('Failed to load family data from GitHub:', error);
      try {
        loadBundledData();
        setCloudError(error instanceof Error ? error.message : 'Unknown error loading GitHub family data.');
        toast.error(
          `Could not load the latest GitHub family data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { id: 'family-load' }
        );
      } catch (fallbackError) {
        reducerDispatch({
          type: 'SET_ERROR',
          payload: fallbackError instanceof Error ? fallbackError.message : 'Failed to load family data',
        });
      }
    });

    return () => { active = false; };
  }, [authLoading, session, setCloudReadyState]);

  // Debounced search query — used for filtering to avoid O(n) scan on every keystroke
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(state.searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(state.searchQuery), CONFIG.ui.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);

  const currentTree = useMemo(() =>
    state.data?.familyTreesStyled.find(t => t.familyTreeId === state.selectedTreeId) ?? null,
    [state.data, state.selectedTreeId]
  );

  const filteredMembers = useMemo(() => {
    const members = currentTree?.members ?? [];
    if (debouncedSearchQuery === '') return members;
    return members.filter(m => memberMatchesQuery(m, debouncedSearchQuery));
  }, [currentTree, debouncedSearchQuery]);

  // Empty set when not searching so consumers can use `.size > 0` as a reliable
  // "is search active" signal without recomputing a full-member set unnecessarily.
  const matchedMemberIds = useMemo(() => {
    if (debouncedSearchQuery === '') return new Set<string>();
    return new Set(filteredMembers.map(m => m.id));
  }, [filteredMembers, debouncedSearchQuery]);

  // Advanced filter matching — empty set means "no filter active"
  const advancedMatchedIds = useMemo(() => {
    const f = state.advancedFilters;
    if (!isFiltersActive(f)) return new Set<string>();
    const members = currentTree?.members ?? [];
    const occQuery = f.occupation.toLowerCase();
    return new Set(
      members.filter(m => {
        if (f.livingOnly && m.deathYear !== null) return false;
        if (f.location && m.location !== f.location) return false;
        if (f.gender !== 'all' && m.gender !== f.gender) return false;
        if (f.occupation && !(m.occupation ?? '').toLowerCase().includes(occQuery)) return false;
        if (f.marriageEligible) {
          if (m.deathYear !== null) return false;                        // must be living
          if (m.age === null || m.gender === 'unknown') return false;    // age + gender must be known
          const minAge = m.gender === 'female' ? 18 : 21;
          if (m.age < minAge) return false;                             // below legal age
          const hasCurrentSpouse = currentTree?.relationships.spouses.some(
            r => (r.spouse1Id === m.id || r.spouse2Id === m.id) && r.status === 'current'
          ) ?? false;
          if (hasCurrentSpouse) return false;                           // already married
        }
        return true;
      }).map(m => m.id)
    );
  }, [currentTree, state.advancedFilters]);

  // Relationship path computation
  const relResult = useMemo((): RelationshipResult | null => {
    if (!state.relSource || !state.relTarget || !currentTree) return null;
    return computeRelationship(
      state.relSource,
      state.relTarget,
      currentTree.members,
      currentTree.relationships
    );
  }, [state.relSource, state.relTarget, currentTree]);

  // Auto-clear tracer selections if a selected member is removed from the tree
  useEffect(() => {
    if (!state.relSource && !state.relTarget) return;
    const ids = new Set(currentTree?.members.map(m => m.id) ?? []);
    const sourceGone = state.relSource ? !ids.has(state.relSource) : false;
    const targetGone = state.relTarget ? !ids.has(state.relTarget) : false;
    if (sourceGone || targetGone) dispatch({ type: 'CLEAR_REL_PATH' });
  }, [currentTree?.members, state.relSource, state.relTarget, dispatch]);

  const exportData = useCallback(() => {
    if (!state.data) return;
    const rawExport = buildRawExport(state.data);
    const blob = new Blob([JSON.stringify(rawExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'familyData.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.data]);

  const resetData = useCallback(() => {
    try {
      const result = validateRawFamilyData(familyDataJson);
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Bundled family data is invalid.');
      }
      const processed = processAllFamilyData(result.data);
      dispatch({ type: 'IMPORT_DATA', payload: processed });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to reset data' });
    }
  }, [dispatch]);

  const importData = useCallback((jsonStr: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      toast.error('Import failed — the file is not valid JSON.', { id: 'import-error' });
      return;
    }

    const result = validateRawFamilyData(parsed);
    if (!result.ok || !result.data) {
      toast.error(`Import failed — ${result.error ?? 'the data is not a valid family tree.'}`, { id: 'import-error' });
      return;
    }

    try {
      const processed = processAllFamilyData(result.data);
      dispatch({ type: 'IMPORT_DATA', payload: processed });
      if (result.warnings.length > 0) {
        toast(`Imported data includes ${result.warnings.length} repaired item(s); the save is in progress.`, {
          icon: '⚠️',
          id: 'import-warn',
        });
      }
    } catch (e) {
      console.error('Failed to process imported data:', e);
      toast.error('Import failed — the data could not be processed.', { id: 'import-error' });
    }
  }, [dispatch]);

  // Style a raw member with computed fields (for add/edit)
  const styleNewMember = useCallback((
    raw: Partial<StyledFamilyMember> & { id: string; firstName: string; lastName: string; gender: 'male' | 'female' | 'unknown' }
  ): StyledFamilyMember => {
    const treeAccentHex = currentTree?.treeAccentColorHex ?? '#3B82F6';
    const age = computeAge(raw.birthYear ?? null, raw.deathYear ?? null);
    const ageCategory = getAgeCategory(age);
    const colors = getNodeColors(ageCategory, treeAccentHex);
    const imageConfig = getImageConfig(raw.imageUrl ?? undefined, raw.gender, ageCategory, colors.nodeBorderColorHex, raw.isPrimaryInTree);

    // Estimate generationIndex from parents or existing members
    let generationIndex: number | null = null;
    if (raw.generationIndex !== undefined) {
      generationIndex = raw.generationIndex;
    } else if (raw.birthYear && currentTree) {
      const birthYears = currentTree.members.filter(m => m.birthYear).map(m => m.birthYear!);
      if (birthYears.length > 0) {
        const minYear = Math.min(...birthYears);
        generationIndex = Math.floor((raw.birthYear - minYear) / 30) + 1;
      }
    }

    return {
      id: raw.id,
      firstName: raw.firstName,
      lastName: raw.lastName,
      firstName_mr: raw.firstName_mr,
      lastName_mr: raw.lastName_mr,
      middleName: raw.middleName,
      middleName_mr: raw.middleName_mr,
      gender: raw.gender,
      birthYear: raw.birthYear ?? null,
      deathYear: raw.deathYear ?? null,
      imageUrl: raw.imageUrl ?? null,
      isPrimaryInTree: raw.isPrimaryInTree ?? false,
      notes: raw.notes ?? null,
      occupation: raw.occupation ?? null,
      location: raw.location ?? null,
      spouseId:  raw.spouseId,
      spouseIds: raw.spouseIds,
      parentIds: raw.parentIds,
      childrenIds: raw.childrenIds,
      fullName: `${raw.firstName} ${raw.lastName}`,
      age,
      ageCategory,
      generationIndex,
      baseColorHex: colors.baseColorHex,
      baseColorDescription: colors.baseColorDescription,
      nodeBorderColorHex: colors.nodeBorderColorHex,
      imageConfig,
    };
  }, [currentTree]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const contextValue = useMemo<FamilyTreeContextValue>(
    () => ({ state, dispatch, cloudReady, cloudError, isSaving, currentTree, filteredMembers, matchedMemberIds, advancedMatchedIds, relResult, debouncedSearchQuery, exportData, importData, resetData, undo, redo, canUndo, canRedo, styleNewMember }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, dispatch, cloudReady, cloudError, isSaving, currentTree, filteredMembers, matchedMemberIds, advancedMatchedIds, relResult, debouncedSearchQuery, exportData, importData, resetData, undo, redo, canUndo, canRedo, styleNewMember],
  );

  return (
    <FamilyTreeContext.Provider value={contextValue}>
      {children}
    </FamilyTreeContext.Provider>
  );
}

export function useFamilyTree() {
  const ctx = useContext(FamilyTreeContext);
  if (!ctx) throw new Error('useFamilyTree must be used within FamilyTreeProvider');
  return ctx;
}
