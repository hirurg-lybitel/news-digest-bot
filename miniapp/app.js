const LABELS = {
  ru: {
    brand: "Суть дня",
    category: "Раздел",
    source: "Источник",
    all: "Все",
    readMore: "Читать полностью",
    empty: "Нет новостей по выбранным фильтрам",
    loadError: "Не удалось загрузить дайджест",
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

function detectLocale() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl === "ru" || fromUrl === "en") return fromUrl;

  const start = tg?.initDataUnsafe?.start_param;
  if (start === "ru" || start === "en") return start;

  const userLang = tg?.initDataUnsafe?.user?.language_code;
  if (userLang?.startsWith("ru")) return "ru";

  return "en";
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

function renderStories() {
  const list = document.getElementById("stories");
  const empty = document.getElementById("empty");
  const stories = filteredStories();

  list.innerHTML = "";
  empty.classList.toggle("hidden", stories.length > 0);

  for (const [index, story] of stories.entries()) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-meta">
        <span class="badge">${escapeHtml(story.category[locale])}</span>
        <span class="source">${escapeHtml(story.source)}</span>
      </div>
      <h3 class="card-title">${index + 1}. ${escapeHtml(story.title[locale])}</h3>
      <p class="card-summary">${escapeHtml(story.summary[locale])}</p>
      <a class="card-link" href="${escapeAttr(story.link)}" target="_blank" rel="noopener noreferrer">${LABELS[locale].readMore} →</a>
    `;
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

locale = detectLocale();
loadDigest();
