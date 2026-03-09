import { describe, it, expect } from "vitest";
import { buildVersionUpdates } from "../../../../src/cli/commands/bump.js";

describe("buildVersionUpdates", () => {
  it("単純なバージョンパス 'version' を更新する", () => {
    const raw = { version: "1.0.0" };
    const result = buildVersionUpdates(raw, "version", "2.0.0");
    expect(result).toEqual({ version: "2.0.0" });
  });

  it("ネストパス 'info.version' を更新する", () => {
    const raw = { info: { version: "1.0.0", title: "API" } };
    const result = buildVersionUpdates(raw, "info.version", "2.0.0");
    expect(result).toEqual({ info: { version: "2.0.0", title: "API" } });
  });

  it("深いネストパス 'a.b.c' を更新する", () => {
    const raw = { a: { b: { c: "1.0.0" } } };
    const result = buildVersionUpdates(raw, "a.b.c", "3.0.0");
    expect(result).toEqual({ a: { b: { c: "3.0.0" } } });
  });

  it("ネストのトップキーが存在しない場合でも更新オブジェクトを構築する", () => {
    const raw = {};
    const result = buildVersionUpdates(raw, "info.version", "1.0.0");
    expect(result).toEqual({ info: { version: "1.0.0" } });
  });

  it("ネストパスで他のフィールドを保持する（イミュータビリティ）", () => {
    const raw = { info: { version: "1.0.0", title: "My API", contact: "dev@example.com" } };
    const result = buildVersionUpdates(raw, "info.version", "2.0.0");
    expect((result.info as Record<string, unknown>)["title"]).toBe("My API");
    expect((result.info as Record<string, unknown>)["contact"]).toBe("dev@example.com");
  });

  it("元の raw オブジェクトを変更しない（イミュータビリティ）", () => {
    const raw = { info: { version: "1.0.0" } };
    const rawBefore = JSON.stringify(raw);
    buildVersionUpdates(raw, "info.version", "2.0.0");
    expect(JSON.stringify(raw)).toBe(rawBefore);
  });
});
