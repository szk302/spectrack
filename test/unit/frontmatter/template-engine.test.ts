import { describe, it, expect, vi } from "vitest";
import { expandTemplate, resolveDotPath } from "../../../src/frontmatter/template-engine.js";
import type { Context } from "../../../src/types/context.js";
import { DEFAULT_CONFIG } from "../../../src/types/config.js";

const mockContext: Context = {
  config: DEFAULT_CONFIG,
  file: {
    path: "docs/prd/requirements.md",
    name: "requirements",
    ext: "md",
    dir: "prd",
  },
  frontMatter: {
    "x-st-id": "prd-V1StGXR8",
    "x-st-version-path": "version",
    "x-st-dependencies": [],
  },
  current: { version: "1.0.0" },
  lastCommit: { version: "1.0.0", updatedAt: "2024-11-08T14:30:00Z" },
  previous: { version: "0.9.5", updatedAt: "2024-11-01T09:15:00Z" },
  command: {
    name: "add",
    args: { file: "docs/prd/requirements.md" },
    options: {},
  },
  macro: { nanoid: "V1StGXR8_Z5jdHi6B-myT" },
};

describe("resolveDotPath", () => {
  it("単純なキーを解決する", () => {
    expect(resolveDotPath({ a: "value" }, "a")).toBe("value");
  });

  it("ネストされたパスを解決する", () => {
    expect(resolveDotPath({ a: { b: { c: "deep" } } }, "a.b.c")).toBe("deep");
  });

  it("存在しないパスは undefined を返す", () => {
    expect(resolveDotPath({ a: "value" }, "b")).toBeUndefined();
    expect(resolveDotPath({ a: "value" }, "a.b")).toBeUndefined();
  });

  it("null や undefined を扱える", () => {
    expect(resolveDotPath(null, "a")).toBeUndefined();
    expect(resolveDotPath(undefined, "a")).toBeUndefined();
  });
});

describe("expandTemplate", () => {
  it("context.file.dir を展開する", () => {
    const result = expandTemplate("{{context.file.dir}}", mockContext);
    expect(result).toBe("prd");
  });

  it("nanoid マクロを展開する", () => {
    const result = expandTemplate("{{nanoid}}", mockContext);
    expect(result).toBe("V1StGXR8_Z5jdHi6B-myT");
  });

  it("複合テンプレートを展開する", () => {
    const result = expandTemplate(
      "{{context.file.dir}}-{{nanoid}}",
      mockContext,
    );
    expect(result).toBe("prd-V1StGXR8_Z5jdHi6B-myT");
  });

  it("context.macro.nanoid のフルパスも展開できる", () => {
    const result = expandTemplate("{{context.macro.nanoid}}", mockContext);
    expect(result).toBe("V1StGXR8_Z5jdHi6B-myT");
  });

  it("存在しないパスはそのまま残す", () => {
    const result = expandTemplate("{{context.unknown.path}}", mockContext);
    expect(result).toBe("{{context.unknown.path}}");
  });

  it("テンプレートなし文字列はそのまま返す", () => {
    const result = expandTemplate("no template here", mockContext);
    expect(result).toBe("no template here");
  });

  it("context.file.name を展開する", () => {
    const result = expandTemplate("{{context.file.name}}", mockContext);
    expect(result).toBe("requirements");
  });
});
