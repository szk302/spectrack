import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadIgnore } from "../../../src/scanner/ignore-parser.js";

describe("loadIgnore", () => {
  it("spectrack.yml を常に除外する", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-ignore-"));
    try {
      const ig = loadIgnore(dir);
      expect(ig.ignores("spectrack.yml")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(".spectrackignore を常に除外する", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-ignore-"));
    try {
      const ig = loadIgnore(dir);
      expect(ig.ignores(".spectrackignore")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("doc/ 配下のファイルは除外しない", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-ignore-"));
    try {
      const ig = loadIgnore(dir);
      expect(ig.ignores("doc/prd.md")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(".spectrackignore のパターンを適用する", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-ignore-"));
    try {
      writeFileSync(join(dir, ".spectrackignore"), "drafts/\n", "utf-8");
      const ig = loadIgnore(dir);
      expect(ig.ignores("drafts/wip.md")).toBe(true);
      expect(ig.ignores("doc/prd.md")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
