import type { Locale } from "./locale.js";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  summary: string;
  publishedAt: Date | null;
};

export type DigestStory = {
  title: string;
  summary: string;
  link: string;
  source: string;
  category: string;
};

export type DigestResult = {
  locale: Locale;
  intro: string;
  stories: DigestStory[];
};

export type BilingualStory = {
  link: string;
  source: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  category: Record<Locale, string>;
};

export type BilingualDigest = {
  stories: BilingualStory[];
  intro: Record<Locale, string>;
};

export type ChannelTarget = {
  id: string;
  locale: Locale;
  chatId: string;
};
