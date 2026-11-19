import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFamilyTree, NO_FILTERS } from '../../context/FamilyTreeContext';
import { processAllFamilyData } from '../../processing/dataProcessor';
import { DEFAULT_DISPLAY_SETTINGS } from '../../processing/displaySettings';
import { translations } from '../../i18n/translations';
import TreeView from './TreeView';

jest.mock('../../context/FamilyTreeContext', () => ({
  ...jest.requireActual('../../context/FamilyTreeContext'),
  useFamilyTree: jest.fn(),
}));
jest.mock('./TreeBranch', () => ({ TreeBranch: () => null }));
jest.mock('./ConnectorFlow', () => () => null);

const data = processAllFamilyData({ familyTrees: [{
  familyTreeId: 'test',
  familyTreeDisplayName: 'Test',
  members: [{ id: 'one', firstName: 'One', lastName: 'Family', gender: 'male', birthYear: 1970, deathYear: null }],
  relationships: { spouses: [], parentChild: [] },
}] });

beforeEach(() => {
  const tree = data.familyTreesStyled[0];
  (useFamilyTree as jest.Mock).mockReturnValue({
    currentTree: tree,
    state: { relMode: false, selectedMemberId: null, advancedFilters: NO_FILTERS },
    dispatch: jest.fn(),
    matchedMemberIds: new Set(),
    filteredMembers: tree.members,
    advancedMatchedIds: new Set(),
    relResult: null,
    debouncedSearchQuery: '',
    canEdit: false,
    isSaving: false,
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
  });
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: jest.fn(() => 1) });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: jest.fn() });
});

it('pans the focused tree with arrow keys and larger Shift steps', () => {
  const view = render(<TreeView />);
  const viewport = screen.getByRole('region', {
    name: `${translations.en.ariaFamilyTree}. ${translations.en.ariaTreePanInstructions}`,
  });
  const chart = view.container.querySelector('.tree-chart') as HTMLElement;

  fireEvent.keyDown(viewport, { key: 'ArrowRight' });
  expect(chart.style.transform).toContain('translate(-40px, 0px)');
  fireEvent.keyDown(viewport, { key: 'ArrowDown', shiftKey: true });
  expect(chart.style.transform).toContain('translate(-40px, -120px)');
});
