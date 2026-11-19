import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenChild(): React.ReactElement {
  throw new Error('render failure');
}

it('shows localized error-boundary copy instead of claiming data is stored locally', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(
      <ErrorBoundary
        title="Localized title"
        description="Localized description"
        reload="Localized reload"
      >
        <BrokenChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Localized title')).toBeTruthy();
    expect(screen.getByText('Localized description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Localized reload' })).toBeTruthy();
    expect(screen.queryByText(/safe in local storage/i)).toBeNull();
  } finally {
    error.mockRestore();
  }
});
