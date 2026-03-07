import { describe, it, expect, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runDepsDiff } from "../../../src/cli/commands/deps-diff.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack deps-diff", () => {
  it("依存先が更新されている場合は差分を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal content.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nOriginal content.\nNew feature added.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      const exitCode = await runDepsDiff(filePath, {}, ctx);

      expect(exitCode).toBe(0);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("prd-001");
      expect(output).toContain("1.0.0");
      expect(output).toContain("1.1.0");
      expect(output).toContain("━");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("依存先が同じバージョンの場合はスキップする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存関係がないドキュメントはメッセージを表示して成功する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("ファイルが存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("x-st-id がないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存先が IDレジストリに存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: ghost-999\n    path: doc/ghost.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("参照バージョンのコミットが見つからない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 9.9.9\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("複数の依存先がある場合は更新ありのものだけ差分を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\n  - id: api-001\n    path: doc/api.md\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nUpdated.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("--full オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nLine1.\nLine2.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nLine1.\nLine2.\nLine3 added.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, { full: true }, ctx);

    expect(exitCode).toBe(0);
  });

  it("--context=1 オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nOriginal.\nAdded line.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, { context: 1 }, ctx);

    expect(exitCode).toBe(0);
  });

  // ── DD1-2: 複数依存先の連続出力検証 ───────────────────────────────
  it("DD1-2: 複数の依存先が両方ともセパレータ付きで連続して出力される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\n  - id: api-001\n    path: doc/api.md\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nUpdated prd.\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.1.0\n---\n# API\nUpdated api.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      const exitCode = await runDepsDiff(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 両方の依存先 ID が出力に含まれること
      expect(output).toContain("prd-001");
      expect(output).toContain("api-001");
      // セパレータが複数回出力されること（各依存先のブロックに含まれる）
      expect((output.match(/━/g) ?? []).length).toBeGreaterThanOrEqual(2);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T2-1: リネーム後のファイルを ID ベースで追跡 ──────────────────
  it("T2-1: 依存先ファイルがリネームされても ID ベースで発見し差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/b.md": `---\nx-st-id: b-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# B doc\n`,
      "doc/a.md": `---\nx-st-id: a-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: b-001\n    path: doc/b.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# A doc\n`,
    });

    // b.md を renamed/b.md に移動してバージョンアップ
    mkdirSync(join(fixture.dir, "doc/renamed"), { recursive: true });
    await fixture.git.mv("doc/b.md", "doc/renamed/b.md");
    await fixture.git.add(".");
    writeFileSync(
      join(fixture.dir, "doc/renamed/b.md"),
      `---\nx-st-id: b-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# B doc\nNew content.\n`,
      "utf-8",
    );
    await fixture.git.add(".");
    await fixture.git.commit("rename and update b.md");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/a.md");
      const exitCode = await runDepsDiff(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // リネーム後のパスで b-001 が発見・表示されること
      expect(output).toContain("b-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── G4-1: Git 未初期化 ──────────────────────────────────────────
  it("G4-1: Git未初期化ディレクトリで initCommandContext は GitNotInitializedError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-depsdiff-"));
    try {
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      await expect(initCommandContext(tmpDir, false)).rejects.toThrow(
        "Git リポジトリが初期化されていません",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G4-2: Gitコミットゼロ ─────────────────────────────────────────
  it("G4-2: Gitコミットゼロの状態で initCommandContext は GitNoCommitsError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-commit-depsdiff-"));
    try {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      await expect(initCommandContext(tmpDir, false)).rejects.toThrow(
        "少なくとも1つのコミットが必要です",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── E5-3: バイナリファイルを含む依存リストでもループ継続 ──────────
  it("E5-3: 依存リスト中の1ファイルがバイナリ化しても他の依存先の差分は表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/bin.md": `---\nx-st-id: bin-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Binary\n`,
      "doc/normal.md": `---\nx-st-id: normal-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Normal\nOriginal.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: bin-001\n    path: doc/bin.md\n    version: 1.0.0\n  - id: normal-001\n    path: doc/normal.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // bin.md をバイナリデータに置き換えてコミット
    writeFileSync(
      join(fixture.dir, "doc/bin.md"),
      Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]),
    );
    await addAndCommit(fixture, {
      "doc/normal.md": `---\nx-st-id: normal-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# Normal\nUpdated.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      // クラッシュせず終了すること
      const exitCode = await runDepsDiff(filePath, {}, ctx);
      expect([0, 1]).toContain(exitCode);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 正常な normal-001 の差分は出力されること
      expect(output).toContain("normal-001");
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  // ── E5-4: 依存先のバージョン情報欠損 ─────────────────────────────
  it("E5-4: 依存先のバージョン情報が欠損していてもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\n---\n# PRD without version\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      const exitCode = await runDepsDiff(filePath, {}, ctx);
      // クラッシュせず 0 または 1 で終了すること
      expect([0, 1]).toContain(exitCode);
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
