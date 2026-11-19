import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { useFamilyTree, NO_FILTERS } from '../context/FamilyTreeContext';
import { useAuth } from '../lib/AuthContext';
import { translations } from '../i18n/translations';
import { DEFAULT_DISPLAY_SETTINGS } from '../processing/displaySettings';
import { processAllFamilyData } from '../processing/dataProcessor';
import { buildTreeFromMembers } from '../processing/treeBuilder';
import TopBar from './Layout/TopBar';
import MemberFormModal from './TreeView/MemberFormModal';
import { TreeBranch } from './TreeView/TreeBranch';
import TimelineModal from './Timeline/TimelineModal';
import PosterModal from './Poster/PosterModal';

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
    canEdit: true, isAdmin: false, canDelete: false, cloudReady: true, limitedView: false, cloudError: null, isSaving: false,
    canUndo: true, canRedo: true,
    filteredMembers: data.familyTreesStyled[0].members,
    matchedMemberIds: new Set(), advancedMatchedIds: new Set(), relResult: null,
    debouncedSearchQuery: '', dispatch: jest.fn(), exportData: jest.fn(), importData: jest.fn(),
    resetData: jest.fn(), retryLoad: jest.fn(), undo: jest.fn(), redo: jest.fn(),
    styleNewMember: jest.fn(),
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS },
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
  context.isAdmin = true;
  context.canDelete = true;
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  view.rerender(<TopBar />);
  fireEvent.click(screen.getByRole('button', { name: t.settingsResetShared }));
  expect(confirm).toHaveBeenCalledWith(t.confirmReset);
  expect(t.confirmReset).toContain('Nothing on GitHub is changed');
  expect(context.resetData).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: t.settingsResetShared }));
  expect(context.resetData).toHaveBeenCalledTimes(1);
});

it('shows the tree line style controls only to admins and saves each change', () => {
  const view = render(<TopBar />);
  const openSettings = () => fireEvent.click(screen.getByRole('button', { name: t.settingsTitle }));
  openSettings();
  expect(screen.queryByRole('combobox', { name: t.settingsConnectorStyle })).toBeNull();
  fireEvent.keyDown(document.body, { key: 'Escape' });

  context.isAdmin = true;
  view.rerender(<TopBar />);
  openSettings();
  expect(screen.getByText(t.connectorSettingsHint)).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: t.settingsConnectorSpeed })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: t.settingsConnectorShape }), { target: { value: 'curve' } });
  expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_SETTINGS', payload: { connectorShape: 'curve' } });
  fireEvent.change(screen.getByRole('combobox', { name: t.settingsConnectorStyle }), { target: { value: 'pulse' } });
  expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_SETTINGS', payload: { connectorStyle: 'pulse' } });

  context.displaySettings = { ...context.displaySettings, connectorStyle: 'pulse' };
  view.rerender(<TopBar />);
  fireEvent.change(screen.getByRole('combobox', { name: t.settingsConnectorSpeed }), { target: { value: 'fast' } });
  fireEvent.change(screen.getByRole('combobox', { name: t.settingsConnectorTiming }), { target: { value: 'together' } });
  expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_SETTINGS', payload: { connectorSpeed: 'fast' } });
  expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_SETTINGS', payload: { connectorTiming: 'together' } });
  expect(screen.queryByRole('combobox', { name: /animate/i })).toBeNull();

  // Timing only applies to the pulse; controls lock while a save is running.
  context.displaySettings = { ...context.displaySettings, connectorStyle: 'particles' };
  context.isSaving = true;
  view.rerender(<TopBar />);
  expect(screen.queryByRole('combobox', { name: t.settingsConnectorTiming })).toBeNull();
  expect((screen.getByRole('combobox', { name: t.settingsConnectorStyle }) as HTMLSelectElement).disabled).toBe(true);
});

it('does not render lineage or share tree actions', () => {
  render(<TopBar />);
  expect(screen.queryByText(/Lineage|वंश फोकस/)).toBeNull();
  expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();
});

it('shows the poster view only to admins', () => {
  const view = render(<TopBar />);
  expect(screen.queryByRole('button', { name: t.viewPoster })).toBeNull();
  context.isAdmin = true;
  view.rerender(<TopBar />);
  expect(screen.getByRole('button', { name: t.viewPoster })).toBeTruthy();
});

it('offers only men as the poster starting person', () => {
  const people = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
    members: [['ram', 'male'], ['sita', 'female'], ['lav', 'male'], ['kush', 'male'], ['urmila', 'female']].map(([id, gender]) => ({
      id, firstName: id, lastName: 'Family', gender: gender as 'male' | 'female', birthYear: 1980, deathYear: null,
    })),
    relationships: { spouses: [{ spouse1Id: 'ram', spouse2Id: 'sita' }], parentChild: [['ram', 'lav'], ['ram', 'kush'], ['ram', 'urmila']].map(([parentId, childId]) => ({ parentId, childId })) },
  }] });
  context.currentTree = people.familyTreesStyled[0];
  context.state = { ...context.state, data: people, selectedMemberId: 'sita' };
  render(<PosterModal onClose={jest.fn()} />);
  const picker = screen.getByLabelText(t.posterStartFrom) as HTMLSelectElement;
  expect(Array.from(picker.options).map(o => o.value).sort()).toEqual(['kush', 'lav', 'ram']);
  expect(picker.value).toBe('ram');
});

it('lets the poster switch style, show life years and drop the paper texture', () => {
  const people = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
    members: [
      { id: 'ram', firstName: 'ram', lastName: 'Family', gender: 'male' as const, birthYear: 1920, deathYear: 1990 },
      { id: 'lav', firstName: 'lav', lastName: 'Family', gender: 'male' as const, birthYear: 1950, deathYear: null },
    ],
    relationships: { spouses: [], parentChild: [{ parentId: 'ram', childId: 'lav' }] },
  }] });
  context.currentTree = people.familyTreesStyled[0];
  context.state = { ...context.state, data: people, selectedMemberId: 'ram' };
  const view = render(<PosterModal onClose={jest.fn()} />);
  expect(screen.getByRole('group', { name: t.posterStyle })).toBeTruthy();
  expect(screen.getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['autumn', 'spring', 'summer', 'banyan']);
  const banyan = screen.getByRole('radio', { name: t.posterThemeNames.banyan }) as HTMLInputElement;
  fireEvent.click(banyan);
  expect(banyan.checked).toBe(true);
  expect(screen.queryByRole('button', { name: t.menuPrint })).toBeNull();

  expect(screen.queryByText(t.posterLifeYears(1920, 1990))).toBeNull();
  fireEvent.click(screen.getByLabelText(t.posterShowYears));
  expect(screen.getByText(t.posterLifeYears(1920, 1990))).toBeTruthy();
  expect(screen.getByText(t.posterLifeYears(1950, null))).toBeTruthy();

  const svg = view.baseElement.querySelector('.poster-sheet svg')!;
  expect(svg.querySelector('#poster-paper-texture')).toBeTruthy();
  fireEvent.click(screen.getByLabelText(t.posterAgedPaper));
  expect(svg.querySelector('[fill="url(#poster-paper-texture)"]')).toBeNull();
});

const posterFamily = () => {
  const people = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
    members: [
      { id: 'ram', firstName: 'Ram', lastName: 'Family', gender: 'male' as const, birthYear: 1920, deathYear: null },
      { id: 'sita', firstName: 'Sita', lastName: 'Family', gender: 'female' as const, birthYear: 1925, deathYear: null },
      { id: 'uma', firstName: 'Uma', lastName: 'Family', gender: 'female' as const, birthYear: 1935, deathYear: null },
      { id: 'lav', firstName: 'Lav', lastName: 'Family', gender: 'male' as const, birthYear: 1950, deathYear: null },
    ],
    relationships: {
      spouses: [{ spouse1Id: 'ram', spouse2Id: 'sita' }, { spouse1Id: 'ram', spouse2Id: 'uma' }],
      parentChild: [{ parentId: 'ram', childId: 'lav' }],
    },
  }] });
  context.currentTree = people.familyTreesStyled[0];
  context.state = { ...context.state, data: people, selectedMemberId: 'ram' };
};

it('zooms the poster with buttons and Ctrl + wheel, and Fit returns to the whole sheet', () => {
  posterFamily();
  const view = render(<PosterModal onClose={jest.fn()} />);
  const scroller = view.baseElement.querySelector('.poster-scroll') as HTMLElement;
  const sheet = view.baseElement.querySelector('.poster-sheet') as HTMLElement;
  const widthNow = () => parseInt(sheet.style.width, 10);
  expect(scroller.classList.contains('poster-scroll--fit')).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomIn }));
  expect(scroller.classList.contains('poster-scroll--fit')).toBe(false);
  const zoomedIn = widthNow();
  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomOut }));
  const one = widthNow();
  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomOut }));
  expect(zoomedIn).toBeGreaterThan(one);
  expect(one).toBeGreaterThan(widthNow());

  const before = widthNow();
  expect(fireEvent.wheel(scroller, { ctrlKey: true, deltaY: -100 })).toBe(false);
  expect(widthNow()).toBeGreaterThan(before);
  // A plain wheel still scrolls the poster.
  const after = widthNow();
  expect(fireEvent.wheel(scroller, { deltaY: -100 })).toBe(true);
  expect(widthNow()).toBe(after);

  fireEvent.click(screen.getByRole('button', { name: t.posterFit }));
  expect(scroller.classList.contains('poster-scroll--fit')).toBe(true);
});

it('hides fine detail on screen only when the poster is zoomed far out', () => {
  posterFamily();
  const view = render(<PosterModal onClose={jest.fn()} />);
  const sheet = view.baseElement.querySelector('.poster-sheet') as HTMLElement;
  const svg = sheet.querySelector('svg')!;
  expect(sheet.classList.contains('poster-sheet--far')).toBe(false);
  expect(svg.querySelectorAll('.poster-detail').length).toBeGreaterThan(0);

  const zoomOut = screen.getByRole('button', { name: t.tooltipZoomOut });
  for (let i = 0; i < 4; i++) fireEvent.click(zoomOut);
  expect(sheet.classList.contains('poster-sheet--far')).toBe(false);
  for (let i = 0; i < 2; i++) fireEvent.click(zoomOut);
  expect(sheet.classList.contains('poster-sheet--far')).toBe(true);
  // Detail is hidden by a class on the wrapper, so the SVG itself (which the PNG export copies) is untouched.
  expect(svg.classList.contains('poster-sheet--far')).toBe(false);
  expect(svg.querySelectorAll('.poster-detail').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomIn }));
  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomIn }));
  expect(sheet.classList.contains('poster-sheet--far')).toBe(false);
});

it('keeps long poster names intact without showing a print-size option', () => {
  const longName = 'RamchandraVithobaDeshmukh';
  const people = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
    members: [
      { id: 'ram', firstName: longName, lastName: 'Family', gender: 'male' as const, birthYear: null, deathYear: null },
      { id: 'son', firstName: 'Son', lastName: 'Family', gender: 'male' as const, birthYear: null, deathYear: null },
    ],
    relationships: { spouses: [], parentChild: [{ parentId: 'ram', childId: 'son' }] },
  }] });
  context.currentTree = people.familyTreesStyled[0];
  context.state = { ...context.state, data: people, selectedMemberId: 'ram' };
  const view = render(<PosterModal onClose={jest.fn()} />);
  const svg = view.baseElement.querySelector('.poster-sheet svg')!;
  expect(Array.from(svg.querySelectorAll('text')).some(node => node.textContent === longName)).toBe(true);
  expect(screen.queryByText('Print size')).toBeNull();
});

it('restores the poster download button when font inlining fails', async () => {
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockRejectedValue(new Error('Font fetch failed')),
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<PosterModal onClose={jest.fn()} />);
    const download = screen.getByRole('button', { name: t.posterDownload }) as HTMLButtonElement;
    fireEvent.click(download);
    await waitFor(() => expect(download.disabled).toBe(false));
    expect(toast.error).toHaveBeenCalledWith(t.alertExportFailed);
  } finally {
    if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
    else Reflect.deleteProperty(globalThis, 'fetch');
  }
});

it('restores tree and viewport styles when PNG export fails', async () => {
  context.isAdmin = true;
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

it('lets the editor explicitly link eligible existing children to a new spouse', () => {
  context.currentTree = {
    ...context.currentTree!,
    relationships: {
      ...context.currentTree!.relationships,
      parentChild: [{ parentId: 'single', childId: 'one', lineStyle: {
        strokeColorHex: '#000000', strokeWidthPx: 2, lineStyle: 'solid',
      } }],
    },
  };
  context.state.memberFormMode = 'addSpouse';
  context.state.memberFormTargetId = 'single';
  render(<MemberFormModal />);
  fillNamesAndContinue();

  const linkSwitch = screen.getByRole('switch', { name: t.switchLinkExistingChildren });
  expect(linkSwitch.getAttribute('aria-checked')).toBe('false');
  expect(screen.getByText(t.hintLinkExistingChildren)).toBeTruthy();
  fireEvent.click(linkSwitch);
  fireEvent.click(screen.getByRole('button', { name: t.btnAddNamed('New') }));

  expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: 'ADD_MEMBER',
    payload: expect.objectContaining({ relatedId: 'single', relType: 'spouse', linkExistingChildren: true }),
  }));
});

it('rejects names that contain numbers', () => {
  openAddForm(t.relTileChild, /one Family/);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  fireEvent.change(screen.getByPlaceholderText(t.placeholderFirstName), { target: { value: 'New2' } });
  fireEvent.change(screen.getByPlaceholderText(t.placeholderLastName), { target: { value: 'Family' } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.btnNext) }));
  expect(screen.getByText(t.nameHasDigits)).toBeTruthy();
  expect(screen.getByRole('heading', { name: t.wizardQWho })).toBeTruthy();
});

it('rejects Marathi names with Devanagari digits and opens the Marathi editor', () => {
  context.currentTree = {
    ...context.currentTree!, members: context.currentTree!.members.map(member =>
      member.id === 'one' ? { ...member, firstName_mr: 'राम२' } : member),
  };
  context.state.memberFormMode = 'edit';
  context.state.memberFormTargetId = 'one';
  render(<MemberFormModal />);
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  expect(screen.getByText(t.nameHasDigits)).toBeTruthy();
  expect((screen.getByLabelText(t.labelFirstNameMr) as HTMLInputElement).value).toBe('राम२');
  expect(context.dispatch).not.toHaveBeenCalled();
});

it('rejects a birth year in the future', () => {
  openAddForm(t.relTileChild, /one Family/);
  fillNamesAndContinue();
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: String(new Date().getFullYear() + 1) } });
  fireEvent.click(screen.getByRole('button', { name: t.btnAddNamed('New') }));
  expect(screen.getByText(t.futureDate)).toBeTruthy();
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
  context.isAdmin = true;
  context.canDelete = false;
  context.state.memberFormMode = 'edit';
  context.state.memberFormTargetId = 'one';
  const view = render(<MemberFormModal />);
  expect(screen.queryByRole('button', { name: t.btnDeleteMember })).toBeNull();
  context.canDelete = true;
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
