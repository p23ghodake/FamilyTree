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
