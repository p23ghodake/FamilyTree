import React, { createContext, useContext, useState } from 'react';
import { translations } from '../i18n/translations';

type Lang = 'en' | 'mr';

interface LanguageContextValue {
  lang: Lang;
  t: typeof translations['en'];
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: translations.en,
  toggleLang: () => {},
});

const LANG_STORAGE_KEY = 'app-lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'mr';
    } catch (error) {
      console.warn('Unable to read the saved language:', error);
      return 'mr';
    }
  });

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'mr' : 'en';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch (error) {
      console.warn('Unable to persist the selected language:', error);
    }
    setLang(next);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
