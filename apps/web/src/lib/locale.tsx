import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "bn";
type LocaleContextValue = {
  locale: Locale;
  localeCode: "en-BD" | "bn-BD";
  setLocale: (locale: Locale) => void;
  text: (english: string, bangla: string) => string;
};

const storageKey = "edupath_locale";
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => localStorage.getItem(storageKey) === "bn" ? "bn" : "en");
  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(storageKey, next);
    setLocaleState(next);
  }, []);
  const text = useCallback((english: string, bangla: string) => locale === "bn" ? bangla : english, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === "bn" ? "EduPath BD - শিক্ষা ও ভর্তি সহায়তা" : "EduPath BD - Education and Admission Guidance";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, localeCode: locale === "bn" ? "bn-BD" : "en-BD", setLocale, text }), [locale, setLocale, text]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

