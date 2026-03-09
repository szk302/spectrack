import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ignore from "ignore";
import { scanFiles, getExtension } from "../../../src/scanner/file-scanner.js";

function makeIgnore() {
  return ignore();
}

describe("scanFiles", () => {
  it("存在しないディレクトリは空配列を返す", () => {
    const ig = makeIgnore();
    const result = scanFiles("/nonexistent/path/xyz", ig, "/tmp");
    expect(result).toEqual([]);
  });

  it("対象拡張子のファイルを返す", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-scan-"));
    try {
      writeFileSync(join(dir, "a.md"), "", "utf-8");
      writeFileSync(join(dir, "b.yml"), "", "utf-8");
      writeFileSync(join(dir, "c.txt"), "", "utf-8");
      const result = scanFiles(dir, makeIgnore(), dir);
      expect(result).toHaveLength(2);
      expect(result.some((p) => p.endsWith("a.md"))).toBe(true);
      expect(result.some((p) => p.endsWith("b.yml"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("サブディレクトリを再帰的にスキャンする", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-scan-"));
    try {
      mkdirSync(join(dir, "sub"));
      writeFileSync(join(dir, "top.md"), "", "utf-8");
      writeFileSync(join(dir, "sub", "nested.md"), "", "utf-8");
      const result = scanFiles(dir, makeIgnore(), dir);
      expect(result).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignore パターンに一致するファイルはスキップする", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-scan-"));
    try {
      writeFileSync(join(dir, "keep.md"), "", "utf-8");
      writeFileSync(join(dir, "skip.md"), "", "utf-8");
      const ig = makeIgnore();
      ig.add("skip.md");
      const result = scanFiles(dir, ig, dir);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatch(/keep\.md$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("getExtension", () => {
  it("md ファイルは 'md' を返す", () => {
    expect(getExtension("/path/to/file.md")).toBe("md");
  });

  it("yml ファイルは 'yml' を返す", () => {
    expect(getExtension("/path/to/file.yml")).toBe("yml");
  });

  it("yaml ファイルは 'yaml' を返す", () => {
    expect(getExtension("/path/to/file.yaml")).toBe("yaml");
  });

  it("拡張子なしのファイルは null を返す", () => {
    expect(getExtension("/path/to/README")).toBe(null);
  });

  it("対象外の拡張子は null を返す", () => {
    expect(getExtension("/path/to/file.txt")).toBe(null);
  });
});
