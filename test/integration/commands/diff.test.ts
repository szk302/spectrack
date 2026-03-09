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

  // ── D1-3: 変更がない場合の「差分なし」表示 ────────────
  it("D1-3: Working Tree に変更がない場合は '差分なし' を表示して exit 0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    // Working Tree はコミット内容と同一（未コミット変更なし）
    // --version=1.0.0 で比較するとファイルが同一 → 差分なし
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("差分なし");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── D1-4: 未コミット変更のみ（バージョン変わらず）────
  it("D1-4: バージョン変更なし・本文のみ未コミット変更でも最新コミットとの差分を表示", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal body.\n`,
    });

    // バージョンは変えずに本文だけ変更（未コミット）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nModified body.\n`,
      "utf-8",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // ── M2-1: 離れた複数箇所の変更（Hunk分割） ──────────
  it("M2-1: 離れた2箇所の変更が2つの独立した @@ ブロックで表示される", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}.`);
    const original = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 1.0.0",
      "---",
      ...lines,
    ].join("\n") + "\n";

    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": original,
    });

    // 1行目と30行目を変更してバージョンアップ
    const modified = lines.slice();
    modified[0] = "Line 1 changed.";
    modified[29] = "Line 30 changed.";
    const updated = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 2.0.0",
      "---",
      ...modified,
    ].join("\n") + "\n";

    await addAndCommit(fixture, { "doc/prd.md": updated });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 2つの独立した @@ ブロックが存在すること
      const hunkCount = (output.match(/^@@/gm) ?? []).length;
      expect(hunkCount).toBeGreaterThanOrEqual(2);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── M2-2: 近接する変更（Hunk結合） ───────────────────
  it("M2-2: 近接した2箇所の変更がコンテキスト範囲内なら1つの @@ ブロックに結合される", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}.`);
    const original = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 1.0.0",
      "---",
      ...lines,
    ].join("\n") + "\n";

    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": original,
    });

    // バージョンはそのままで本文の10行目と12行目のみ変更（未コミット）
    // バージョン変更を加えないことでフロントマター部分の差分ブロックを除去し、
    // body の2変更のみが context=3 の範囲で1つのブロックに結合されることを検証する
    const modified = lines.slice();
    modified[9] = "Line 10 changed.";
    modified[11] = "Line 12 changed.";
    const workingTree = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 1.0.0",
      "---",
      ...modified,
    ].join("\n") + "\n";

    writeFileSync(join(fixture.dir, "doc/prd.md"), workingTree, "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 1つの @@ ブロックに結合されること
      const hunkCount = (output.match(/^@@/gm) ?? []).length;
      expect(hunkCount).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── M2-3: --context によるHunk結合変化 ───────────────
  it("M2-3: --context=1 で分割、--context=5 で結合されること", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}.`);
    const original = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 1.0.0",
      "---",
      ...lines,
    ].join("\n") + "\n";

    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": original,
    });

    // 10行目と15行目を変更（間隔4行）
    const modified = lines.slice();
    modified[9] = "Line 10 changed.";
    modified[14] = "Line 15 changed.";
    const updated = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 2.0.0",
      "---",
      ...modified,
    ].join("\n") + "\n";

    await addAndCommit(fixture, { "doc/prd.md": updated });

    const logSpy1 = vi.spyOn(console, "log").mockImplementation(() => {});
    let hunkCountContext1 = 0;
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      await runDiff(filePath, { version: "1.0.0", context: 1 }, ctx);
      const output = logSpy1.mock.calls.map((c) => String(c[0])).join("\n");
      hunkCountContext1 = (output.match(/^@@/gm) ?? []).length;
    } finally {
      logSpy1.mockRestore();
    }

    const logSpy5 = vi.spyOn(console, "log").mockImplementation(() => {});
    let hunkCountContext5 = 0;
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      await runDiff(filePath, { version: "1.0.0", context: 5 }, ctx);
      const output = logSpy5.mock.calls.map((c) => String(c[0])).join("\n");
      hunkCountContext5 = (output.match(/^@@/gm) ?? []).length;
    } finally {
      logSpy5.mockRestore();
    }

    expect(hunkCountContext1).toBeGreaterThanOrEqual(2); // context=1 では分割
    expect(hunkCountContext5).toBe(1);                   // context=5 では結合
  });

  // ── M2-4: ファイル先頭と末尾の変更 ───────────────────
  it("M2-4: ファイル先頭と末尾の変更で配列外参照エラーが発生しない", async () => {
    const lines = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}.`);
    const original = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 1.0.0",
      "---",
      ...lines,
    ].join("\n") + "\n";

    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": original,
    });

    // フロントマター直下の行と最終行を変更
    const modified = lines.slice();
    modified[0] = "Line 1 changed.";
    modified[14] = "Line 15 changed.";
    const updated = [
      "---",
      "x-st-id: prd-001",
      "x-st-version-path: version",
      "version: 2.0.0",
      "---",
      ...modified,
    ].join("\n") + "\n";

    await addAndCommit(fixture, { "doc/prd.md": updated });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(0);
  });

  // ── O3-2: --context=0 の指定 ──────────────────────────
  it("O3-2: --context=0 はコンテキスト行なしで変更行のみ表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nChanged.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0", context: 0 }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // -U0 なのでコンテキスト行を含まない
      expect(output).toContain("-Original.");
      expect(output).toContain("+Changed.");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── O3-4: --full --context=5 の競合（full 優先）────────
  it("O3-4: --full と --context=5 を同時指定しても --full が優先されて exit 0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\nChanged.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(
      filePath,
      { version: "1.0.0", full: true, context: 5 },
      ctx,
    );

    expect(exitCode).toBe(0);
  });

  // ── G4-1: Git未初期化 → initCommandContext が throw ───
  it("G4-1: Git未初期化ディレクトリで initCommandContext は GitNotInitializedError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-diff-"));
    try {
      writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      await expect(initCommandContext(tmpDir, false)).rejects.toThrow(
        "Git リポジトリが初期化されていません",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── G4-2: Gitコミットゼロ → initCommandContext が throw ─
  it("G4-2: Gitコミットゼロの状態で initCommandContext は GitNoCommitsError を投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-commit-diff-"));
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

  // ── H5-3: フロントマターのみの変更 ───────────────────
  it("H5-3: 本文は同じでフロントマターのみ変更された場合も差分が表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n同じ本文。\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\n同じ本文。\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("1.0.0");
      expect(output).toContain("1.1.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── E6-2: 対象ファイルが未初期化 ─────────────────────
  it("E6-2: フロントマターがないファイルは exit 1 でエラーを出力する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nNo frontmatter here.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // ── E6-3: バイナリファイルの差分比較 ─────────────────
  it("E6-3: バイナリコンテンツに変更されても exit 0 または exit 1 でクラッシュしない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    // バイナリデータに置き換えてコミット
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]),
    );
    await fixture.git.add("doc/prd.md");
    await fixture.git.commit("replace with binary");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/prd.md");
      const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

      // クラッシュせず 0 または 1 で終了すること
      expect([0, 1]).toContain(exitCode);
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
