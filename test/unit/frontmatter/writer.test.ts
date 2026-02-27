import { describe, it, expect } from "vitest";
import { parseContent } from "../../../src/frontmatter/parser.js";
import {
  updateFrontMatter,
  serializeDocument,
  addFrontMatter,
} from "../../../src/frontmatter/writer.js";

describe("updateFrontMatter", () => {
  it("フロントマターのキーを更新する", () => {
    const content = `---\n# コメント\nx-st-id: prd-001\nversion: 1.0.0\n---\n# Body\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");

    const updated = updateFrontMatter(doc, { version: "2.0.0" });
    expect(updated.frontMatter.raw["version"]).toBe("2.0.0");
  });

  it("元の Document は変更されない（不変性）", () => {
    const content = `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    const originalVersion = doc.frontMatter.raw["version"];

    updateFrontMatter(doc, { version: "2.0.0" });

    expect(doc.frontMatter.raw["version"]).toBe(originalVersion);
  });

  it("依存関係を更新する", () => {
    const content = `---\nx-st-id: uc-001\nx-st-dependencies: []\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");

    const updated = updateFrontMatter(doc, {
      "x-st-dependencies": [{ id: "prd-001", version: "1.0.0" }],
    });

    expect(updated.frontMatter.dependencies).toHaveLength(1);
    expect(updated.frontMatter.dependencies[0]).toEqual({
      id: "prd-001",
      version: "1.0.0",
    });
  });
});

describe("serializeDocument - .md ファイル", () => {
  it("YAML コメントを保持する", () => {
    const content = `---\n# これはコメントです\nx-st-id: prd-001\nversion: 1.0.0\n---\n# Body\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    const updated = updateFrontMatter(doc, { version: "1.1.0" });

    const serialized = serializeDocument(updated);
    expect(serialized).toContain("# これはコメントです");
  });

  it("本文を保持する", () => {
    const content = `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n\n# My Document\n\nSome content here.\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    const updated = updateFrontMatter(doc, { version: "2.0.0" });

    const serialized = serializeDocument(updated);
    expect(serialized).toContain("# My Document");
    expect(serialized).toContain("Some content here.");
  });

  it("--- 区切りを保持する", () => {
    const content = `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    const updated = updateFrontMatter(doc, { version: "2.0.0" });

    const serialized = serializeDocument(updated);
    expect(serialized).toMatch(/^---\n/);
    expect(serialized).toContain("\n---");
  });
});

describe("serializeDocument - .yml ファイル", () => {
  it(".yml ファイルを正しくシリアライズする", () => {
    const content = `x-st-id: api-001\ninfo:\n  version: 1.0.0\n`;
    const doc = parseContent(content, "/tmp/api.yml", "yml", "/tmp");
    const updated = updateFrontMatter(doc, {});

    const serialized = serializeDocument(updated);
    expect(serialized).toContain("x-st-id: api-001");
    expect(serialized).not.toContain("---");
  });
});

describe("updateFrontMatter - x-st-id なし", () => {
  it("x-st-id がないドキュメントを更新しても id は保持される", () => {
    const content = `version: 1.0.0\ninfo: test\n`;
    const doc = parseContent(content, "/tmp/api.yml", "yml", "/tmp");
    // doc.frontMatter.id is undefined (no x-st-id in content)
    const updated = updateFrontMatter(doc, { version: "2.0.0" });
    expect(updated.frontMatter.id).toBeUndefined();
    expect(updated.frontMatter.raw["version"]).toBe("2.0.0");
  });
});

describe("addFrontMatter", () => {
  it("フロントマターなし .md に新規フロントマターを追加する", () => {
    const content = `# Hello World\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");

    const updated = addFrontMatter(doc, {
      "x-st-id": "new-001",
      version: "0.0.0",
    });

    const serialized = serializeDocument(updated);
    expect(serialized).toContain("x-st-id: new-001");
    expect(serialized).toContain("version: 0.0.0");
    expect(serialized).toContain("# Hello World");
  });

  it("空ファイルにフロントマターを追加する", () => {
    const doc = parseContent("", "/tmp/empty.md", "md", "/tmp");
    const updated = addFrontMatter(doc, {
      "x-st-id": "empty-001",
      version: "0.0.0",
    });

    const serialized = serializeDocument(updated);
    expect(serialized).toContain("x-st-id: empty-001");
  });

  it("x-st-id なしで addFrontMatter すると id は undefined", () => {
    const doc = parseContent("", "/tmp/empty.md", "md", "/tmp");
    const updated = addFrontMatter(doc, { version: "0.0.0" });
    expect(updated.frontMatter.id).toBeUndefined();
  });
});
