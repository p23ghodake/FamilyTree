import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { FamilyTreeProvider, useFamilyTree, buildRawExport, NO_FILTERS } from './FamilyTreeContext';
import { useAuth } from '../lib/AuthContext';
import { getFamilyData, saveFamilyData } from '../services/familyDataService';
import { buildTreeFromMembers } from '../processing/treeBuilder';
import { RawFamilyData } from '../types/FamilyTypes';

jest.mock('../lib/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/familyDataService', () => ({
  getFamilyData: jest.fn(),
  saveFamilyData: jest.fn(),
  FamilyDataServiceError: class extends Error {},
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

const rawData: RawFamilyData = {
  familyTrees: [{
    familyTreeId: 'test-tree', familyTreeDisplayName: 'Test Family',
    members: [
      { id: 'parent', firstName: 'Parent', lastName: 'Family', gender: 'male', birthYear: 1970, deathYear: null },
      { id: 'child', firstName: 'Child', lastName: 'Family', gender: 'female', birthYear: 2000, deathYear: null },
    ],
    relationships: { spouses: [], parentChild: [{ parentId: 'parent', childId: 'child' }] },
  }],
};

let context: ReturnType<typeof useFamilyTree>;
function Probe() {
  context = useFamilyTree();
  return null;
}

async function mountEditor() {
  render(<FamilyTreeProvider><Probe /></FamilyTreeProvider>);
  await waitFor(() => expect(context.canEdit).toBe(true));
}

const adminUser = { id: 'admin', identities: [{ provider: 'github', identity_data: { user_name: 'p23ghodake' } }] };
const editorUser = { id: 'editor', identities: [{ provider: 'github', identity_data: { user_name: 'cousin' } }] };
const githubToken = `h.${btoa(JSON.stringify({ amr: [{ method: 'oauth' }] }))}.s`;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  (useAuth as jest.Mock).mockReturnValue({ session: { user: adminUser, access_token: githubToken }, loading: false });
  (getFamilyData as jest.Mock).mockResolvedValue({ data: rawData, sha: 'original', canEdit: true });
  (saveFamilyData as jest.Mock).mockResolvedValue('saved');
});

it('starts with Hide females on and lets Clear switch every filter off', async () => {
  await mountEditor();
  expect(context.state.advancedFilters.hideFemale).toBe(true);
  act(() => context.dispatch({ type: 'SET_ADVANCED_FILTER', payload: { livingOnly: true } }));
  act(() => context.dispatch({ type: 'CLEAR_ADVANCED_FILTERS' }));
  expect(context.state.advancedFilters).toEqual(NO_FILTERS);
  expect(NO_FILTERS.hideFemale).toBe(false);
});

it('lets only administrators delete members, including through undo', async () => {
  (useAuth as jest.Mock).mockReturnValue({ session: { user: editorUser, access_token: githubToken }, loading: false });
  await mountEditor();
  act(() => context.dispatch({ type: 'DELETE_MEMBER', payload: { treeId: 'test-tree', memberId: 'child' } }));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(saveFamilyData).not.toHaveBeenCalled();
  expect(context.currentTree?.members).toHaveLength(2);

  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(context.currentTree?.members).toHaveLength(3));
  act(() => context.dispatch({ type: 'UNDO' }));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(saveFamilyData).toHaveBeenCalledTimes(1);
  expect(context.currentTree?.members).toHaveLength(3);
});

it('preserves exact birth and death dates when adding and editing', async () => {
  await mountEditor();
  const member = context.styleNewMember({
    id: 'new', firstName: 'New', lastName: 'Family', gender: 'male',
    birthYear: 1950, deathYear: 2020, birthDate: '1950-02-03', deathDate: '2020-04',
  });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(context.currentTree?.members).toHaveLength(3));
  expect((saveFamilyData as jest.Mock).mock.calls[0][0].familyTrees[0].members[2]).toMatchObject({
    birthDate: '1950-02-03', deathDate: '2020-04',
  });
  act(() => context.dispatch({ type: 'UPDATE_MEMBER', payload: {
    treeId: 'test-tree', member: context.styleNewMember({ ...member, birthDate: null, deathDate: '2020-05-06' }),
  } }));
  await waitFor(() => expect(context.currentTree?.members[2].deathDate).toBe('2020-05-06'));
  expect(context.currentTree?.members[2].birthDate).toBeUndefined();
});

it('keeps a surviving child visible after deleting the only parent', async () => {
  await mountEditor();
  act(() => context.dispatch({ type: 'DELETE_MEMBER', payload: { treeId: 'test-tree', memberId: 'parent' } }));
  await waitFor(() => expect(context.currentTree?.members).toHaveLength(1));
  const tree = context.currentTree!;
  expect(tree.members[0].parentIds).toEqual([]);
  expect(buildTreeFromMembers(tree.members, tree.relationships)[0].member.id).toBe('child');
});

it('rebuilds parent links and generations after adding a child', async () => {
  await mountEditor();
  const member = context.styleNewMember({ id: 'grandchild', firstName: 'Grandchild', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: {
    treeId: 'test-tree', member, relatedId: 'child', relType: 'child',
  } }));
  await waitFor(() => expect(context.currentTree?.members).toHaveLength(3));
  expect(context.currentTree?.members[2]).toMatchObject({ parentIds: ['child'], generationIndex: 3 });
  expect(context.currentTree?.members[1].childrenIds).toEqual(['grandchild']);
});

it('ignores a duplicate submission while the first save is pending', async () => {
  await mountEditor();
  let finishSave!: (sha: string) => void;
  (saveFamilyData as jest.Mock).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => {
    context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } });
    context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member: { ...member, id: 'duplicate' } } });
  });
  await waitFor(() => expect(saveFamilyData).toHaveBeenCalledTimes(1));
  expect(context.isSaving).toBe(true);
  await act(async () => finishSave('saved'));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(context.currentTree?.members.map(member => member.id)).toEqual(['parent', 'child', 'new']);
});

it('retains the form and original data when a save fails', async () => {
  await mountEditor();
  (saveFamilyData as jest.Mock).mockRejectedValue(new Error('Offline'));
  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => {
    context.dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'add' } });
    context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } });
  });
  await waitFor(() => expect(saveFamilyData).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(context.state.memberFormMode).toBe('add');
  expect(context.currentTree?.members).toHaveLength(2);
});

it('opens raw and legacy processed shared snapshots without saving', async () => {
  await mountEditor();
  const legacy = context.state.data!;
  act(() => expect(context.loadSharedData(JSON.stringify(buildRawExport(legacy)))).toBe(true));
  expect(context.canEdit).toBe(false);
  expect(context.cloudReady).toBe(false);
  act(() => expect(context.loadSharedData(JSON.stringify(legacy))).toBe(true));
  act(() => context.dispatch({ type: 'DELETE_MEMBER', payload: { treeId: 'test-tree', memberId: 'parent' } }));
  expect(saveFamilyData).not.toHaveBeenCalled();
  expect(context.currentTree?.members).toHaveLength(2);
});

it('does not replace a shared snapshot with a late cloud response', async () => {
  let finishLoad!: (response: unknown) => void;
  (getFamilyData as jest.Mock).mockReturnValue(new Promise(resolve => { finishLoad = resolve; }));
  render(<FamilyTreeProvider><Probe /></FamilyTreeProvider>);
  act(() => context.loadSharedData(JSON.stringify(rawData)));
  await act(async () => finishLoad({ data: rawData, sha: 'remote', canEdit: true }));
  expect(context.canEdit).toBe(false);
  expect(context.cloudReady).toBe(false);
});

it('rejects malformed shared data without changing the current tree', async () => {
  await mountEditor();
  act(() => expect(context.loadSharedData('{}')).toBe(false));
  expect(context.canEdit).toBe(true);
  expect(saveFamilyData).not.toHaveBeenCalled();
});

it('prevents non-admin editors from resetting shared data', async () => {
  await mountEditor();
  act(() => context.resetData());
  expect(saveFamilyData).not.toHaveBeenCalled();
});

it('falls back to the built-in copy when loading fails', async () => {
  (getFamilyData as jest.Mock).mockRejectedValueOnce(new Error('Network down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<FamilyTreeProvider><Probe /></FamilyTreeProvider>);
  await waitFor(() => expect(context.cloudError).toBe('Network down'));
  expect(context.state.data).not.toBeNull();
  expect(context.canEdit).toBe(false);
  expect(context.cloudReady).toBe(false);
  (console.error as jest.Mock).mockRestore();
});

it('loads the built-in copy for guests without contacting GitHub', async () => {
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false });
  render(<FamilyTreeProvider><Probe /></FamilyTreeProvider>);
  await waitFor(() => expect(context.state.data).not.toBeNull());
  expect(getFamilyData).not.toHaveBeenCalled();
});

it('allows an authorized admin to reset shared data', async () => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: githubToken, user: {
    id: 'admin', identities: [{ provider: 'github', identity_data: { user_name: 'p23ghodake' } }],
  } }, loading: false });
  await mountEditor();
  act(() => context.resetData());
  await waitFor(() => expect(saveFamilyData).toHaveBeenCalledTimes(1));
});