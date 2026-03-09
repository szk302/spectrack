import { describe, it, expect } from "vitest";
import {
  isUpdated,
  validateVersion,
  isValidSemVer,
} from "../../../src/version/semver-utils.js";
import { InvalidPrereleaseError, InvalidSemVerWarning } from "../../../src/types/errors.js";

describe("isUpdated", () => {
  describe("メジャーバージョン更新", () => {
    it("1.x.x → 2.x.x は更新あり", () => {
      expect(isUpdated("1.0.0", "2.0.0")).toBe(true);
    });

    it("2.x.x → 1.x.x は更新あり（ダウングレードも検出）", () => {
      expect(isUpdated("2.0.0", "1.0.0")).toBe(true);
    });
  });

  describe("マイナーバージョン更新", () => {
    it("1.0.x → 1.1.x は更新あり", () => {
      expect(isUpdated("1.0.0", "1.1.0")).toBe(true);
    });

    it("0.1.x → 0.2.x は更新あり（0.x.x 特殊ルール）", () => {
      expect(isUpdated("0.1.0", "0.2.0")).toBe(true);
    });
  });

  describe("パッチバージョン更新（strictなし）", () => {
    it("1.0.0 → 1.0.1 は更新なし", () => {
      expect(isUpdated("1.0.0", "1.0.1")).toBe(false);
    });

    it("0.1.0 → 0.1.1 は更新なし", () => {
      expect(isUpdated("0.1.0", "0.1.1")).toBe(false);
    });
  });

  describe("パッチバージョン更新（strict=true）", () => {
    it("1.0.0 → 1.0.1 は更新あり", () => {
      expect(isUpdated("1.0.0", "1.0.1", true)).toBe(true);
    });
  });

  describe("同一バージョン", () => {
    it("1.0.0 = 1.0.0 は更新なし", () => {
      expect(isUpdated("1.0.0", "1.0.0")).toBe(false);
    });
  });
});

describe("validateVersion", () => {
  it("有効な SemVer を受け付ける", () => {
    expect(() => validateVersion("1.0.0")).not.toThrow();
    expect(() => validateVersion("0.1.0")).not.toThrow();
    expect(() => validateVersion("2.3.4")).not.toThrow();
  });

  it("数値プレリリースを受け付ける", () => {
    expect(() => validateVersion("1.0.0-1")).not.toThrow();
    expect(() => validateVersion("1.0.0-2")).not.toThrow();
  });

  it("英字プレリリースはエラー", () => {
    expect(() => validateVersion("1.0.0-alpha")).toThrow(InvalidPrereleaseError);
    expect(() => validateVersion("1.0.0-beta.1")).toThrow(InvalidPrereleaseError);
  });

  it("無効な SemVer は警告", () => {
    expect(() => validateVersion("invalid")).toThrow(InvalidSemVerWarning);
    expect(() => validateVersion("1.0")).toThrow(InvalidSemVerWarning);
  });
});

describe("isValidSemVer", () => {
  it("有効な SemVer を true", () => {
    expect(isValidSemVer("1.0.0")).toBe(true);
    expect(isValidSemVer("0.0.1")).toBe(true);
  });

  it("無効な SemVer を false", () => {
    expect(isValidSemVer("invalid")).toBe(false);
    expect(isValidSemVer("1.0")).toBe(false);
    expect(isValidSemVer("")).toBe(false);
  });
});
