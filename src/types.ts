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
  intro: string;
  stories: DigestStory[];
};
