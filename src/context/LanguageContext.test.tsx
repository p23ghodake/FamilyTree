import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { translations } from '../i18n/translations';

function LanguageProbe() {
  const { lang, toggleLang } = useLanguage();
  return <button type="button" onClick={toggleLang}>{lang}</button>;
}

it('continues to work when localStorage is unavailable', () => {
  const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage disabled');
  });
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage disabled');
  });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    expect(screen.getByRole('button').textContent).toBe('mr');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('en');
    expect(translations.mr.errorLoadTree).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  } finally {
    getItem.mockRestore();
    setItem.mockRestore();
    warn.mockRestore();
  }
});
