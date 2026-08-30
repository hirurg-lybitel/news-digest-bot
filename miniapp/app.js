const LABELS = {
  ru: {
    brand: "Суть дня",
    category: "Раздел",
    source: "Источник",
    all: "Все",
    readMore: "Читать полностью",
    empty: "Нет новостей по выбранным фильтрам",
    loadError: "Не удалось загрузить дайджест",
    back: "← К ленте",
    openSource: "Источник →",
    dateFmt: "ru-RU",
  },
  en: {
    brand: "Day Essence",
    category: "Category",
    source: "Source",
    all: "All",
    readMore: "Read full story",
    empty: "No stories match the filters",
    loadError: "Failed to load digest",
    back: "← Back to feed",
    openSource: "Source →",
    dateFmt: "en-GB",
  },
};

/** @typedef {"ru"|"en"} Locale */

/** @type {Locale} */
let locale = "ru";
/** @type {string|null} */
let categoryFilter = null;
/** @type {string|null} */
let sourceFilter = null;
/** @type {number|null} */
let detailIndex = null;
/** @type {import('./data-types.js').DigestPayload|null} */
let digest = null;

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.themeParams?.bg_color) {
    document.documentElement.style.setProperty("--bg", tg.themeParams.bg_color);
  }
}

/**
 * Parse `ru`, `en`, `ru_i5`, or `en_i9` from start_param / URL.
 * @returns {{ locale: Locale, storyIndex: number|null }}
 */
function parseStartParam(raw) {
  if (!raw) return { locale: null, storyIndex: null };
  const match = String(raw).match(/^(ru|en)(?:_i(\d+))?$/i);
  if (!match) return { locale: null, storyIndex: null };
  const loc = /** @type {Locale} */ (match[1].toLowerCase());
  const storyIndex = match[2] != null ? Number(match[2]) : null;
  return {
    locale: loc,
    storyIndex: Number.isInteger(storyIndex) ? storyIndex : null,
  };
}

function detectLocaleAndStory() {
  const params = new URLSearchParams(window.location.search);
  const fromStory = params.get("story");
  const fromUrlLang = params.get("lang");
  const fromStart = parseStartParam(tg?.initDataUnsafe?.start_param);
  const fromQueryStart = parseStartParam(params.get("startapp"));

  /** @type {Locale} */
  let nextLocale = "en";
  if (fromUrlLang === "ru" || fromUrlLang === "en") nextLocale = fromUrlLang;
  else if (fromStart.locale) nextLocale = fromStart.locale;
  else if (fromQueryStart.locale) nextLocale = fromQueryStart.locale;
  else if (tg?.initDataUnsafe?.user?.language_code?.startsWith("ru")) nextLocale = "ru";

  let storyIndex = null;
  if (fromStory != null && /^\d+$/.test(fromStory)) storyIndex = Number(fromStory);
  else if (fromStart.storyIndex != null) storyIndex = fromStart.storyIndex;
  else if (fromQueryStart.storyIndex != null) storyIndex = fromQueryStart.storyIndex;

  return { locale: nextLocale, storyIndex };
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(LABELS[locale].dateFmt, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, locale));
}

function renderLangSwitch() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === locale);
    btn.onclick = () => {
      locale = /** @type {Locale} */ (btn.dataset.lang);
      categoryFilter = null;
      sourceFilter = null;
      render();
    };
  });
}

function renderChips(containerId, values, active, onSelect) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = `chip${active === null ? " active" : ""}`;
  allChip.textContent = LABELS[locale].all;
  allChip.onclick = () => onSelect(null);
  container.appendChild(allChip);

  for (const value of values) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${active === value ? " active" : ""}`;
    chip.textContent = value;
    chip.onclick = () => onSelect(value);
    container.appendChild(chip);
  }
}

function filteredStories() {
  if (!digest) return [];
  return digest.stories.filter((story) => {
    const cat = story.category[locale];
    const src = story.source;
    if (categoryFilter && cat !== categoryFilter) return false;
    if (sourceFilter && src !== sourceFilter) return false;
    return true;
  });
}

function showFeed() {
  detailIndex = null;
  document.getElementById("feed").classList.remove("hidden");
  document.getElementById("detail").classList.add("hidden");
  document.getElementById("intro").classList.remove("hidden");
}

function showDetail(index) {
  if (!digest || index < 0 || index >= digest.stories.length) {
    showFeed();
    return;
  }
  detailIndex = index;
  const story = digest.stories[index];
  const labels = LABELS[locale];
  const bodyText = story.longBody?.[locale] || story.summary[locale];

  document.getElementById("feed").classList.add("hidden");
  document.getElementById("detail").classList.remove("hidden");
  document.getElementById("intro").classList.add("hidden");

  document.getElementById("detail-back").textContent = labels.back;
  document.getElementById("detail-category").textContent = story.category[locale];
  document.getElementById("detail-source").textContent = story.source;
  document.getElementById("detail-title").textContent = `${index + 1}. ${story.title[locale]}`;

  const bodyEl = document.getElementById("detail-body");
  bodyEl.innerHTML = "";
  for (const para of String(bodyText).split(/\n\n+/).map((p) => p.trim()).filter(Boolean)) {
    const p = document.createElement("p");
    p.textContent = para;
    bodyEl.appendChild(p);
  }

  const link = document.getElementById("detail-link");
  link.href = story.link;
  link.textContent = labels.openSource;
}

function renderStories() {
  const list = document.getElementById("stories");
  const empty = document.getElementById("empty");
  const stories = filteredStories();

  list.innerHTML = "";
  empty.classList.toggle("hidden", stories.length > 0);

  for (const story of stories) {
    const absoluteIndex = digest.stories.indexOf(story);
    const card = document.createElement("article");
    card.className = "card";
    const hasLong = Boolean(story.longBody?.[locale]);
    card.innerHTML = `
      <div class="card-meta">
        <span class="badge">${escapeHtml(story.category[locale])}</span>
        <span class="source">${escapeHtml(story.source)}</span>
      </div>
      <h3 class="card-title">${absoluteIndex + 1}. ${escapeHtml(story.title[locale])}</h3>
      <p class="card-summary">${escapeHtml(story.summary[locale])}</p>
      <a class="card-link" href="${escapeAttr(story.link)}" target="_blank" rel="noopener noreferrer">${LABELS[locale].readMore} →</a>
    `;
    if (hasLong) {
      const link = card.querySelector(".card-link");
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.setAttribute("role", "button");
      link.href = "#";
      link.onclick = (event) => {
        event.preventDefault();
        showDetail(absoluteIndex);
      };
    }
    list.appendChild(card);
  }
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(text) {
  return escapeHtml(text).replaceAll("'", "&#39;");
}

function render() {
  if (!digest) return;

  const labels = LABELS[locale];
  document.getElementById("brand").textContent = labels.brand;
  document.getElementById("date").textContent = formatDate(digest.date);
  document.getElementById("intro").textContent = digest.intro[locale];
  document.getElementById("filter-category-label").textContent = labels.category;
  document.getElementById("filter-source-label").textContent = labels.source;
  document.getElementById("empty").textContent = labels.empty;

  renderLangSwitch();

  const categories = uniqueSorted(digest.stories.map((s) => s.category[locale]));
  const sources = uniqueSorted(digest.stories.map((s) => s.source));

  renderChips("category-filters", categories, categoryFilter, (value) => {
    categoryFilter = value;
    render();
  });

  renderChips("source-filters", sources, sourceFilter, (value) => {
    sourceFilter = value;
    render();
  });

  if (detailIndex != null) {
    showDetail(detailIndex);
    return;
  }

  showFeed();
  renderStories();
}

async function loadDigest() {
  const errorEl = document.getElementById("error");
  try {
    const response = await fetch(`data/digest.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error(String(response.status));
    digest = await response.json();
    errorEl.classList.add("hidden");
    render();
  } catch {
    errorEl.textContent = LABELS[locale].loadError;
    errorEl.classList.remove("hidden");
  }
}

document.getElementById("detail-back").onclick = () => {
  showFeed();
  renderStories();
};

const boot = detectLocaleAndStory();
locale = boot.locale;
detailIndex = boot.storyIndex;
loadDigest();
