import { describe, it, expect, afterEach, vi } from "vitest";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
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

  // ── L1-1: 3コミット履歴が新しい順に3エントリ表示される ─────
  it("L1-1: 3回のバージョン更新履歴が新しい順に3エントリ表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\n`,
    });
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 3バージョンすべてが出力されること
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.1.0");
      expect(output).toContain("1.0.0");
      // 最新が ✨、それ以外が 📝
      expect(output).toContain("✨");
      const notesCount = (output.match(/📝/g) ?? []).length;
      expect(notesCount).toBe(2);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── L1-2: 初回コミットのみで1エントリ表示される ────────────
  it("L1-2: 初回コミットのみのファイルは1エントリだけ表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("1.0.0");
      expect(output).toContain("✨");
      // 📝 は出ないこと（エントリが1つのみ）
      expect(output).not.toContain("📝");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── L1-3: バージョンダウングレードも時系列順に表示 ──────────
  it("L1-3: バージョンダウングレード（1.0.0→2.0.0→1.5.0）も時系列順に表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
    });
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.5.0\n---\n# PRD\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 3バージョンすべてが出力されること
      expect(output).toContain("1.5.0");
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.0.0");
      // 最新の 1.5.0 が先頭（✨）
      const lines = logSpy.mock.calls.map((c) => String(c[0])).filter(l => l.includes("✨") || l.includes("📝"));
      expect(lines[0]).toContain("1.5.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── F2-1: 本文のみのコミットはバージョン変更なしとしてスキップ ─
  it("F2-1: 本文のみのコミットは除外され、バージョン変更コミットのみ表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal body.\n`,
    });
    // 本文のみ変更（バージョン変わらず）
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nBody change 1.\n`,
    });
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nBody change 2.\n`,
    });
    // バージョンを変更
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nBody change 2.\n`,
    });
    // また本文のみ変更
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nBody change 3.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // バージョン変更のあった 2.0.0 と 1.0.0 の2エントリのみ
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.0.0");
      // ✨ は1回、📝 は1回（合計2エントリ）
      expect((output.match(/✨/g) ?? []).length).toBe(1);
      expect((output.match(/📝/g) ?? []).length).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── F2-2: 未コミットのバージョン変更は先頭に (Working Tree) で表示 ─
  it("F2-2: 未コミットのバージョン更新が先頭に (Working Tree) として表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    // バージョンを未コミットで変更
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // Working Tree エントリが先頭に表示されること
      expect(output).toContain("Working Tree");
      expect(output).toContain("2.0.0");
      // 過去コミットの 1.0.0 も表示されること
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── F2-3: 本文変更・バージョン維持 → Working Tree エントリなし ──
  it("F2-3: 本文のみ変更でバージョンが同じ場合は Working Tree エントリが追加されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
    });

    // バージョンは変えずに本文のみ変更（未コミット）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nModified body.\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // Working Tree エントリは追加されないこと
      expect(output).not.toContain("Working Tree");
      // 1.0.0 のコミット履歴は表示されること
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T3-1: リネーム後も --follow で過去履歴を追跡できる ───────
  it("T3-1: ファイルリネーム後も旧ファイル時代の履歴が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/old.md": `---\nx-st-id: doc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Old\n`,
    });
    // バージョンアップ（旧ファイル名）
    await addAndCommit(fixture, {
      "doc/old.md": `---\nx-st-id: doc-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# Old\n`,
    });
    // ファイルを git mv でリネーム
    mkdirSync(join(fixture.dir, "doc/new"), { recursive: true });
    await fixture.git.mv("doc/old.md", "doc/new/new.md");
    writeFileSync(
      join(fixture.dir, "doc/new/new.md"),
      `---\nx-st-id: doc-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# New\n`,
      "utf-8",
    );
    await fixture.git.add(".");
    await fixture.git.commit("rename and bump to 2.0.0");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/new/new.md");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // リネーム前の 1.0.0 と 1.1.0、リネーム後の 2.0.0 が表示されること
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.1.0");
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T3-2: ネストされたバージョンパス（ラベル付き） ──────────
  it("T3-2: ネストされた info.version が全コミットで正しくパースされる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 1.0.0\n`,
    });
    await addAndCommit(fixture, {
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 2.0.0\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/api.yml");
      const exitCode = await runLog(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── G4-1: Git 未初期化 ───────────────────────────────────────
  it("G4-1: Git未初期化ディレクトリでは initCommandContext が GitNotInitializedError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-log-"));
    try {
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      await expect(initCommandContext(tmpDir, false)).rejects.toThrow(
        "Git リポジトリが初期化されていません",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G4-2: Gitコミットゼロ ────────────────────────────────────
  it("G4-2: Gitコミットゼロの状態では initCommandContext が GitNoCommitsError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-commit-log-"));
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

  // ── E5-1: ファイル不在（ラベル付き） ─────────────────────────
  it("E5-1: 存在しないファイルパスを指定すると EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/not_found.md");
    const exitCode = await runLog(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // ── E5-2: frontmatter なしのファイル ─────────────────────────
  it("E5-2: frontmatter がないファイルは versionPath が null で履歴なし表示 → EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/plain.md": `# Plain markdown\nNo frontmatter.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/plain.md");
      // versionPath が null → getVersionHistory に "version" フォールバック → version キーなし → history空 or 履歴なし
      const exitCode = await runLog(filePath, {}, ctx);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E5-3: 過去コミットの YAML が破損していてもスキップされる ──
  it("E5-3: 過去コミットの YAML が破損していてもクラッシュせず残りの履歴を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });
    // 壊れた YAML をコミット
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nbroken: [\nunclosed bracket\n---\n# corrupted\n`,
    });
    // 正常なバージョンに戻す
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      // クラッシュせず正常終了
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 正常なコミット（2.0.0, 1.0.0）は表示されること
      expect(output).toContain("2.0.0");
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E5-4: 過去コミットでバージョンキー欠損 → 安全にハンドリング ─
  it("E5-4: 過去コミットでバージョンキーが欠損していてもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });
    // バージョンキーなしのコミット
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\n---\n# PRD no version\n`,
    });
    // バージョンあり
    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runLog(filePath, {}, ctx);

      // クラッシュせず正常終了
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 正常なバージョンは表示されること
      expect(output).toContain("2.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });
});
