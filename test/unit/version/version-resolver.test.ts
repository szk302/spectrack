import { describe, it, expect } from "vitest";
import {
  resolveVersion,
  resolveVersionFromRaw,
} from "../../../src/version/version-resolver.js";
import { parseContent } from "../../../src/frontmatter/parser.js";

describe("resolveVersion", () => {
  it("version キーから直接解決する", () => {
    const content = `---\nx-st-version-path: version\nversion: 1.2.3\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    expect(resolveVersion(doc)).toBe("1.2.3");
  });

  it("info.version のネストパスを解決する", () => {
    const content = `x-st-version-path: info.version\ninfo:\n  version: 3.0.0\n`;
    const doc = parseContent(content, "/tmp/api.yml", "yml", "/tmp");
    expect(resolveVersion(doc)).toBe("3.0.0");
  });

  it("versionPath が未設定の場合は null を返す", () => {
    const content = `---\nx-st-id: prd-001\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    expect(resolveVersion(doc)).toBeNull();
  });

  it("バージョンフィールドが存在しない場合は null を返す", () => {
    const content = `---\nx-st-version-path: version\n---\n`;
    const doc = parseContent(content, "/tmp/test.md", "md", "/tmp");
    expect(resolveVersion(doc)).toBeNull();
  });
});

describe("resolveVersionFromRaw", () => {
  it("フラットなキーを解決する", () => {
    const raw = { version: "1.0.0" };
    expect(resolveVersionFromRaw(raw, "version")).toBe("1.0.0");
  });

  it("ネストされたパスを解決する", () => {
    const raw = { info: { version: "2.0.0" } };
    expect(resolveVersionFromRaw(raw, "info.version")).toBe("2.0.0");
  });

  it("存在しないパスは null を返す", () => {
    const raw = { other: "value" };
    expect(resolveVersionFromRaw(raw, "version")).toBeNull();
  });
});
