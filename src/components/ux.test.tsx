import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useFamilyTree, NO_FILTERS } from '../context/FamilyTreeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { useAuth } from '../lib/AuthContext';
import { translations } from '../i18n/translations';
import { processAllFamilyData } from '../processing/dataProcessor';
import MemberDetailsPanel from './TreeView/MemberDetailsPanel';
import FloatingSearch from './SearchBar/FloatingSearch';
import ShareModal from './Layout/ShareModal';
import TopBar from './Layout/TopBar';
import MemberFormModal from './TreeView/MemberFormModal';
import { PhotoUploadSection } from './TreeView/PhotoUploadSection';
import TourOverlay from './Tour/TourOverlay';
import RelationshipPanel from './TreeView/RelationshipPanel';
import { computeRelationship } from '../processing/relationshipFinder';

jest.mock('../context/FamilyTreeContext', () => ({
  ...jest.requireActual('../context/FamilyTreeContext'), useFamilyTree: jest.fn(),
}));
jest.mock('../lib/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../processing/transliteration', () => ({ transliterateToMarathi: jest.fn().mockResolvedValue('') }));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

const en = translations.en;
const mr = translations.mr;
const data = processAllFamilyData({ familyTrees: [{
  familyTreeId: 'test', familyTreeDisplayName: 'Test Family',
  members: [
    { id: 'parent', firstName: 'Ravi', lastName: 'Patil', firstName_mr: 'रवी', lastName_mr: 'पाटील', gender: 'male', birthYear: 1950, deathYear: null, birthDate: '1950-03-07', occupation: 'Farmer', location: 'Pune', notes: 'Family historian' },
    { id: 'spouse', firstName: 'Sita', lastName: 'Patil', gender: 'female', birthYear: 1955, deathYear: null },
    { id: 'child', firstName: 'Anil', lastName: 'Patil', gender: 'male', birthYear: 1980, deathYear: null },
  ],
  relationships: {
    spouses: [{ spouse1Id: 'parent', spouse2Id: 'spouse' }],
    parentChild: [{ parentId: 'parent', childId: 'child' }],
  },
}] });

let context: ReturnType<typeof useFamilyTree>;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  context = {
    state: {
      data, past: [], future: [], selectedTreeId: 'test', selectedMemberId: null,
      searchQuery: '', error: null, memberFormMode: null, memberFormTargetId: null,
      advancedFilters: NO_FILTERS, relMode: false, relSource: null, relTarget: null,
      theme: 'light', avatarStyle: 'initials',
    },
    currentTree: data.familyTreesStyled[0],
    canEdit: true, cloudReady: true, cloudError: null, isSaving: false,
    canUndo: false, canRedo: false,
    filteredMembers: data.familyTreesStyled[0].members,
    matchedMemberIds: new Set(), advancedMatchedIds: new Set(), relResult: null,
    debouncedSearchQuery: '', dispatch: jest.fn(), exportData: jest.fn(), importData: jest.fn(),
    loadSharedData: jest.fn(), resetData: jest.fn(), undo: jest.fn(), redo: jest.fn(),
    styleNewMember: jest.fn(),
  };
  (useFamilyTree as jest.Mock).mockImplementation(() => context);
  (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: false, signOut: jest.fn(), signInWithPassword: jest.fn(), signInWithGitHub: jest.fn() });
});

describe('person details panel', () => {
  it('shows read-only details and relatives for the selected person', () => {
    context.state.selectedMemberId = 'parent';
    render(<MemberDetailsPanel />);
    const panel = screen.getByRole('complementary', { name: en.detailsPanelLabel('Ravi Patil') });
    expect(panel.textContent).toContain('b. 7 March 1950');
    expect(panel.textContent).toContain('Farmer · Pune');
    expect(within(panel).getByText('रवी पाटील')).toBeTruthy();
    expect(within(panel).getByText('Family historian')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: en.detailsMore })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Sita' })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Anil' }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SELECT_MEMBER', payload: 'child' });
    fireEvent.click(within(panel).getByRole('button', { name: en.menuEdit }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'edit', targetId: 'parent' } });
  });

  it('clamps long notes with a More/Less toggle', () => {
    const longNotes = 'Kept the original handwritten family records and the village land papers safe for many decades.';
    context.currentTree = {
      ...context.currentTree!,
      members: context.currentTree!.members.map(m => (m.id === 'parent' ? { ...m, notes: longNotes } : m)),
    };
    context.state.selectedMemberId = 'parent';
    render(<MemberDetailsPanel />);
    const notes = screen.getByText(longNotes);
    expect(notes.className).toContain('member-details__notes--clamped');
    fireEvent.click(screen.getByRole('button', { name: en.detailsMore }));
    expect(notes.className).not.toContain('member-details__notes--clamped');
    expect(screen.getByRole('button', { name: en.detailsLess }).getAttribute('aria-expanded')).toBe('true');
  });

  it('hides editing for viewers and closes with Escape', () => {
    context.state.selectedMemberId = 'child';
    context.canEdit = false;
    render(<MemberDetailsPanel />);
    expect(screen.queryByRole('button', { name: en.menuEdit })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SELECT_MEMBER', payload: null });
  });

  it('stays hidden while tracing relationships', () => {
    context.state.selectedMemberId = 'parent';
    context.state.relMode = true;
    const view = render(<MemberDetailsPanel />);
    expect(view.container.innerHTML).toBe('');
  });
});

describe('search panel', () => {
  const results = () => screen.queryAllByRole('button', { name: /Ravi|Sita|Anil/ });
  const openSearch = () => {
    fireEvent.click(screen.getByRole('button', { name: en.searchExpandTooltip }));
    return screen.getByRole('textbox', { name: en.searchPlaceholder });
  };

  it('starts as a single search button and opens with a click or "/"', () => {
    render(<FloatingSearch />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.keyDown(document.body, { key: '/' });
    const input = screen.getByRole('textbox', { name: en.searchPlaceholder });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: en.searchExpandTooltip }));
  });

  it('shows a dot on the closed button when filters are active', () => {
    context.state.advancedFilters = { ...NO_FILTERS, livingOnly: true };
    const view = render(<FloatingSearch />);
    expect(view.container.querySelector('.floating-search__open-dot')).not.toBeNull();
  });

  it('only selects (and moves the tree) on click or Enter, not hover or arrows', () => {
    render(<FloatingSearch />);
    const input = openSearch();
    fireEvent.mouseEnter(results()[1]);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(context.dispatch).not.toHaveBeenCalled();
    // Arrow keys continue from the hovered result and stop at the last one.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SELECT_MEMBER', payload: 'child' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('opens automatically for the relationship tracer and feeds picks into it', () => {
    context.state.relMode = true;
    render(<FloatingSearch />);
    expect(screen.getByRole('status').textContent).toBe(en.tracerStep1);
    act(() => screen.getByRole('textbox', { name: en.searchPlaceholder }).focus());
    fireEvent.mouseDown(results()[2]);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_REL_NODE', payload: 'child' });
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('closes only the result list on the first Escape', () => {
    render(<FloatingSearch />);
    const input = openSearch();
    expect(results()).toHaveLength(3);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => { input.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(results()).toHaveLength(0);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('clears the query first, then closes', () => {
    context.state.searchQuery = 'Ravi';
    render(<FloatingSearch />);
    openSearch();
    fireEvent.click(screen.getByRole('button', { name: en.searchClear }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_SEARCH', payload: '' });
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('toggles filter chips and clears them', () => {
    context.state.advancedFilters = { ...NO_FILTERS, livingOnly: true };
    render(<FloatingSearch />);
    openSearch();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.searchFiltersActive.slice(0, 10)) }));
    const group = screen.getByRole('group', { name: en.filtersTitle });
    expect(within(group).getByRole('button', { name: en.filterLivingOnly }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: en.filterHideFemale }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_ADVANCED_FILTER', payload: { hideFemale: true } });
    expect(group.textContent).toContain(en.filtersOnCount(1));
    fireEvent.click(within(group).getByRole('button', { name: en.filterClear }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_ADVANCED_FILTERS' });
    fireEvent.change(within(group).getByRole('combobox', { name: en.labelLocation }), { target: { value: 'Pune' } });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_ADVANCED_FILTER', payload: { location: 'Pune' } });
  });
});

describe('dialog keyboard behaviour', () => {
  function ShareHarness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open share</button>{open && <ShareModal onClose={() => setOpen(false)} />}</>;
  }

  it('moves focus in, traps Tab, closes on Escape, and restores focus', () => {
    render(<ShareHarness />);
    const opener = screen.getByRole('button', { name: 'Open share' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: en.shareTitle });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = within(dialog).getAllByRole('button');
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to the Timeline button when the timeline closes', () => {
    render(<TopBar />);
    const timelineButton = screen.getByRole('button', { name: en.menuTimeline });
    timelineButton.focus();
    fireEvent.click(timelineButton);
    const dialog = screen.getByRole('dialog', { name: en.tooltipTimeline });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(timelineButton);
  });

  it('starts the member form on the relationship step and lets Escape close the year picker first', () => {
    context.state.memberFormMode = 'add';
    render(<MemberFormModal />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: en.relTileNone }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.btnNext) }));
    expect(document.activeElement).toBe(document.getElementById('member-form-first-name'));
    fireEvent.change(document.activeElement!, { target: { value: 'New' } });
    fireEvent.change(screen.getByPlaceholderText(en.placeholderLastName), { target: { value: 'Patil' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.btnNext) }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: new RegExp(en.wizardQDetails) }));
    expect(screen.getByLabelText(en.labelOccupation)).toBeTruthy();
    const year = screen.getByLabelText(en.labelBirthYear);
    act(() => year.focus());
    expect(screen.getByRole('button', { name: en.yearPrevDecade })).toBeTruthy();
    fireEvent.keyDown(year, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: en.yearPrevDecade })).toBeNull();
    expect(context.dispatch).not.toHaveBeenCalled();
    fireEvent.keyDown(year, { key: 'Escape' });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'CLOSE_MEMBER_FORM' });
  });

  it('filters relationship targets by name, including Marathi names', () => {
    context.state.memberFormMode = 'add';
    render(<MemberFormModal />);
    fireEvent.click(screen.getByRole('button', { name: en.relTileParent }));
    const people = screen.getByRole('group', { name: en.relParentOf });
    expect(within(people).getAllByRole('button')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText(`${en.relParentOf}…`), { target: { value: 'रवी' } });
    expect(within(people).getAllByRole('button').map(b => b.textContent)).toEqual([expect.stringContaining('Ravi Patil')]);
    fireEvent.click(within(people).getByRole('button', { name: /Ravi Patil/ }));
    expect(within(people).getByRole('button', { name: /Ravi Patil/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('header', () => {
  it('offers the tour from a header button instead of the settings menu', () => {
    const onStartTour = jest.fn();
    render(<TopBar onStartTour={onStartTour} />);
    screen.getAllByRole('button', { name: en.settingsTour }).forEach(button => fireEvent.click(button));
    expect(onStartTour).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: en.settingsTitle }));
    expect(within(screen.getByRole('dialog', { name: en.settingsTitle })).queryByText(en.settingsTour)).toBeNull();
  });

  it('shows editing tools only to editors', () => {
    const view = render(<TopBar />);
    expect(screen.getByRole('button', { name: en.headerAddMember })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: en.tooltipUndoDisabled }).length).toBeGreaterThan(0);
    context.canEdit = false;
    view.rerender(<TopBar />);
    expect(screen.queryByRole('button', { name: en.headerAddMember })).toBeNull();
    expect(screen.queryByRole('button', { name: en.tooltipUndoDisabled })).toBeNull();
  });

  it('switches between Tree and Trace views', () => {
    const view = render(<TopBar />);
    const views = () => within(screen.getByRole('navigation', { name: en.headerViews }));
    expect(views().getByRole('button', { name: en.viewTree }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(views().getByRole('button', { name: en.viewTrace }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_REL_MODE' });
    context.state.relMode = true;
    view.rerender(<TopBar />);
    expect(views().getByRole('button', { name: en.viewTrace }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(views().getByRole('button', { name: en.viewTree }));
    expect(context.dispatch).toHaveBeenCalledTimes(2);
  });

  it('groups display settings in one menu and hides admin tools from viewers', () => {
    localStorage.setItem('app-lang', 'en');
    render(<LanguageProvider><TopBar /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: en.settingsTitle }));
    const menu = screen.getByRole('dialog', { name: en.settingsTitle });
    expect(within(menu).queryByText(en.settingsAdmin)).toBeNull();
    fireEvent.click(within(menu).getByRole('button', { name: en.themeDark }));
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_THEME', payload: 'dark' });
    fireEvent.change(within(menu).getByRole('combobox'), { target: { value: 'emoji' } });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'SET_AVATAR_STYLE', payload: 'emoji' });
    fireEvent.click(within(menu).getByRole('button', { name: en.langLabelMr }));
    expect(screen.getByRole('dialog', { name: mr.settingsTitle })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the phone menu as a modal sheet and returns focus on Escape', () => {
    render(<TopBar />);
    const trigger = screen.getByRole('button', { name: en.headerMenu });
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: en.headerMenu });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(within(sheet).getByRole('button', { name: en.menuTimeline })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: en.headerUndo })).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Marathi interface', () => {
  it('is the default and translates sign-in and the login dialog', () => {
    render(<LanguageProvider><TopBar /></LanguageProvider>);
    expect(screen.queryByText('Sign in')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: mr.authSignIn }));
    const dialog = screen.getByRole('dialog', { name: mr.loginTitle });
    expect(within(dialog).getByText(mr.loginGitHub)).toBeTruthy();
    expect(within(dialog).getByText(mr.loginBrowseNote)).toBeTruthy();
    expect(within(dialog).queryByText(/Sign in to edit|Continue with|browse without/)).toBeNull();
  });
});

describe('sign-in dialog', () => {
  it('starts with the two methods and opens the email form on request', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: en.authSignIn }));
    const dialog = screen.getByRole('dialog', { name: en.loginTitle });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: new RegExp(en.loginGitHub) }));
    expect(within(dialog).queryByLabelText(en.loginPassword)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(en.loginEmailOption) }));
    expect(screen.getByRole('dialog', { name: en.loginEmailTitle })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(en.loginEmail));
    fireEvent.click(screen.getByRole('button', { name: en.btnBack }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: new RegExp(en.loginEmailOption) }));
  });

  it('shows a translated inline error for wrong credentials and keeps the dialog open', async () => {
    const signInWithPassword = jest.fn().mockRejectedValue(new Error('Invalid login credentials'));
    (useAuth as jest.Mock).mockReturnValue({ session: null, loading: false, isAdmin: false, signInWithPassword, signInWithGitHub: jest.fn() });
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: en.authSignIn }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.loginEmailOption) }));
    fireEvent.change(screen.getByLabelText(en.loginEmail), { target: { value: ' ravi@example.com ' } });
    fireEvent.change(screen.getByLabelText(en.loginPassword), { target: { value: 'wrong' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en.authSignIn }));
    expect((await screen.findByRole('alert')).textContent).toBe(en.loginInvalid);
    expect(signInWithPassword).toHaveBeenCalledWith('ravi@example.com', 'wrong');
    expect(screen.getByLabelText(en.loginPassword).getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText(en.loginPassword), { target: { value: 'right' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('relationship tracer', () => {
  it('states the result as a sentence', () => {
    const tree = context.currentTree!;
    context.state = { ...context.state, relMode: true, relSource: 'parent', relTarget: 'child' };
    context.relResult = computeRelationship('parent', 'child', tree.members, tree.relationships);
    render(<RelationshipPanel />);
    expect(screen.getByText('Father')).toBeTruthy();
    expect(screen.getByText("Ravi is Anil's father.")).toBeTruthy();
    expect(screen.getByText(en.tracerHops(1))).toBeTruthy();
  });
});

describe('feature tour', () => {
  it('shows a demo clip only on steps that have one', () => {
    render(<TourOverlay active onClose={jest.fn()} />);
    const tour = screen.getByRole('dialog', { name: en.tourTitle });
    expect(tour.querySelector('.tour-tooltip__media img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.tourNext }));
    fireEvent.click(screen.getByRole('button', { name: en.tourNext }));
    expect(screen.getByText(en.tourStepTitles[2])).toBeTruthy();
    expect(tour.querySelector('.tour-tooltip__media img')?.getAttribute('src')).toBe('/tour/details.gif');
  });
});

describe('photo upload', () => {
  it('rejects files that are not images', async () => {
    const onImageChange = jest.fn();
    render(<PhotoUploadSection imageUrl="" gender="male" birthYear="" onImageChange={onImageChange} />);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.photoNotImage));
    expect(onImageChange).not.toHaveBeenCalled();
  });
});
