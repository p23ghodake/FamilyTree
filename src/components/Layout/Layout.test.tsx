import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Layout from './Layout';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { processAllFamilyData } from '../../processing/dataProcessor';
import { translations } from '../../i18n/translations';

jest.mock('../../context/FamilyTreeContext', () => ({ useFamilyTree: jest.fn() }));
jest.mock('./TopBar', () => () => null);
jest.mock('../TreeView/TreeView', () => () => null);
jest.mock('../SearchBar/FloatingSearch', () => () => null);
jest.mock('../TreeView/MemberFormModal', () => () => null);
jest.mock('../TreeView/RelationshipPanel', () => () => null);
jest.mock('../Tour/TourOverlay', () => () => null);

it('renders selected member details for visitors without edit controls', () => {
  const data = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'test', familyTreeDisplayName: 'Test',
    members: [{ id: 'one', firstName: 'Ravi', lastName: 'Patil', gender: 'male', birthYear: 1950, deathYear: null }],
    relationships: { spouses: [], parentChild: [] },
  }] });
  const dispatch = jest.fn();
  (useFamilyTree as jest.Mock).mockReturnValue({
    state: { data, selectedMemberId: 'one', relMode: false, memberFormMode: null, avatarStyle: 'initials' },
    currentTree: data.familyTreesStyled[0], limitedView: true, canEdit: false, dispatch,
  });
  render(<Layout />);
  expect(screen.getByRole('complementary', { name: translations.en.detailsPanelLabel('Ravi Patil') })).toBeTruthy();
  expect(screen.queryByRole('button', { name: translations.en.menuEdit })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: translations.en.close }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_MEMBER', payload: null });
});

it('offers a retry when the initial family-data load fails', () => {
  const retryLoad = jest.fn();
  (useFamilyTree as jest.Mock).mockReturnValue({
    state: { data: null, error: 'Network down' },
    currentTree: null,
    retryLoad,
    isSaving: false,
  });
  render(<Layout />);
  fireEvent.click(screen.getByRole('button', { name: translations.en.retryLoad }));
  expect(retryLoad).toHaveBeenCalledTimes(1);
});

it('keeps the load-error view usable when browser storage is blocked', () => {
  const retryLoad = jest.fn();
  const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage disabled');
  });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (useFamilyTree as jest.Mock).mockReturnValue({
    state: { data: null, error: 'Network down' },
    currentTree: null,
    retryLoad,
    isSaving: false,
  });
  try {
    render(<Layout />);
    expect(screen.getByRole('button', { name: translations.en.retryLoad })).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  } finally {
    getItem.mockRestore();
    warn.mockRestore();
  }
});
