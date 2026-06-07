// =============================================================================
// MotoGuard IoT — I18n Context
// =============================================================================
// Contexto React para internacionalização (i18n)
// Suporta PT, EN, ES com fallback automático
// =============================================================================

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loadSettings, saveSettings, type Language } from '../utils/settings';
import { translationsWithEs, type TranslationKey } from './translations';

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, fallback?: string) => string;
  // Force re-render counter to ensure all components update
  _renderKey: number;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const settings = loadSettings();
    return settings.language;
  });
  
  // Counter to force re-render of all components when language changes
  const [renderKey, setRenderKey] = useState(0);

  const setLanguage = (lang: Language) => {
    if (lang === language) return;
    setLanguageState(lang);
    const settings = loadSettings();
    saveSettings({ ...settings, language: lang });
    // Force all components to re-render
    setRenderKey(prev => prev + 1);
  };

  const t = (key: TranslationKey, fallback?: string): string => {
    // Try current language
    const translation = translationsWithEs[language]?.[key];
    if (translation) return translation;

    // Fallback to Portuguese
    if (language !== 'pt') {
      const ptTranslation = translationsWithEs.pt[key];
      if (ptTranslation) return ptTranslation;
    }

    // Fallback to English
    if (language !== 'en') {
      const enTranslation = translationsWithEs.en[key];
      if (enTranslation) return enTranslation;
    }

    // Return fallback or key
    return fallback ?? key;
  };

  // Update document language attribute
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, _renderKey: renderKey }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
