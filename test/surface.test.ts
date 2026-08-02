import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("product surface", () => {
  const worker = read("src/worker.tsx");
  const client = read("public/app.js");
  const css = read("public/styles.css");
  const migration = read("migrations/0001_telemetry.sql");
  const source = read("SOURCE.md");
  const surface = `${worker}\n${client}`;
  it("communicates through workers, hierarchy rail, category workspaces, cards, and comparison bench", () => {
    expect(worker).toContain('class="workbench"');
    expect(worker).toContain('class="worker-row"');
    expect(worker).toContain('class="job-rail"');
    expect(worker).toContain('class="major-grid"');
    expect(worker).toContain('class="compare-tray"');
    expect(client).toContain('element("article", `job-card');
    expect(client).toContain('element("article", "compared-row")');
    expect(css.toLowerCase()).not.toContain("gradient");
  });
  it("keeps job descriptions and choices in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain("fetch(DATA_URL");
    expect(client).toContain("localStorage");
    expect(client).toContain("state.compared.length >= 4");
    expect(client).toContain("value.slice(0, 4)");
    expect(migration).not.toMatch(
      /job_description|classification_code|query|search_term|email|phone|advertising/iu,
    );
    expect(client).not.toMatch(/history\.(?:pushState|replaceState)|location\.search\s*=/u);
  });
  it("shows full hierarchy and sends decisions to official details", () => {
    expect(client).toContain("trailItems(item, state)");
    expect(client).toContain("trailText(item, state)");
    expect(client).toContain("https://www.e-stat.go.jp/classifications/terms/20/02/");
    expect(client).toContain('emit("official_opened")');
    expect(client).not.toContain("innerHTML");
    expect(worker).not.toContain("dangerouslySetInnerHTML");
  });
  it("states revision, dimensions, terms, transformation, and classification boundary", () => {
    expect(source).toContain("平成21年［2009年］12月");
    expect(source).toContain("415");
    expect(source).toContain("e-Stat terms of use");
    expect(source).toContain("Transformation / 加工");
    expect(source).toContain("厚生労働省編職業分類");
    expect(worker).toContain("ハローワークの職業分類とは別");
  });
  it("separates automated QA and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain('"x-shokugyo-code-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
  it("contains no internal evaluation language", () => {
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });
});
