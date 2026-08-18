// Configurazione i18next. Fase 1: solo il flusso auth (Login, Onboarding,
// Account) è tradotto — il resto dell'app resta italiano hardcoded finché
// non viene convertito nelle fasi successive (vedi CLAUDE.md, Roadmap).
//
// Lingua scelta: localStorage (chiave ct_locale, stesso prefisso ct_ usato
// altrove nell'app) ha priorità, poi la lingua del browser, poi italiano
// come ultima spiaggia — coerente con un'app nata e finora usata solo in IT.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import it from '../locales/it.json';
import en from '../locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { it: { translation: it }, en: { translation: en } },
    fallbackLng: 'it',
    supportedLngs: ['it', 'en'],
    nonExplicitSupportedLngs: true, // "en-US" del browser conta come "en"
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ct_locale',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React già fa l'escaping
  });

export default i18n;
