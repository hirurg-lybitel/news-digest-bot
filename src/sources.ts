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
    id: "ap",
    name: "AP News",
    url: "https://feeds.apnews.com/apnews/topnews",
  },
  {
    id: "cnn",
    name: "CNN",
    url: "http://rss.cnn.com/rss/edition.rss",
  },
  {
    id: "npr",
    name: "NPR",
    url: "https://feeds.npr.org/1004/rss.xml",
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
    id: "euronews",
    name: "Euronews",
    url: "https://www.euronews.com/rss?format=mrss&level=theme&name=news",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    id: "bbc-science",
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
  {
    id: "bbc-tech",
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  },
  {
    id: "bbc-business",
    name: "BBC",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
  },
  {
    id: "nyt-science",
    name: "New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
  },
  {
    id: "nyt-tech",
    name: "New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
  },
  {
    id: "nyt-business",
    name: "New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
  },
  {
    id: "the-block",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
  },
  {
    id: "guardian-crypto",
    name: "The Guardian",
    url: "https://www.theguardian.com/technology/cryptocurrencies/rss",
  },
];
