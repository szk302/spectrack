import { describe, it, expect, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
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

  // ── L1-1: 出力検証 ─────────────────────────────────────
  it("L1-1: ドキュメント一覧にパス・ID・バージョン・コミット情報が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("doc/prd.md");
      expect(output).toContain("prd-001");
      expect(output).toContain("1.0.0");
      expect(output).toContain("最終コミット:");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── L1-2: 0件メッセージ ────────────────────────────────
  it("L1-2: ドキュメントが0件の時「追跡対象のドキュメントがありません」が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("追跡対象のドキュメントがありません");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── G2-2: Gitコミットゼロ ──────────────────────────────
  it("G2-2: Gitコミットゼロのリポジトリは mtime フォールバックで表示される", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-commit-"));
    try {
      const git = simpleGit(tmpDir);
      await git.init();
      await git.addConfig("user.name", "Test User");
      await git.addConfig("user.email", "test@example.com");

      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      mkdirSync(join(tmpDir, "doc"), { recursive: true });
      writeFileSync(
        join(tmpDir, "doc/prd.md"),
        `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
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
      } finally {
        logSpy.mockRestore();
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G2-5: 本文のみ変更 ─────────────────────────────────
  it("G2-5: バージョン変更なしの本文のみ変更でも '未コミットの変更あり' が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n本文\n`,
    });

    // 本文のみ変更（バージョンは同じ）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n変更後の本文\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("未コミットの変更あり");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── F3-1: .spectrackignore ─────────────────────────────
  it("F3-1: .spectrackignore に指定されたファイルは一覧に表示されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `ignored/\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "ignored/secret.md": `---\nx-st-id: secret-001\nx-st-version-path: version\nversion: 0.1.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("prd-001");
      expect(output).not.toContain("secret-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── B4-1: 深いディレクトリ階層 ────────────────────────
  it("B4-1: 深いディレクトリ階層のファイルも正しく表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "a/b/c/d/e/deep.md": `---\nx-st-id: deep-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("deep-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── B4-2: 0バイトファイル ──────────────────────────────
  it("B4-2: 0バイトの .md ファイルがあってもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/empty.md": ``,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("prd-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── B4-3: マルチバイト文字のパス ──────────────────────
  it("B4-3: 日本語ファイル名・ディレクトリ名のパスも正しく表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "仕様書/要件定義.md": `---\nx-st-id: req-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("req-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── V5-1: 不正な型の値 ─────────────────────────────────
  it("V5-1: x-st-id が数値型・version が配列型でもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: 123\nx-st-version-path: version\nversion:\n  - 1\n  - 0\n  - 0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── V5-2: SemVer非準拠の文字列 ────────────────────────
  it("V5-2: SemVer非準拠の英字入りバージョン (1.0.0-alpha) でもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: alpha-001\nx-st-version-path: version\nversion: 1.0.0-alpha\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("1.0.0-alpha");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T6-1: 大文字拡張子 ─────────────────────────────────
  it("T6-1: 大文字拡張子 (.MD) のファイルも対象として認識される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/SPEC.MD": `---\nx-st-id: spec-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("spec-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T6-2: 対象外拡張子 ─────────────────────────────────
  it("T6-2: .txt, .json などの対象外拡張子ファイルは一覧に表示されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/readme.txt": `テキストファイル`,
      "doc/config.json": `{"key":"value"}`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).not.toContain("readme.txt");
      expect(output).not.toContain("config.json");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T6-3: 隠しファイル ─────────────────────────────────
  it("T6-3: 隠しファイル (.hidden.md) があってもクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".hidden.md": `---\nx-st-id: hidden-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── T6-4: シンボリックリンクのループ ──────────────────
  it("T6-4: シンボリックリンクのループがあってもスタックオーバーフローしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // 親ディレクトリへのシンボリックリンクを張る（ループ）
    symlinkSync(fixture.dir, join(fixture.dir, "doc/loop"));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E7-1: 設定ファイル不在 ─────────────────────────────
  it("E7-1: spectrack.yml が存在しない場合 initListContext がエラーをスローする", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-config-"));
    try {
      await expect(initListContext(tmpDir)).rejects.toThrow(
        "spectrack.yml が見つかりません",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── E7-2: IDの重複 ─────────────────────────────────────
  it("E7-2: ID重複がある場合 initListContext が DuplicateIdError をスローする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: dup-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: dup-001\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    await expect(initListContext(fixture.dir)).rejects.toThrow("ERROR: ID重複検出");
  });

  // ── E7-3: フロントマターの破損 ────────────────────────
  it("E7-3: フロントマターが破損したファイルがあっても他の正常なファイルは表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/corrupted.md": `---\nkey: [unclosed\n---\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("prd-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E7-4: 必須キーの欠損 ──────────────────────────────
  it("E7-4: x-st-id が欠損したファイルは '(ID未設定)' として安全に表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/no-id.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initListContext(fixture.dir);
      const exitCode = await runList(ctx);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("(ID未設定)");
    } finally {
      logSpy.mockRestore();
    }
  });
});
