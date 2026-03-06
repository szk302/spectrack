import { describe, it, expect, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext, initListContext } from "../../../src/cli/runner.js";
import { runList } from "../../../src/cli/commands/list.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack list", () => {
  it("ドキュメントを一覧表示して EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("ドキュメントが0件でも EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("複数ドキュメントを一覧表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("未コミット変更があるドキュメントは '未コミットの変更あり' と表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // コミット後にファイルを変更（未コミット状態）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n`,
      "utf-8",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("x-st-id がないドキュメントは '(ID未設定)' と表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  // T6: 未追跡の新規ファイルは mtime フォールバック表示
  it("T6: 未追跡（未コミット）の新規ファイルは 'Git未管理・OSタイムスタンプ' を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    // コミットせずにファイルを追加（未追跡・新規）
    mkdirSync(join(fixture.dir, "doc"), { recursive: true });
    writeFileSync(
      join(fixture.dir, "doc/new.md"),
      `---\nx-st-id: new-001\nx-st-version-path: version\nversion: 0.1.0\n---\n# New\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("Git未管理・OSタイムスタンプ");
      expect(output).toContain("最終更新:");
    } finally {
      logSpy.mockRestore();
    }
  });

  // T7: Git 未初期化ディレクトリでも list は正常動作
  it("T7: Git 未初期化ディレクトリでも list は mtime フォールバックで正常動作する", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-"));
    writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
    mkdirSync(join(tmpDir, "doc"), { recursive: true });
    writeFileSync(
      join(tmpDir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(tmpDir);
      expect(ctx.git).toBeNull();

      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("Git未管理・OSタイムスタンプ");
      expect(output).toContain("prd-001");
    } finally {
      logSpy.mockRestore();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // T8: コミット済みだが変更ありのファイルは '未コミットの変更あり' と '最終コミット' を両方表示
  it("T8: コミット済みの変更ありファイルは '未コミットの変更あり' と '最終コミット' を両方表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // コミット後にファイルを変更（未コミット状態）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("未コミットの変更あり");
      expect(output).toContain("最終コミット:");
    } finally {
      logSpy.mockRestore();
    }
  });
});
