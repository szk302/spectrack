import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, configExists } from "../../../src/config/loader.js";
import { parseConfig } from "../../../src/config/schema.js";
import { DEFAULT_CONFIG } from "../../../src/types/config.js";
import { ConfigNotFoundError } from "../../../src/types/errors.js";

describe("loadConfig", () => {
  it("設定ファイルがなく required=false のとき DEFAULT_CONFIG を返す", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-cfg-"));
    try {
      const config = loadConfig(dir, false);
      expect(config).toEqual(DEFAULT_CONFIG);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("設定ファイルがなく required=true のとき ConfigNotFoundError を投げる", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-cfg-"));
    try {
      expect(() => loadConfig(dir, true)).toThrow(ConfigNotFoundError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("有効な設定ファイルを読み込む", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-cfg-"));
    try {
      writeFileSync(
        join(dir, "spectrack.yml"),
        `frontMatterKeyPrefix: x-st-\ndocumentRootPath: specs\n`,
        "utf-8",
      );
      const config = loadConfig(dir);
      expect(config.documentRootPath).toBe("specs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("configExists", () => {
  it("設定ファイルが存在する場合は true", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-cfg-"));
    try {
      writeFileSync(join(dir, "spectrack.yml"), "", "utf-8");
      expect(configExists(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("設定ファイルが存在しない場合は false", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-cfg-"));
    try {
      expect(configExists(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("parseConfig", () => {
  it("不正な設定データはエラーを投げる", () => {
    expect(() => parseConfig({ frontMatterKeyPrefix: 123 })).toThrow(
      "設定ファイルの形式が不正です",
    );
  });

  it("空オブジェクトはデフォルト値を使用する", () => {
    const config = parseConfig({});
    expect(config.frontMatterKeyPrefix).toBe(DEFAULT_CONFIG.frontMatterKeyPrefix);
    expect(config.documentRootPath).toBe(DEFAULT_CONFIG.documentRootPath);
  });
});
