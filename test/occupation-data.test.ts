import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Item = { c: string; d: string; l: number; m: string; n: string; p: string };
type Data = {
  counts: { major: number; middle: number; minor: number; total: number };
  items: Item[];
  majors: Array<{ c: string; count: number; n: string }>;
  source: Record<string, string | number>;
};
const path = resolve(process.cwd(), "public/data/index.json");
const data = JSON.parse(readFileSync(path, "utf8")) as Data;
const byCode = new Map(data.items.map((item) => [item.c, item]));

describe("official Japan Standard Occupational Classification", () => {
  it("retains verified CSV metadata", () => {
    expect(data.source).toMatchObject({
      bytes: 149426,
      interfaceRows: 416,
      retrievedAt: "2026-08-02",
      revision: "02",
      sha256: "9291694fd144cd6ca65414a183a074bd1ffad80ff7c9aa8b82e12d0852eb699a",
      title: "日本標準職業分類(平成21[2009]年12月統計基準設定)",
    });
    expect(data.source.sourcePage).toBe("https://www.e-stat.go.jp/classifications/terms/20");
  });
  it("contains all 415 unique codes at the three official levels", () => {
    expect(data.counts).toEqual({ major: 12, middle: 74, minor: 329, total: 415 });
    expect(data.items).toHaveLength(415);
    expect(data.majors).toHaveLength(12);
    expect(new Set(data.items.map((item) => item.c)).size).toBe(415);
  });
  it("retains valid parents and major references", () => {
    data.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual(["c", "d", "l", "m", "n", "p"]);
      expect(item.c).toMatch(/^(?:[A-L]|\d{2,3})$/u);
      expect(item.n.length).toBeGreaterThan(0);
      expect(byCode.get(item.m)?.l).toBe(1);
      if (item.p) {
        expect(byCode.has(item.p)).toBe(true);
        expect(byCode.get(item.p)?.l).toBe(item.l - 1);
      } else expect(item.l).toBe(1);
    });
  });
  it("retains known research, tourism, and final records", () => {
    expect(byCode.get("051")).toMatchObject({ l: 3, m: "B", n: "自然科学系研究者", p: "05" });
    expect(byCode.get("421")).toMatchObject({ l: 3, m: "E", n: "旅行・観光案内人", p: "42" });
    expect(byCode.get("999")).toMatchObject({ l: 3, m: "L", n: "分類不能の職業", p: "99" });
  });
  it("stays within the static delivery budget", () => {
    expect(statSync(path).size).toBeLessThan(230_000);
  });
});
