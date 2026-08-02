import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

export type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 413 | 415,
  ) {
    super(code);
  }
}

const origin = "https://shokugyo-code.yhay81.com";
const official = "https://www.e-stat.go.jp/classifications/terms/20";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "major_selected",
  "searched",
  "no_result",
  "level_changed",
  "compared",
  "copied",
  "official_opened",
  "returned",
]);
const majors = [
  ["A", "管理", 10, "plan"],
  ["B", "専門・技術", 91, "lens"],
  ["C", "事務", 26, "desk"],
  ["D", "販売", 19, "shop"],
  ["E", "サービス", 32, "service"],
  ["F", "保安", 11, "shield"],
  ["G", "農林漁業", 12, "field"],
  ["H", "生産工程", 69, "factory"],
  ["I", "輸送・機械運転", 22, "wheel"],
  ["J", "建設・採掘", 22, "frame"],
  ["K", "運搬・清掃・包装", 14, "box"],
  ["L", "分類不能", 1, "blank"],
] as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
    throw new ApiError("unsupported_media_type", 415);
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > 256) throw new ApiError("payload_too_large", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-shokugyo-code-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-shokugyo-code-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex,nofollow" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="職業分類引き" property="og:site_name" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#24362f" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
      <script defer src="/app.js" />
    </head>
    <body>
      <a class="skip-link" href="#main">
        本文へ
      </a>
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="職業分類引き ホーム">
          <span class="job-mark" aria-hidden="true">
            <i>B</i>
            <i>05</i>
            <i>051</i>
          </span>
          <span>職業分類引き</span>
        </a>
        <nav aria-label="案内">
          <a href="/guide">使い方</a>
          <a href="/source">出典</a>
          <a href="/privacy">保存</a>
        </nav>
      </header>
      {children}
      <footer class="site-footer">
        <span>e-Stat「日本標準職業分類」を加工して作成</span>
        <span>
          <a href="/source">出典と注意</a>
          <a href={official} rel="noopener noreferrer">
            e-Stat
          </a>
        </span>
      </footer>
    </body>
  </html>
);

const Workbench = () => (
  <div class="workbench" aria-hidden="true">
    <div class="worker-row">
      <span class="worker researcher">
        <i />
        <b>研究</b>
      </span>
      <span class="worker clerk">
        <i />
        <b>事務</b>
      </span>
      <span class="worker maker">
        <i />
        <b>生産</b>
      </span>
      <span class="worker driver">
        <i />
        <b>輸送</b>
      </span>
    </div>
    <div class="job-rail">
      <span>
        <small>大分類</small>
        <b>B</b>
      </span>
      <i>›</i>
      <span>
        <small>中分類</small>
        <b>05</b>
      </span>
      <i>›</i>
      <span class="final">
        <small>小分類</small>
        <b>051</b>
      </span>
    </div>
    <div class="task-card">
      <small>仕事の内容</small>
      <span>試験・研究施設</span>
      <span>自然科学の知識</span>
      <span>固有の研究テーマ</span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="日本標準職業分類415コードを、仕事内容・分類名・コードから探し、似た候補の説明と階層を並べて比較できます。"
    title="仕事内容から日本標準職業分類を探す | 職業分類引き"
  >
    <main class="home" id="main">
      <section class="intro" aria-labelledby="product-title">
        <div class="product-heading">
          <p class="eyebrow">JAPAN STANDARD OCCUPATIONAL CLASSIFICATION</p>
          <h1 id="product-title">することを探す。3桁へたどる。</h1>
          <p>
            肩書きだけでなく、実際の仕事内容から大・中・小分類を一続きで確認。迷う候補は説明を並べて比べられます。
          </p>
          <div class="facts">
            <span>
              <strong>415</strong>
              <small>分類コード</small>
            </span>
            <span>
              <strong>12</strong>
              <small>大分類</small>
            </span>
            <span>
              <strong>329</strong>
              <small>小分類</small>
            </span>
          </div>
        </div>
        <Workbench />
      </section>
      <div class="version-ribbon">
        <strong>平成21年［2009年］12月 統計基準設定</strong>
        <span>ハローワークの職業分類とは別です。提出先が指定する分類を確認してください。</span>
        <a href="/source">違いを確認</a>
      </div>
      <section class="search-desk" aria-labelledby="search-heading">
        <header class="section-heading">
          <div>
            <p>仕事台帳</p>
            <h2 id="search-heading">仕事内容・分類名・コードで探す</h2>
          </div>
          <output id="data-status">一覧を準備しています…</output>
        </header>
        <label class="job-search" for="job-search">
          <span>実際にすることを入力</span>
          <span class="search-box">
            <i aria-hidden="true">⌕</i>
            <input
              autocomplete="off"
              id="job-search"
              placeholder="例 研究、観光案内、清掃、051…"
              type="search"
            />
            <button id="clear-search" type="button">
              消す
            </button>
          </span>
        </label>
        <fieldset class="level-filter">
          <legend>表示する階層</legend>
          <div>
            <button aria-pressed="true" data-level="3" type="button">
              小分類 3桁
            </button>
            <button aria-pressed="false" data-level="all" type="button">
              全階層
            </button>
            <button aria-pressed="false" data-level="parents" type="button">
              大・中分類
            </button>
          </div>
        </fieldset>
        <p class="privacy-note">入力した仕事内容はこの端末内で照合し、送信・保存しません。</p>
      </section>
      <section class="major-board" aria-labelledby="major-heading">
        <header class="section-heading">
          <div>
            <p>十二の仕事場</p>
            <h2 id="major-heading">大分類からたどる</h2>
          </div>
          <button hidden id="clear-major" type="button">
            すべてへ戻す
          </button>
        </header>
        <div class="major-grid">
          {majors.map(([code, name, count, icon]) => (
            <button data-major={code} type="button">
              <span class={`major-icon ${icon}`} aria-hidden="true">
                <i />
              </span>
              <span class="major-code">{code}</span>
              <strong>{name}</strong>
              <small>小分類 {count}件</small>
            </button>
          ))}
        </div>
      </section>
      <section class="result-and-compare">
        <section class="job-results" aria-labelledby="result-heading">
          <header class="result-heading">
            <div>
              <p>職業票</p>
              <h2 id="result-heading">見つかった分類</h2>
            </div>
            <output id="result-count">—件</output>
          </header>
          <p id="search-status" role="status">
            公式分類表を開いています…
          </p>
          <div class="job-list" id="job-list">
            <p class="loading-note">公式分類表を開いています…</p>
          </div>
          <button class="load-more" hidden id="load-more" type="button">
            次の30件を見る
          </button>
        </section>
        <aside class="compare-tray" aria-labelledby="compare-heading">
          <header>
            <div>
              <p>見比べる</p>
              <h2 id="compare-heading">候補の作業台</h2>
            </div>
            <output id="compared-count">0 / 4</output>
          </header>
          <div id="compared-items">
            <p>職業票の「比べる」を押すと、最大4件の仕事内容を同じ台に置けます。</p>
          </div>
          <div class="compare-actions">
            <button disabled id="copy-compared" type="button">
              分類をまとめてコピー
            </button>
            <button class="clear-button" disabled id="clear-compared" type="button">
              作業台を空にする
            </button>
          </div>
        </aside>
      </section>
    </main>
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="仕事内容から日本標準職業分類の候補を探し、三段階の階層と公式詳細を確認する使い方。"
    title="使い方 | 職業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>引</span>
        <div>
          <p>使い方</p>
          <h1>肩書きではなく、実際にすることをたどる</h1>
        </div>
      </header>
      <div class="instruction-grid">
        <section>
          <b>一</b>
          <h2>仕事内容で探す</h2>
          <p>
            職名だけでなく、どこで何をする仕事かを入力します。分類名と公式説明を端末内で照合します。
          </p>
        </section>
        <section>
          <b>二</b>
          <h2>三段を確認する</h2>
          <p>大分類から中分類、3桁の小分類まで、親子の道筋を一つの職業票に表示します。</p>
        </section>
        <section>
          <b>三</b>
          <h2>迷う候補を並べる</h2>
          <p>最大4件を作業台に置き、説明の冒頭と階層を比較してから公式詳細へ進みます。</p>
        </section>
      </div>
      <div class="classification-anatomy">
        <span>
          <small>大分類</small>
          <b>B</b>
        </span>
        <i>›</i>
        <span>
          <small>中分類</small>
          <b>05</b>
        </span>
        <i>›</i>
        <span>
          <small>小分類</small>
          <b>051</b>
        </span>
      </div>
      <aside class="care-note">
        <strong>キーワード一致だけで決めない</strong>
        <p>
          事例はすべての職種を網羅しません。提出先の指定と、e-Stat詳細の説明・事例・不適合事例を最終確認に使ってください。
        </p>
      </aside>
      <a class="page-cta" href="/">
        職業分類を探す
      </a>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="職業分類引きが利用するe-Stat日本標準職業分類の改定、件数、加工、利用条件と注意事項。"
    title="出典とデータ | 職業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>典</span>
        <div>
          <p>出典とデータ</p>
          <h1>公式分類表を、比較できる仕事台帳へ</h1>
        </div>
      </header>
      <div class="source-grid">
        <section>
          <h2>出典</h2>
          <p>
            e-Stat「
            <a href={official} rel="noopener noreferrer">
              日本標準職業分類（平成21年［2009年］12月統計基準設定）
            </a>
            」の公開CSVを使用します。
          </p>
        </section>
        <section>
          <h2>収録範囲</h2>
          <p>
            大分類12、中分類74、小分類329の合計415コード。e-Statの416件から、コードを持たない検索上の注意1行を除きます。
          </p>
        </section>
        <section>
          <h2>表示の加工</h2>
          <p>
            分類コード、項目名、項目の説明を抽出し、公式順序とコード構造から親子関係、大分類、階層を付けました。公式説明は要約しません。
          </p>
        </section>
        <section>
          <h2>利用条件</h2>
          <p>
            <a href="https://www.e-stat.go.jp/terms-of-use" rel="noopener noreferrer">
              e-Stat利用規約
            </a>
            に従い出典と加工を表示します。e-Statによる作成・保証・推奨を示しません。
          </p>
        </section>
      </div>
      <dl class="source-ledger">
        <div>
          <dt>取得日</dt>
          <dd>2026年8月2日</dd>
        </div>
        <div>
          <dt>改定コード</dt>
          <dd>02</dd>
        </div>
        <div>
          <dt>CSV</dt>
          <dd>149,426 bytes</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>
            <code>9291694fd144cd6ca65414a183a074bd1ffad80ff7c9aa8b82e12d0852eb699a</code>
          </dd>
        </div>
      </dl>
      <aside class="care-note warning">
        <strong>ハローワークの職業分類ではありません</strong>
        <p>
          これは統計に用いる日本標準職業分類です。ハローワークで使う「厚生労働省編職業分類」は令和4年改定の別体系です。申請・調査名を確認してください。
        </p>
      </aside>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="職業分類引きの検索語、比較候補、匿名利用計測の保存範囲。"
    title="保存と計測 | 職業分類引き"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>守</span>
        <div>
          <p>保存と計測</p>
          <h1>仕事内容は端末内。残すのは公開分類だけ。</h1>
        </div>
      </header>
      <div class="privacy-grid">
        <section>
          <h2>検索条件</h2>
          <p>入力した仕事内容、大分類、階層はブラウザ内だけで処理し、サーバーへ送りません。</p>
        </section>
        <section>
          <h2>候補の作業台</h2>
          <p>
            選んだ公開分類を最大4件、ブラウザのローカルストレージへ保存します。画面からいつでも消せます。
          </p>
        </section>
        <section>
          <h2>匿名の利用計測</h2>
          <p>
            訪問、検索、比較、コピーなどの操作種別と匿名化したセッションだけを35日間保存します。仕事内容や分類コードは記録しません。
          </p>
        </section>
        <section>
          <h2>アカウント</h2>
          <p>
            登録、ログイン、個人識別Cookieはありません。自動テストは利用者数から分けて数えます。
          </p>
        </section>
      </div>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", requestId());
app.use("*", async (c, next) => {
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.get("/", (c) => {
  c.header("Cache-Control", "public,max-age=60,s-maxage=300");
  return c.html(<HomePage />);
});
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_request", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ major: 12, ok: row?.ok === 1, service: "shokugyo-code", total: 415 });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=3600,s-maxage=86400");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 職業分類引き"
    >
      <main class="not-found" id="main">
        <span>404</span>
        <h1>この職業票は見つかりません</h1>
        <p>職業分類を探す画面へ戻ってください。</p>
        <a href="/">職業分類を探す</a>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  console.error(
    "request_failed",
    c.get("requestId"),
    error instanceof Error ? error.message : "unknown",
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});
export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};
export { app };
export default { fetch: app.fetch, scheduled };
