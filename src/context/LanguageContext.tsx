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
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return (saved === 'mr' ? 'mr' : 'en') as Lang;
  });

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'mr' : 'en';
    // Write to storage first so it's always consistent even if component unmounts
    localStorage.setItem(LANG_STORAGE_KEY, next);
    setLang(next);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
