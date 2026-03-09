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
import { initCommandContext, initDependentsContext } from "../../../src/cli/runner.js";
import { runDependents } from "../../../src/cli/commands/dependents.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack dependents", () => {
  it("依存しているドキュメントを表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDependents(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("複数のドキュメントが依存している場合も表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc1.md": `---\nx-st-id: uc1-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC1\n`,
      "doc/uc2.md": `---\nx-st-id: uc2-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC2\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDependents(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存しているドキュメントがない場合は SUCCESS", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDependents(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("x-st-id がないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDependents(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runDependents(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // ── 通常モードの出力検証 ────────────────────────────────
  it("通常モード: 出力に '@ Working tree' が含まれる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("@ Working tree");
      expect(output).toContain("uc-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── --all モード: 現在も依存中 ──────────────────────────
  it("--all モード: 現在の依存ファイルに '現在も依存中' が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, { all: true }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("現在も依存中");
      expect(output).toContain("uc-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── --all モード: 過去の依存（削除済みファイル）の検出 ──
  it("--all モード: 過去に依存して削除されたファイルが '過去に依存' として表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/old-uc.md": `---\nx-st-id: old-uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    // 依存ファイルを削除してコミット
    await addAndCommit(fixture, {
      "doc/old-uc.md": `---\nx-st-id: old-uc-001\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    }, "remove dependency");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, { all: true }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("過去に依存");
      expect(output).toContain("old-uc.md");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── --all モード: 依存なし（履歴含む） ────────────────────
  it("--all モード: 依存が一切ない場合は '見つかりませんでした' を表示", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, { all: true }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("見つかりませんでした");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── D1-4: 循環依存 ─────────────────────────────────────
  it("D1-4: 循環依存状態でも無限ループにならず b.md が1件だけ表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: a-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: b-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: b-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: a-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/a.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("b-001");
      // b.md が1回だけ表示されること（重複なし）
      const matches = output.match(/b-001/g) ?? [];
      expect(matches.length).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── D1-5: 未コミット変更の反映 ─────────────────────────
  it("D1-5: 未コミット状態で追加した依存も Working Tree として即座にヒットする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // 未コミット状態で依存を追加
    writeFileSync(
      join(fixture.dir, "doc/uc.md"),
      `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "utf-8",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("uc-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── H2-1: ファイルごと削除された過去依存 ───────────────
  it("H2-1: ファイルごと削除された過去の依存元が --all で '過去に依存' として表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/old-uc.md": `---\nx-st-id: old-uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    // old-uc.md をGitから削除してコミット
    await fixture.git.rm(["doc/old-uc.md"]);
    await fixture.git.commit("delete old-uc.md");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, { all: true }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("過去に依存");
      expect(output).toContain("old-uc.md");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── G3-1: 通常モード・Git未初期化 → exit 0 ────────────
  it("G3-1: 通常モードは Git 未初期化でも exit 0 で Working Tree から逆引きできる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-dep-"));
    try {
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      mkdirSync(join(tmpDir, "doc"), { recursive: true });
      writeFileSync(
        join(tmpDir, "doc/prd.md"),
        `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
        "utf-8",
      );
      writeFileSync(
        join(tmpDir, "doc/uc.md"),
        `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
        "utf-8",
      );

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        const ctx = await initDependentsContext(tmpDir);
        expect(ctx.git).toBeNull();
        const filePath = join(tmpDir, "doc/prd.md");
        const exitCode = await runDependents(filePath, {}, ctx);

        expect(exitCode).toBe(0);
        const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
        expect(output).toContain("uc-001");
      } finally {
        logSpy.mockRestore();
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G3-2: --all・Git未初期化 → exit 1 ─────────────────
  it("G3-2: --all モードは Git 未初期化の場合 exit 1 でエラーを出力する", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-all-"));
    try {
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      mkdirSync(join(tmpDir, "doc"), { recursive: true });
      writeFileSync(
        join(tmpDir, "doc/prd.md"),
        `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
        "utf-8",
      );

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const ctx = await initDependentsContext(tmpDir);
        expect(ctx.git).toBeNull();
        const filePath = join(tmpDir, "doc/prd.md");
        const exitCode = await runDependents(filePath, { all: true }, ctx);

        expect(exitCode).toBe(1);
      } finally {
        errSpy.mockRestore();
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G3-3: --all・Gitコミットゼロ → exit 1 ─────────────
  it("G3-3: --all モードは Git コミットゼロの場合 exit 1 でエラーを出力する", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-commit-dep-"));
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

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const ctx = await initDependentsContext(tmpDir);
        expect(ctx.git).toBeNull();
        const filePath = join(tmpDir, "doc/prd.md");
        const exitCode = await runDependents(filePath, { all: true }, ctx);

        expect(exitCode).toBe(1);
      } finally {
        errSpy.mockRestore();
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── B4-3: .spectrackignore 適用 ─────────────────────────
  it("B4-3: .spectrackignore に指定されたディレクトリの依存元ファイルは表示されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `ignored/\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "ignored/hidden.md": `---\nx-st-id: hidden-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("uc-001");
      expect(output).not.toContain("hidden-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E5-3: 破損ファイルの巻き込み防止 ──────────────────
  it("E5-3: 破損ファイルがあっても他の正常な依存元は正しく表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/broken.md": `---\nkey: [unclosed\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("uc-001");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E5-4: 依存先リストの型不正 ─────────────────────────
  it("E5-4: x-st-dependencies が文字列型でも TypeError を起こさずスキップされる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/bad-deps.md": `---\nx-st-id: bad-001\nx-st-version-path: version\nx-st-dependencies: "not-an-array"\nversion: 1.0.0\n---\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initDependentsContext(fixture.dir);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDependents(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("uc-001");
    } finally {
      logSpy.mockRestore();
    }
  });
});
