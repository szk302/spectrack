import { describe, it, expect } from "vitest";
import {
  splitFrontMatter,
  joinFrontMatter,
  insertFrontMatter,
} from "../../../src/frontmatter/md-handler.js";

describe("splitFrontMatter", () => {
  it("--- 区切りのフロントマターを分割する", () => {
    const content = `---\ntitle: test\nversion: 1.0.0\n---\n\n# Hello\n`;
    const result = splitFrontMatter(content);
    expect(result.hasFrontMatter).toBe(true);
    expect(result.frontMatterStr).toBe("title: test\nversion: 1.0.0");
    expect(result.body).toBe("\n# Hello\n");
  });

  it("フロントマターがない場合は hasFrontMatter=false", () => {
    const content = `# Hello\nsome content\n`;
    const result = splitFrontMatter(content);
    expect(result.hasFrontMatter).toBe(false);
    expect(result.frontMatterStr).toBe("");
    expect(result.body).toBe(content);
  });

  it("空ファイルは hasFrontMatter=false", () => {
    const result = splitFrontMatter("");
    expect(result.hasFrontMatter).toBe(false);
  });

  it("CRLF 改行も対応する", () => {
    const content = `---\r\ntitle: test\r\n---\r\n\r\n# Hello`;
    const result = splitFrontMatter(content);
    expect(result.hasFrontMatter).toBe(true);
    expect(result.frontMatterStr).toBe("title: test");
  });

  it("空のフロントマターも分割する", () => {
    const content = `---\n---\n# Hello`;
    const result = splitFrontMatter(content);
    expect(result.hasFrontMatter).toBe(true);
    expect(result.frontMatterStr).toBe("");
  });
});

describe("joinFrontMatter", () => {
  it("フロントマターと本文を結合する", () => {
    const result = joinFrontMatter("title: test", "\n# Hello\n");
    expect(result).toBe("---\ntitle: test\n---\n# Hello\n");
  });

  it("本文が改行で始まらない場合は改行を追加", () => {
    const result = joinFrontMatter("title: test", "# Hello");
    expect(result).toBe("---\ntitle: test\n---\n# Hello");
  });
});

describe("insertFrontMatter", () => {
  it("空ファイルにフロントマターを挿入する", () => {
    const result = insertFrontMatter("", "title: test");
    expect(result).toBe("---\ntitle: test\n---\n");
  });

  it("既存コンテンツの前にフロントマターを挿入する", () => {
    const result = insertFrontMatter("# Hello\n", "title: test");
    expect(result).toBe("---\ntitle: test\n---\n# Hello\n");
  });
});
