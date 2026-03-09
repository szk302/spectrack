import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { parseContent, parseFile } from "../../../src/frontmatter/parser.js";

describe("parseContent - .md ファイル", () => {
  const cwd = "/tmp/test";

  it("フロントマター付き .md をパースする", () => {
    const content = `---
x-st-id: prd-abc123
x-st-version-path: version
x-st-dependencies: []
version: 1.0.0
---

# Hello
`;
    const result = parseContent(content, "/tmp/test/doc/prd.md", "md", cwd);
    expect(result.frontMatter.id).toBe("prd-abc123");
    expect(result.frontMatter.versionPath).toBe("version");
    expect(result.frontMatter.dependencies).toEqual([]);
    expect(result.frontMatter.raw["version"]).toBe("1.0.0");
    expect(result.body).toBe("\n# Hello\n");
    expect(result.ext).toBe("md");
  });

  it("フロントマターなし .md は空の frontMatter を返す", () => {
    const content = `# Hello\nsome content\n`;
    const result = parseContent(content, "/tmp/test/doc/readme.md", "md", cwd);
    expect(result.frontMatter.id).toBeUndefined();
    expect(result.body).toBe(content);
  });

  it("依存関係を正しくパースする", () => {
    const content = `---
x-st-id: uc-001
x-st-version-path: version
x-st-dependencies:
  - id: prd-abc123
    version: 1.0.0
  - id: domain-xyz789
    version: 2.1.0
version: 0.5.0
---
`;
    const result = parseContent(content, "/tmp/test/doc/uc.md", "md", cwd);
    expect(result.frontMatter.dependencies).toHaveLength(2);
    expect(result.frontMatter.dependencies[0]).toEqual({
      id: "prd-abc123",
      version: "1.0.0",
    });
    expect(result.frontMatter.dependencies[1]).toEqual({
      id: "domain-xyz789",
      version: "2.1.0",
    });
  });

  it("空ファイルはエラーなしで処理される", () => {
    const result = parseContent("", "/tmp/test/doc/empty.md", "md", cwd);
    expect(result.frontMatter.id).toBeUndefined();
  });
});

describe("parseContent - .yml ファイル", () => {
  const cwd = "/tmp/test";

  it(".yml ファイルをパースする", () => {
    const content = `x-st-id: api-spec-001
x-st-version-path: info.version
x-st-dependencies: []
info:
  version: 3.0.0
`;
    const result = parseContent(content, "/tmp/test/doc/api.yml", "yml", cwd);
    expect(result.frontMatter.id).toBe("api-spec-001");
    expect(result.frontMatter.versionPath).toBe("info.version");
    expect(result.ext).toBe("yml");
    expect(result.body).toBeNull();
  });
});

describe("parseFile", () => {
  it("実ファイルをパースできる", () => {
    const dir = mkdtempSync(join(tmpdir(), "spectrack-parser-test-"));
    try {
      const filePath = join(dir, "test.md");
      writeFileSync(
        filePath,
        `---\nx-st-id: test-001\nversion: 1.0.0\n---\n# Test\n`,
        "utf-8",
      );
      const result = parseFile(filePath, dir);
      expect(result.frontMatter.id).toBe("test-001");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
