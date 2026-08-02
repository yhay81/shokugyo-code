const DATA_URL = "/data/index.json";
const DETAIL_ROOT = "https://www.e-stat.go.jp/classifications/terms/20/02/";
const STORAGE_KEY = "shokugyo-code:compared:v1";
const SESSION_KEY = "shokugyo-code:session:v1";
const PAGE_SIZE = 30;
const LEVEL_NAMES = { 1: "大分類", 2: "中分類", 3: "小分類" };

const byId = (id) => document.getElementById(id);
const input = byId("job-search");
if (input) initialize().catch(showFatalError);

async function initialize() {
  const data = await fetch(DATA_URL, { headers: { accept: "application/json" } }).then(
    (response) => {
      if (!response.ok) throw new Error("data_unavailable");
      return response.json();
    },
  );
  const state = {
    byCode: new Map(data.items.map((item) => [item.c, item])),
    compared: readCompared()
      .filter((code) => data.items.some((item) => item.c === code))
      .slice(0, 4),
    items: data.items,
    level: "3",
    limit: PAGE_SIZE,
    major: "",
    query: "",
  };
  byId("data-status").textContent = `${data.counts.total}コードを収録`;
  bindSearch(state);
  bindLevels(state);
  bindMajors(state);
  bindCompareActions(state);
  byId("load-more").addEventListener("click", () => {
    state.limit += PAGE_SIZE;
    renderResults(state);
  });
  renderCompared(state);
  renderResults(state);
  if (state.compared.length) emit("returned");
  if (!sessionStorage.getItem("shokugyo-code:visited")) {
    sessionStorage.setItem("shokugyo-code:visited", "1");
    emit("visited");
  }
}

function bindSearch(state) {
  let timer;
  input.addEventListener("input", () => {
    state.query = input.value;
    state.limit = PAGE_SIZE;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const query = normalize(state.query);
      if (query) emitOnce(query, filterItems(state).length ? "searched" : "no_result");
    }, 650);
    renderResults(state);
  });
  byId("clear-search").addEventListener("click", () => {
    input.value = "";
    state.query = "";
    state.limit = PAGE_SIZE;
    input.focus();
    renderResults(state);
  });
}

function bindLevels(state) {
  document.querySelectorAll("[data-level]").forEach((button) =>
    button.addEventListener("click", () => {
      state.level = button.dataset.level;
      state.limit = PAGE_SIZE;
      document
        .querySelectorAll("[data-level]")
        .forEach((candidate) =>
          candidate.setAttribute("aria-pressed", String(candidate === button)),
        );
      emit("level_changed");
      renderResults(state);
    }),
  );
}

function bindMajors(state) {
  const clear = byId("clear-major");
  document.querySelectorAll("[data-major]").forEach((button) =>
    button.addEventListener("click", () => {
      state.major = state.major === button.dataset.major ? "" : button.dataset.major;
      state.limit = PAGE_SIZE;
      document
        .querySelectorAll("[data-major]")
        .forEach((candidate) =>
          candidate.setAttribute("aria-pressed", String(candidate.dataset.major === state.major)),
        );
      clear.hidden = !state.major;
      if (state.major) emit("major_selected");
      renderResults(state);
      byId("result-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
  clear.addEventListener("click", () => {
    state.major = "";
    state.limit = PAGE_SIZE;
    clear.hidden = true;
    document
      .querySelectorAll("[data-major]")
      .forEach((button) => button.setAttribute("aria-pressed", "false"));
    renderResults(state);
  });
}

function bindCompareActions(state) {
  byId("clear-compared").addEventListener("click", () => {
    state.compared = [];
    persist(state.compared);
    renderCompared(state);
    renderResults(state);
  });
  byId("copy-compared").addEventListener("click", async () => {
    const lines = state.compared.map((code) => {
      const item = state.byCode.get(code);
      return `${item.c}\t${item.n}\t${trailText(item, state)}`;
    });
    await copyText(["分類コード\t項目名\t階層", ...lines].join("\n"), byId("copy-compared"));
  });
}

function filterItems(state) {
  const tokens = normalize(state.query).split(/\s+/u).filter(Boolean);
  return state.items.filter((item) => {
    if (state.major && item.m !== state.major) return false;
    if (state.level === "3" && item.l !== 3) return false;
    if (state.level === "parents" && item.l === 3) return false;
    if (!tokens.length) return true;
    const path = trailItems(item, state)
      .map((part) => part.n)
      .join(" ");
    const haystack = normalize(`${item.c} ${item.n} ${item.d} ${path}`);
    return tokens.every((token) => haystack.includes(token));
  });
}

function renderResults(state) {
  const filtered = filterItems(state);
  const visible = filtered.slice(0, state.limit);
  const list = byId("job-list");
  list.replaceChildren(...visible.map((item) => jobCard(item, state)));
  if (!visible.length) list.append(emptyResult(state));
  byId("result-count").textContent = `${filtered.length}件`;
  const context = [
    state.major ? `${state.major} ${state.byCode.get(state.major).n}` : "",
    state.level === "all" ? "全階層" : state.level === "parents" ? "大・中分類" : "小分類",
    normalize(state.query) ? `「${state.query.trim()}」` : "",
  ].filter(Boolean);
  byId("search-status").textContent = `${context.join("・")}で ${filtered.length}件`;
  const more = byId("load-more");
  more.hidden = visible.length >= filtered.length;
  more.textContent = `次の${Math.min(PAGE_SIZE, filtered.length - visible.length)}件を見る`;
}

function jobCard(item, state) {
  const article = element("article", `job-card level-${item.l}`);
  const heading = element("header", "job-heading");
  heading.append(
    element("code", "job-code", item.c),
    element("span", "level-badge", LEVEL_NAMES[item.l]),
  );
  article.append(heading, element("h3", "", item.n));
  const trail = element("ol", "job-trail");
  trailItems(item, state).forEach((part) => {
    const node = element("li");
    node.append(element("code", "", part.c), element("span", "", part.n));
    trail.append(node);
  });
  article.append(trail);
  const description = element(
    "p",
    "job-description",
    item.d || "公式CSVに説明はありません。詳細ページを確認してください。",
  );
  article.append(description);
  const actions = element("div", "card-actions");
  const copy = button("コードをコピー", "copy-button", () =>
    copyText(`${item.c}\t${item.n}`, copy),
  );
  const selected = state.compared.includes(item.c);
  const compare = button(
    selected ? "作業台から外す" : "比べる",
    `compare-button${selected ? " is-selected" : ""}`,
    () => {
      if (selected) state.compared = state.compared.filter((code) => code !== item.c);
      else if (state.compared.length >= 4) return flash(compare, "4件までです");
      else {
        state.compared.push(item.c);
        emit("compared");
      }
      persist(state.compared);
      renderCompared(state);
      renderResults(state);
    },
  );
  const officialLink = element("a", "official-link", "公式詳細");
  officialLink.href = `${DETAIL_ROOT}${item.c}`;
  officialLink.target = "_blank";
  officialLink.rel = "noopener noreferrer";
  officialLink.addEventListener("click", () => emit("official_opened"));
  actions.append(copy, compare, officialLink);
  article.append(actions);
  return article;
}

function renderCompared(state) {
  const holder = byId("compared-items");
  const items = state.compared.map((code) => state.byCode.get(code)).filter(Boolean);
  if (!items.length)
    holder.replaceChildren(
      element(
        "p",
        "empty-tray",
        "職業票の「比べる」を押すと、最大4件の仕事内容を同じ台に置けます。",
      ),
    );
  else
    holder.replaceChildren(
      ...items.map((item) => {
        const row = element("article", "compared-row");
        const heading = element("header");
        heading.append(element("code", "", item.c), element("strong", "", item.n));
        const path = element("small", "", trailText(item, state));
        const summary = element("p", "", compact(item.d, 120));
        const remove = button("外す", "remove-compared", () => {
          state.compared = state.compared.filter((code) => code !== item.c);
          persist(state.compared);
          renderCompared(state);
          renderResults(state);
        });
        row.append(heading, path, summary, remove);
        return row;
      }),
    );
  byId("compared-count").textContent = `${items.length} / 4`;
  byId("copy-compared").disabled = !items.length;
  byId("clear-compared").disabled = !items.length;
}

function trailItems(item, state) {
  const parts = [];
  let current = item;
  while (current) {
    parts.unshift(current);
    current = current.p ? state.byCode.get(current.p) : null;
  }
  return parts;
}
function trailText(item, state) {
  return trailItems(item, state)
    .map((part) => `${part.c} ${part.n}`)
    .join(" > ");
}
function compact(value, limit) {
  const text = String(value).replace(/\s+/gu, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function emptyResult(state) {
  const box = element("div", "empty-result");
  box.append(
    element("b", "", "一致する分類がありません"),
    element(
      "p",
      "",
      "肩書きではなく、実際の作業や場所のことばへ変えるか、階層と大分類を戻してみてください。",
    ),
  );
  box.append(
    button("条件をすべて戻す", "reset-button", () => {
      state.query = "";
      state.major = "";
      state.level = "3";
      state.limit = PAGE_SIZE;
      input.value = "";
      byId("clear-major").hidden = true;
      document
        .querySelectorAll("[data-major]")
        .forEach((candidate) => candidate.setAttribute("aria-pressed", "false"));
      document
        .querySelectorAll("[data-level]")
        .forEach((candidate) =>
          candidate.setAttribute("aria-pressed", String(candidate.dataset.level === "3")),
        );
      renderResults(state);
    }),
  );
  return box;
}

function normalize(value) {
  return String(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[‐‑‒–—―ーｰ\s]/gu, " ")
    .trim();
}
function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(label, className, action) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
async function copyText(value, control) {
  try {
    await navigator.clipboard.writeText(value);
    emit("copied");
    flash(control, "コピーしました");
  } catch {
    flash(control, "コピーできません");
  }
}
function flash(control, label) {
  const original = control.textContent;
  control.textContent = label;
  setTimeout(() => {
    control.textContent = original;
  }, 1200);
}
function readCompared() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function persist(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value.slice(0, 4)));
  } catch {
    /* storage may be disabled */
  }
}
const emitted = new Set();
function emitOnce(query, name) {
  if (emitted.has(query)) return;
  emitted.add(query);
  emit(name);
}
function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}
function emit(name) {
  fetch("/api/telemetry", {
    body: JSON.stringify({ name }),
    headers: {
      "content-type": "application/json",
      "x-shokugyo-code-qa": navigator.webdriver ? "1" : "0",
      "x-shokugyo-code-session": sessionId(),
    },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
function showFatalError() {
  byId("data-status").textContent = "一覧を読み込めませんでした";
  byId("search-status").textContent = "通信状況を確認して、ページを再読み込みしてください。";
  byId("job-list").replaceChildren(
    element("p", "loading-note", "公式分類表を読み込めませんでした。"),
  );
}
