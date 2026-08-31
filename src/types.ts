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
  /** Extended briefing for Mini App detail / Telegraph. */
  longBody?: string;
  telegraphUrl?: string;
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
  /** Extended briefing for Mini App detail / Telegraph. */
  longBody?: Record<Locale, string>;
  telegraphUrl?: Record<Locale, string>;
};

export type BilingualDigest = {
  stories: BilingualStory[];
  intro: Record<Locale, string>;
};

export const CATEGORY_KEYS = [
  "conflict",
  "politics",
  "economy",
  "technology",
  "science",
  "health",
  "climate",
  "disaster",
  "law",
  "society",
  "culture",
  "sport",
  "world",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type EventCluster = {
  representativeIndex: number;
  memberIndices: number[];
  score: number;
  category: CategoryKey;
  rationale: string;
  repaired?: boolean;
};

export type RankedEvent = EventCluster & {
  rank: number;
  representative: NewsItem;
  members: NewsItem[];
};

export type ChannelTarget = {
  id: string;
  locale: Locale;
  chatId: string;
};
