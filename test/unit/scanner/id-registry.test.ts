import { describe, it, expect } from "vitest";
import {
  buildIdRegistry,
  resolveId,
  findIdByPath,
} from "../../../src/scanner/id-registry.js";
import { DuplicateIdError } from "../../../src/types/errors.js";
import type { VersionedDocument } from "../../../src/types/document.js";

function makeDoc(id: string, filePath: string): VersionedDocument {
  return {
    filePath,
    relativePath: filePath.replace("/tmp/", ""),
    ext: "md",
    frontMatter: {
      id,
      versionPath: "version",
      dependencies: [],
      raw: { "x-st-id": id, version: "1.0.0" },
    },
    yamlDoc: {} as never,
    body: null,
    rawContent: "",
    currentVersion: "1.0.0",
  };
}

describe("buildIdRegistry", () => {
  it("ID → filePath のマッピングを構築する", () => {
    const docs = [
      makeDoc("prd-001", "/tmp/prd.md"),
      makeDoc("uc-001", "/tmp/uc.md"),
    ];
    const registry = buildIdRegistry(docs, "/tmp");
    expect(registry.size).toBe(2);
    expect(registry.get("prd-001")?.filePath).toBe("/tmp/prd.md");
  });

  it("ID が未設定のドキュメントはスキップする", () => {
    const doc: VersionedDocument = {
      filePath: "/tmp/no-id.md",
      relativePath: "no-id.md",
      ext: "md",
      frontMatter: {
        id: undefined,
        versionPath: "version",
        dependencies: [],
        raw: {},
      },
      yamlDoc: {} as never,
      body: null,
      rawContent: "",
      currentVersion: null,
    };
    const registry = buildIdRegistry([doc], "/tmp");
    expect(registry.size).toBe(0);
  });

  it("ID が重複している場合は DuplicateIdError を投げる", () => {
    const docs = [
      makeDoc("prd-001", "/tmp/prd1.md"),
      makeDoc("prd-001", "/tmp/prd2.md"),
    ];
    expect(() => buildIdRegistry(docs, "/tmp")).toThrow(DuplicateIdError);
  });
});

describe("resolveId", () => {
  it("存在する ID を解決する", () => {
    const docs = [makeDoc("prd-001", "/tmp/prd.md")];
    const registry = buildIdRegistry(docs, "/tmp");
    const entry = resolveId(registry, "prd-001");
    expect(entry?.filePath).toBe("/tmp/prd.md");
  });

  it("存在しない ID は undefined を返す", () => {
    const registry = buildIdRegistry([], "/tmp");
    expect(resolveId(registry, "nonexistent")).toBeUndefined();
  });
});

describe("findIdByPath", () => {
  it("ファイルパスから ID を逆引きする", () => {
    const docs = [makeDoc("prd-001", "/tmp/prd.md")];
    const registry = buildIdRegistry(docs, "/tmp");
    expect(findIdByPath(registry, "/tmp/prd.md")).toBe("prd-001");
  });

  it("存在しないパスは undefined を返す", () => {
    const registry = buildIdRegistry([], "/tmp");
    expect(findIdByPath(registry, "/tmp/nonexistent.md")).toBeUndefined();
  });
});
