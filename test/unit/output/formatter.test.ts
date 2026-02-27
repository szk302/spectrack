import { describe, it, expect, vi, afterEach } from "vitest";
import {
  printDocHeader,
  formatDepStatus,
  printTreeItems,
  SEPARATOR,
} from "../../../src/output/formatter.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printDocHeader", () => {
  it("バージョンとコミットハッシュあり", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printDocHeader("prd-001", "doc/prd.md", "1.0.0", "abc1234");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("(1.0.0 @ abc1234)"),
    );
  });

  it("バージョンあり・コミットハッシュなし", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printDocHeader("prd-001", "doc/prd.md", "1.0.0", null);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("(1.0.0)"));
    expect(spy).toHaveBeenCalledWith(expect.not.stringContaining("@"));
  });

  it("バージョンなし・コミットハッシュなし", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printDocHeader("prd-001", "doc/prd.md");
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain("[prd-001]");
    expect(output).not.toContain("(");
  });

  it("バージョンなし・コミットハッシュあり（無視される）", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printDocHeader("prd-001", "doc/prd.md", null, "abc1234");
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).not.toContain("(");
  });
});

describe("formatDepStatus", () => {
  it("更新なしのステータスを出力する", () => {
    const result = formatDepStatus("prd-001", "doc/prd.md", "1.0.0", "1.0.0", "abc1234", false);
    expect(result).toContain("✅");
    expect(result).not.toContain("⚠️");
  });

  it("更新ありのステータスを出力する", () => {
    const result = formatDepStatus("prd-001", "doc/prd.md", "1.0.0", "2.0.0", null, true);
    expect(result).toContain("🔄");
    expect(result).toContain("⚠️ 更新あり");
  });

  it("currentVersion が null の場合は '不明' を表示する", () => {
    const result = formatDepStatus("prd-001", "doc/prd.md", "1.0.0", null, null, false);
    expect(result).toContain("不明");
  });
});

describe("printTreeItems", () => {
  it("最後のアイテムには └─ を使う", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printTreeItems(["item1", "item2"]);
    const lines = spy.mock.calls.map((c) => c[0] as string);
    expect(lines[0]).toContain("├─");
    expect(lines[1]).toContain("└─");
  });

  it("アイテムが1つの場合は └─ のみ", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printTreeItems(["only"]);
    expect(spy.mock.calls[0]?.[0]).toContain("└─");
  });
});

describe("SEPARATOR", () => {
  it("30文字の区切り線", () => {
    expect(SEPARATOR).toHaveLength(30);
  });
});
