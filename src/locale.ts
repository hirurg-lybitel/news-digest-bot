export type Locale = "ru" | "en";

export const LOCALES: Locale[] = ["ru", "en"];

export type LocaleLabels = {
  brand: string;
  readMore: string;
  openInApp: string;
};

export const LOCALE_LABELS: Record<Locale, LocaleLabels> = {
  ru: {
    brand: "Суть дня",
    readMore: "Читать полностью",
    openInApp: "Открыть в приложении",
  },
  en: {
    brand: "Day Essence",
    readMore: "Read full story",
    openInApp: "Open in app",
  },
};
