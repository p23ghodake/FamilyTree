import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LZString from 'lz-string';
import { toPng } from 'html-to-image';
import { useFamilyTree, NO_FILTERS } from '../context/FamilyTreeContext';
import { useAuth } from '../lib/AuthContext';
import { translations } from '../i18n/translations';
import { processAllFamilyData } from '../processing/dataProcessor';
import { buildTreeFromMembers } from '../processing/treeBuilder';
import TopBar from './Layout/TopBar';
import ShareModal from './Layout/ShareModal';
import TreeLoader from './Layout/TreeLoader';
import MemberFormModal from './TreeView/MemberFormModal';
import { TreeBranch } from './TreeView/TreeBranch';
import TimelineModal from './Timeline/TimelineModal';

jest.mock('../context/FamilyTreeContext', () => ({
  ...jest.requireActual('../context/FamilyTreeContext'), useFamilyTree: jest.fn(),
}));
jest.mock('../lib/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('html-to-image', () => ({ toPng: jest.fn() }));
jest.mock('../processing/transliteration', () => ({ transliterateToMarathi: jest.fn().mockResolvedValue('') }));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

const t = translations.en;
const data = processAllFamilyData({ familyTrees: [{
  familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
  members: ['one', 'two', 'single'].map(id => ({
    id, firstName: id, lastName: 'Family', gender: 'male' as const, birthYear: 1980, deathYear: null,
  })),
  relationships: { spouses: [{ spouse1Id: 'one', spouse2Id: 'two' }], parentChild: [] },
}] });

let context: ReturnType<typeof useFamilyTree>;
beforeEach(() => {
  jest.clearAllMocks();
  context = {
    state: {
      data, past: [], future: [], selectedTreeId: 'test', selectedMemberId: null,
      searchQuery: '', error: null, memberFormMode: null, memberFormTargetId: null,
      advancedFilters: NO_FILTERS, relMode: false, relSource: null, relTarget: null,
      theme: 'light', avatarStyle: 'initials',
    },
    currentTree: data.familyTreesStyled[0],
    canEdit: true, cloudReady: true, cloudError: null, isSaving: false,
    canUndo: true, canRedo: true,
    filteredMembers: data.familyTreesStyled[0].members,
    matchedMemberIds: new Set(), advancedMatchedIds: new Set(), relResult: null,
    debouncedSearchQuery: '', dispatch: jest.fn(), exportData: jest.fn(), importData: jest.fn(),
    loadSharedData: jest.fn().mockReturnValue(true), resetData: jest.fn(), undo: jest.fn(), redo: jest.fn(),
    styleNewMember: jest.fn(),
  };
  (useFamilyTree as jest.Mock).mockImplementation(() => context);
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: false, signOut: jest.fn() });
});

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

it('preserves native undo in input, textarea and contenteditable fields', () => {
  render(<><TopBar /><input aria-label="Name" /><textarea aria-label="Notes" /><div contentEditable suppressContentEditableWarning><span>Editable</span></div></>);
  const targets = [screen.getByLabelText('Name'), screen.getByLabelText('Notes'), screen.getByText('Editable')];
  targets.forEach(target => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
  expect(context.undo).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(context.undo).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
  expect(context.redo).toHaveBeenCalledTimes(1);
});

it('shows reset only for admins and confirms the shared GitHub impact', () => {
  const view = render(<TopBar />);
  const openSettings = () => fireEvent.click(screen.getByRole('button', { name: t.settingsTitle }));
  openSettings();
  expect(screen.queryByRole('button', { name: t.settingsResetShared })).toBeNull();
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: true, canDelete: true });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  view.rerender(<TopBar />);
  fireEvent.click(screen.getByRole('button', { name: t.settingsResetShared }));
  expect(confirm).toHaveBeenCalledWith(t.confirmReset);
  expect(t.confirmReset).toContain('ALL shared family trees on GitHub');
  expect(context.resetData).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: t.settingsResetShared }));
  expect(context.resetData).toHaveBeenCalledTimes(1);
});

it('shows the poster view only to admins', () => {
  const view = render(<TopBar />);
  expect(screen.queryByRole('button', { name: t.viewPoster })).toBeNull();
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: true });
  view.rerender(<TopBar />);
  expect(screen.getByRole('button', { name: t.viewPoster })).toBeTruthy();
});

it('restores tree and viewport styles when PNG export fails', async () => {
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: true });
  (toPng as jest.Mock).mockRejectedValue(new Error('Image failed'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = render(<><TopBar />
    <div className="tree-view__content" style={{ overflow: 'hidden', height: '400px', maxHeight: '500px' }}>
      <div className="tree-chart" style={{ transform: 'scale(0.5)', transformOrigin: 'top center' }} />
    </div>
  </>);
  fireEvent.click(screen.getByRole('button', { name: t.settingsTitle }));
  fireEvent.click(screen.getByRole('button', { name: t.menuExportImage }));
  await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
  const tree = view.container.querySelector('.tree-chart') as HTMLElement;
  const viewport = view.container.querySelector('.tree-view__content') as HTMLElement;
  await waitFor(() => expect(tree.style.transform).toBe('scale(0.5)'));
  expect(tree.style.transformOrigin).toBe('top center');
  expect(viewport.style.overflow).toBe('hidden');
  expect(viewport.style.height).toBe('400px');
  expect(viewport.style.maxHeight).toBe('500px');
});

function openAddForm(relation: string, targetName?: RegExp) {
  context.state.memberFormMode = 'add';
  render(<MemberFormModal />);
  fireEvent.click(screen.getByRole('button', { name: relation }));
  if (targetName) fireEvent.click(screen.getByRole('button', { name: targetName }));
}

function fillNamesAndContinue() {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  fireEvent.change(screen.getByPlaceholderText(t.placeholderFirstName), { target: { value: 'New' } });
  fireEvent.change(screen.getByPlaceholderText(t.placeholderLastName), { target: { value: 'Family' } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
}

it('requires a target when a relationship is selected', () => {
  openAddForm(t.relTileChild);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  expect(screen.getByRole('alert').textContent).toBe(t.chooseMember);
  expect(screen.getByRole('heading', { name: t.wizardQRelation })).toBeTruthy();
  expect(context.dispatch).not.toHaveBeenCalled();
});

it('rejects a known underage spouse target in the standalone form', () => {
  context.currentTree = {
    ...context.currentTree!, members: context.currentTree!.members.map(member => ({
      ...member, birthYear: new Date().getFullYear() - 10, birthDate: null, age: 10,
    })),
  };
  openAddForm(t.relTileSpouse, /single Family/);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  expect(screen.getByRole('alert').textContent).toBe(t.belowMarriageAge('single Family', 10, 21));
  expect(context.dispatch).not.toHaveBeenCalled();
});

it('rejects a known underage new spouse', () => {
  openAddForm(t.relTileSpouse, /single Family/);
  fillNamesAndContinue();
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: String(new Date().getFullYear() - 10) } });
  fireEvent.click(screen.getByRole('button', { name: t.btnAddNamed('New') }));
  expect(screen.getByText(t.belowMarriageAge('New Family', 10, 21))).toBeTruthy();
  expect(context.dispatch).not.toHaveBeenCalled();
});

it('walks through the steps, hides death dates for living people and adds the member', () => {
  openAddForm(t.relTileChild, /one Family/);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  expect(screen.getByText(t.firstNameRequired)).toBeTruthy();
  expect(screen.getByRole('heading', { name: t.wizardQWho })).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText(t.placeholderFirstName), { target: { value: 'New' } });
  fireEvent.change(screen.getByPlaceholderText(t.placeholderLastName), { target: { value: 'Family' } });
  fireEvent.click(screen.getByRole('button', { name: t.optionFemale }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  expect(screen.queryByLabelText(t.labelDeathYear)).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: t.labelLiving }));
  expect(screen.getByLabelText(t.labelDeathYear)).toBeTruthy();
  fireEvent.click(screen.getByRole('switch', { name: t.labelLiving }));
  fireEvent.click(screen.getByRole('button', { name: t.btnAddNamed('New') }));
  expect(context.styleNewMember).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'New', gender: 'female', deathYear: null }));
  expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: 'ADD_MEMBER', payload: expect.objectContaining({ relatedId: 'one', relType: 'child' }),
  }));
});

it('lets a child be added straight from the name step', () => {
  context.state.memberFormMode = 'addChild';
  context.state.memberFormTargetId = 'one';
  render(<MemberFormModal />);
  expect(screen.getByText(`${t.wizardStepOf(1, 2)} · ${t.relChildOf} one Family`)).toBeTruthy();
  expect((screen.getByPlaceholderText(t.placeholderLastName) as HTMLInputElement).value).toBe('Family');
  fireEvent.change(screen.getByPlaceholderText(t.placeholderFirstName), { target: { value: 'Kid' } });
  fireEvent.click(screen.getByRole('button', { name: t.btnSkipAdd }));
  expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: 'ADD_MEMBER', payload: expect.objectContaining({ relatedId: 'one', relType: 'child' }),
  }));
});

it('lets editors jump between steps and save from any of them', () => {
  context.state.memberFormMode = 'edit';
  context.state.memberFormTargetId = 'one';
  render(<MemberFormModal />);
  expect(screen.queryByRole('button', { name: new RegExp(t.btnNext) })).toBeNull();
  expect(screen.queryByRole('button', { name: t.btnDeleteMember })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.wizardStepDetails) }));
  fireEvent.change(screen.getByLabelText(t.labelOccupation), { target: { value: 'Teacher' } });
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  expect(context.styleNewMember).toHaveBeenCalledWith(expect.objectContaining({ id: 'one', occupation: 'Teacher' }));
  expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_MEMBER' }));
});

it('shows member deletion only to the admin signed in with GitHub', () => {
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: true, canDelete: false });
  context.state.memberFormMode = 'edit';
  context.state.memberFormTargetId = 'one';
  const view = render(<MemberFormModal />);
  expect(screen.queryByRole('button', { name: t.btnDeleteMember })).toBeNull();
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: true, canDelete: true });
  view.rerender(<MemberFormModal />);
  fireEvent.click(screen.getByRole('button', { name: t.btnDeleteMember }));
  fireEvent.click(screen.getByRole('button', { name: t.btnYesDelete }));
  expect(context.dispatch).toHaveBeenCalledWith({ type: 'DELETE_MEMBER', payload: { treeId: 'test', memberId: 'one' } });
});

it('disables saving, form edits and dismissal until the network save finishes', () => {
  context.state.memberFormMode = 'add';
  context.isSaving = true;
  render(<MemberFormModal />);
  const save = screen.getByRole('button', { name: t.btnSaving }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  expect((screen.getByRole('button', { name: t.close }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: t.relTileChild }).closest('fieldset')?.disabled).toBe(true);
  fireEvent.click(save);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(context.dispatch).not.toHaveBeenCalled();
});

function renderBranches(filterActive: boolean, marriageFilterActive = false) {
  const tree = context.currentTree!;
  return render(<ul>{buildTreeFromMembers(tree.members, tree.relationships).map(node => <TreeBranch
    key={node.member.id} node={node} selectedId={null} isSearching={false}
    searchMatchedIds={new Set()} onSelect={jest.fn()} filterMatchedIds={new Set()}
    filterActive={filterActive} marriageMatchedIds={new Set(['single'])}
    relSource={null} relTarget={null} relPathSet={new Set()} bloodPathIds={new Set()}
    marriageFilterActive={marriageFilterActive} avatarStyle="initials" relStep={null}
  />)}</ul>);
}

it('dims every member when an active filter has zero matches', () => {
  const view = renderBranches(true);
  expect(view.container.querySelectorAll('.pnode--dimmed')).toHaveLength(3);
});

it('does not dim members when filtering is inactive', () => {
  const view = renderBranches(false);
  expect(view.container.querySelectorAll('.pnode--dimmed')).toHaveLength(0);
});

it('shows marriage eligibility badges only for matching unmarried members', () => {
  const view = renderBranches(true, true);
  const badges = view.container.querySelectorAll('.pnode__marriage-badge');
  expect(badges).toHaveLength(1);
  expect(badges[0].closest('[data-member-id]')?.getAttribute('data-member-id')).toBe('single');
});

it('places crowded timeline events separately and exposes details on focus and tap', () => {
  context.currentTree = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'crowded', familyTreeDisplayName: 'Crowded',
    members: Array.from({ length: 20 }, (_, index) => ({
      id: `event-${index}`, firstName: `Person${index}`, lastName: 'Family', gender: 'unknown' as const,
      birthYear: 2000, deathYear: null,
    })), relationships: { spouses: [], parentChild: [] },
  }] }).familyTreesStyled[0];
  const view = render(<TimelineModal onClose={jest.fn()} />);
  const events = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.tl-dot'));
  expect(events).toHaveLength(20);
  const positions = events.map(event => `${event.parentElement?.className}/${event.style.left}/${event.style.top}/${event.style.bottom}`);
  expect(new Set(positions).size).toBe(20);
  const canvas = view.container.querySelector('.tl-canvas') as HTMLElement;
  expect(parseInt(canvas.style.gridTemplateRows, 10)).toBeGreaterThan(300);
  fireEvent.focus(events[0]);
  expect(screen.getByRole('tooltip').textContent).toContain('Person0');
  fireEvent.blur(events[0]);
  fireEvent.click(events[1]);
  expect(screen.getByRole('tooltip').textContent).toContain('Person2');
});

it('generates share links in raw family data format', () => {
  render(<ShareModal onClose={jest.fn()} />);
  const url = new URL((screen.getByRole('textbox') as HTMLInputElement).value);
  const snapshot = JSON.parse(LZString.decompressFromEncodedURIComponent(url.searchParams.get('tree')!)!);
  expect(snapshot.familyTrees).toHaveLength(1);
  expect(snapshot.familyTreesStyled).toBeUndefined();
  expect(snapshot.familyTrees[0].members[0].imageConfig).toBeUndefined();
});

it('loads shared links without cloud import and retains the reloadable URL', () => {
  const snapshot = JSON.stringify({ familyTrees: [] });
  const query = `/?tree=${LZString.compressToEncodedURIComponent(snapshot)}`;
  window.history.replaceState({}, '', query);
  render(<TreeLoader />);
  expect(context.loadSharedData).toHaveBeenCalledWith(snapshot);
  expect(context.importData).not.toHaveBeenCalled();
  expect(window.location.search).toBe(query.slice(1));
});