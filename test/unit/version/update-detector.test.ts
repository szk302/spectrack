import { describe, it, expect } from "vitest";
import { detectUpdate } from "../../../src/version/update-detector.js";

const dep = { id: "prd-001", version: "1.0.0" };

describe("detectUpdate", () => {
  it("currentVersion が null の場合は hasUpdate=false", () => {
    const result = detectUpdate(dep, null, null);
    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBeNull();
  });

  it("バージョンが同じ場合は hasUpdate=false", () => {
    const result = detectUpdate(dep, "1.0.0", "abc1234");
    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBe("1.0.0");
    expect(result.commitHash).toBe("abc1234");
  });

  it("マイナー更新は hasUpdate=true", () => {
    const result = detectUpdate(dep, "1.1.0", null);
    expect(result.hasUpdate).toBe(true);
  });

  it("メジャー更新は hasUpdate=true", () => {
    const result = detectUpdate(dep, "2.0.0", null);
    expect(result.hasUpdate).toBe(true);
  });

  it("パッチ更新は strict=false で hasUpdate=false", () => {
    const result = detectUpdate(dep, "1.0.1", null, false);
    expect(result.hasUpdate).toBe(false);
  });

  it("パッチ更新は strict=true で hasUpdate=true", () => {
    const result = detectUpdate(dep, "1.0.1", null, true);
    expect(result.hasUpdate).toBe(true);
  });

  it("依存情報が正しく返される", () => {
    const result = detectUpdate(dep, "1.2.0", "xyz9999");
    expect(result.dependency).toEqual(dep);
    expect(result.commitHash).toBe("xyz9999");
  });
});
