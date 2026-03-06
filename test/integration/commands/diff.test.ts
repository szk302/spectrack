import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runDiff } from "../../../src/cli/commands/diff.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack diff", () => {
  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("--version 指定で差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD v1\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD v2\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(0);
  });

  it("--version 省略時は直前バージョンを自動検出する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD v1\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD v2\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("--version 省略・履歴が1件のみの場合は正常終了", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, {}, ctx);

    // バージョン変化がなく比較対象なし → 正常終了
    expect(exitCode).toBe(0);
  });

  it("--version で存在しないバージョンを指定するとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "9.9.9" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("--full オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nLine1.\nLine2.\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nLine1.\nLine2.\nLine3 added.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0", full: true }, ctx);

    expect(exitCode).toBe(0);
  });

  it("--context=1 オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nOriginal.\nAdded.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0", context: 1 }, ctx);

    expect(exitCode).toBe(0);
  });

  it("出力ヘッダーにファイルパスとバージョンが含まれる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD v1\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD v2\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      await runDiff(filePath, { version: "1.0.0" }, ctx);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("🔍");
      expect(output).toContain("doc/prd.md");
      expect(output).toContain("1.0.0");
      expect(output).toContain("Working Tree");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("ネストされたバージョンパス（info.version）でも差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 1.0.0\n`,
    });

    await addAndCommit(fixture, {
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 2.0.0\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/api.yml");
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(0);
  });
});
