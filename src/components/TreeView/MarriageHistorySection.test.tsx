import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { processAllFamilyData } from '../../processing/dataProcessor';
import { MarriageHistorySection } from './MarriageHistorySection';

jest.mock('../../context/FamilyTreeContext', () => ({ useFamilyTree: jest.fn() }));

const tree = processAllFamilyData({ familyTrees: [{
  familyTreeId: 'test',
  familyTreeDisplayName: 'Test',
  members: [
    { id: 'one', firstName: 'One', lastName: 'Family', gender: 'male', birthYear: 1970, deathYear: null },
    { id: 'two', firstName: 'Two', lastName: 'Family', gender: 'female', birthYear: 1972, deathYear: null },
  ],
  relationships: {
    spouses: [{ spouse1Id: 'one', spouse2Id: 'two' }],
    parentChild: [],
  },
}] }).familyTreesStyled[0];

const dispatch = jest.fn();
let isSaving = false;

beforeEach(() => {
  jest.clearAllMocks();
  isSaving = false;
  (useFamilyTree as jest.Mock).mockReturnValue({ dispatch, isSaving });
});

it('keeps a marriage-date draft until the save is reflected in the tree', () => {
  render(<MarriageHistorySection editMemberId="one" currentTree={tree} />);
  const date = screen.getByLabelText('Marriage date') as HTMLInputElement;
  fireEvent.change(date, { target: { value: '2000-01-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect(date.value).toBe('2000-01-02');
  expect(dispatch).toHaveBeenCalledWith({
    type: 'UPDATE_MARRIAGE_DATE',
    payload: {
      treeId: 'test',
      spouse1Id: 'one',
      spouse2Id: 'two',
      marriageDate: '2000-01-02',
    },
  });
});

it('disables marriage mutations while a save is in progress', () => {
  isSaving = true;
  (useFamilyTree as jest.Mock).mockReturnValue({ dispatch, isSaving });
  render(<MarriageHistorySection editMemberId="one" currentTree={tree} />);

  expect((screen.getByLabelText('Marriage date') as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'End marriage' }) as HTMLButtonElement).disabled).toBe(true);
});
