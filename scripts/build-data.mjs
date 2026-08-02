import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourcePage = "https://www.e-stat.go.jp/classifications/terms/20";
const downloadUrl =
  "https://www.e-stat.go.jp/term/download?bKbn=20&kaiteiCode=02&charset=UTF-8&bom=0&searchMethod=keyword&searchWord=&komokuSearchFlg=1&info1SearchFlg=1&info2SearchFlg=1&info3SearchFlg=0&info4SearchFlg=0&info5SearchFlg=0&info6SearchFlg=0";
const expectedSha256 = "9291694fd144cd6ca65414a183a074bd1ffad80ff7c9aa8b82e12d0852eb699a";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, "public", "data");

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  if (quoted) throw new Error("Official CSV ended inside a quoted field");
  return rows;
};

const response = await fetch(downloadUrl, {
  headers: {
    accept: "text/csv",
    referer: sourcePage,
    "user-agent": "shokugyo-code-data-builder/1.0 (+https://shokugyo-code.yhay81.com/source)",
  },
});
if (!response.ok) throw new Error(`Official CSV returned HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== expectedSha256)
  throw new Error(`Official CSV hash changed: expected ${expectedSha256}, received ${sha256}`);

const rows = parseCsv(bytes.toString("utf8"));
if (rows[0]?.[0] !== "日本標準職業分類(平成21[2009]年12月統計基準設定)")
  throw new Error("Unexpected classification title");
if (rows[1]?.join("|") !== "分類コード|項目名|項目の説明")
  throw new Error("Unexpected classification columns");

const items = [];
let currentMajor = "";
for (const row of rows.slice(3)) {
  const code = (row[0] ?? "").trim();
  if (!code) continue;
  if (!/^(?:[A-L]|\d{2,3})$/u.test(code)) throw new Error(`Unexpected code: ${code}`);
  const name = (row[1] ?? "").trim();
  const description = (row[2] ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .trim();
  if (!name) throw new Error(`Missing name for ${code}`);
  if (code.length === 1) currentMajor = code;
  if (!currentMajor) throw new Error(`Missing major category before ${code}`);
  const level = code.length;
  const parent = level === 1 ? "" : level === 2 ? currentMajor : code.slice(0, 2);
  items.push({ c: code, d: description, l: level, m: currentMajor, n: name, p: parent });
}

const counts = {
  major: items.filter((item) => item.l === 1).length,
  middle: items.filter((item) => item.l === 2).length,
  minor: items.filter((item) => item.l === 3).length,
  total: items.length,
};
const expectedCounts = { major: 12, middle: 74, minor: 329, total: 415 };
if (JSON.stringify(counts) !== JSON.stringify(expectedCounts))
  throw new Error(`Classification dimensions changed: ${JSON.stringify(counts)}`);
if (new Set(items.map((item) => item.c)).size !== items.length)
  throw new Error("Classification codes are not unique");
const byCode = new Map(items.map((item) => [item.c, item]));
for (const item of items)
  if (item.p && !byCode.has(item.p)) throw new Error(`Missing parent ${item.p} for ${item.c}`);

const majors = items
  .filter((item) => item.l === 1)
  .map((item) => ({
    c: item.c,
    count: items.filter((candidate) => candidate.m === item.c && candidate.l === 3).length,
    n: item.n,
  }));
const payload = {
  counts,
  items,
  majors,
  source: {
    bytes: bytes.length,
    downloadUrl,
    interfaceRows: 416,
    retrievedAt: "2026-08-02",
    revision: "02",
    sha256,
    sourcePage,
    title: rows[0][0],
  },
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "index.json"), `${JSON.stringify(payload)}\n`, "utf8");
console.log(
  JSON.stringify({ bytes: bytes.length, counts, output: "public/data/index.json", sha256 }),
);
