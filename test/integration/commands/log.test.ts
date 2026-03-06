import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runLog } from "../../../src/cli/commands/log.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack log", () => {
  it("存在しないファイルは EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runLog(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("バージョン履歴がタイムライン形式で表示される（複数コミット）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD updated\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 最新バージョン: ✨、旧バージョン: 📝
      expect(output).toContain("✨");
      expect(output).toContain("📝");
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("バージョン変更がない場合は '履歴が見つかりません' で EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runLog(filePath, {}, ctx);

    // 1コミットのみで version の変化がない場合は履歴なし
    expect(exitCode).toBe(0);
  });

  it("ヘッダーにファイルパスが含まれる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      await runLog(filePath, {}, ctx);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // ヘッダー行にファイルパスが含まれる
      expect(output).toContain("doc/prd.md");
      expect(output).toContain("🕒");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("ネストされたバージョンパス（info.version）のログを表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 1.0.0\n`,
    });

    await addAndCommit(fixture, {
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 2.0.0\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/api.yml");
    const exitCode = await runLog(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });
});
