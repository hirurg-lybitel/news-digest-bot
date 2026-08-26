export type NewsSource = {
  id: string;
  name: string;
  url: string;
};

/** Публичные RSS-ленты крупных агентств (без скрейпинга HTML). */
export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "bbc",
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "reuters",
    name: "Reuters",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
  },
  {
    id: "cnn",
    name: "CNN",
    url: "http://rss.cnn.com/rss/edition.rss",
  },
  {
    id: "nyt",
    name: "New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  },
  {
    id: "guardian",
    name: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
  },
  {
    id: "dw",
    name: "Deutsche Welle",
    url: "https://rss.dw.com/rdf/rss-en-all",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
];
