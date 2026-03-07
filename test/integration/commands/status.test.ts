import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runStatus } from "../../../src/cli/commands/status.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack status", () => {
  it("全ドキュメント: 依存先が最新の場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存先が更新されていたら EXIT_CODE=2（警告）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は 2.0.0、uc は prd-001@1.0.0 を参照
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(2);
  });

  it("特定ファイルを対象に自身の依存状況を確認する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存関係のあるドキュメントがない場合は SUCCESS", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("x-st-id がないファイルを対象にするとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存されている側のファイルを指定すると依存元の状況を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は依存されている側（自身に deps なし）
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      // uc は prd に依存している
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    // prd.md（依存される側）を指定 → uc.md（依存元）の依存状況が表示される
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    // uc.md の prd-001 依存は最新なので SUCCESS
    expect(exitCode).toBe(0);
  });

  it("存在しない依存先参照は EXIT_CODE=1（エラー）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("--strict フラグでパッチ更新も検出する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は 1.0.1（パッチ更新）、uc は 1.0.0 を参照
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.1\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    // strict なしではパッチ更新は無視 → SUCCESS
    const exitCodeNormal = await runStatus(undefined, {}, ctx);
    expect(exitCodeNormal).toBe(0);

    // strict ありではパッチ更新も検出 → WARNING
    const exitCodeStrict = await runStatus(undefined, { strict: true }, ctx);
    expect(exitCodeStrict).toBe(2);
  });

  // S1-3: 依存先が存在しないファイルを指定した場合
  it("S1-3: 依存先なしのファイルを単独指定しても正常終了", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // U2-2: マイナーバージョン更新の検知
  it("U2-2: マイナーバージョン更新（1.0.0→1.1.0）は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(2);
  });

  // U2-3: 0.x.x 帯のマイナー更新
  it("U2-3: 0.x.x 帯のマイナー更新（0.1.0→0.2.0）は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 0.2.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 0.1.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(2);
  });

  // U2-4: 複数依存先の混在（一部更新あり）
  it("U2-4: 複数依存先で一部が更新されている場合は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    // api-001 は 2.0.0 に更新されているので WARNING
    expect(exitCode).toBe(2);
  });

  // V3-3: 無効な SemVer → EXIT_CODE=2 + 警告メッセージ
  it("V3-3: 依存先のバージョンが不正 SemVer の場合は EXIT_CODE=2 + WARNING", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: "1.0"\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const exitCode = await runStatus(undefined, {}, ctx);

      expect(exitCode).toBe(2);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("WARNING:");
      expect(output).toContain("1.0");
      expect(output).toContain("有効なセマンティックバージョンではありません");
    } finally {
      logSpy.mockRestore();
    }
  });

  // E4-4: Git 未初期化ディレクトリ
  it("E4-4: Git 未初期化ディレクトリでは initCommandContext がエラーを投げる", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-"));
    writeFileSync(join(tmpDir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
    try {
      await expect(initCommandContext(tmpDir, false)).rejects.toThrow(
        "Git リポジトリが初期化されていません",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // C5-1: 循環依存・更新なし → EXIT_CODE=0
  it("C5-1: 循環依存があっても更新なしなら EXIT_CODE=0（無限ループしない）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: a-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: b-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# A\n`,
      "doc/b.md": `---\nx-st-id: b-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: a-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# B\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/a.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // C5-2: 循環依存・更新あり → EXIT_CODE=2
  it("C5-2: 循環依存があっても依存先の更新を正しく検知する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: a-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: b-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# A\n`,
      "doc/b.md": `---\nx-st-id: b-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: a-001\n    version: 1.0.0\nversion: 2.0.0\n---\n# B updated\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/a.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(2);
  });

  // F6-1: 依存先のバージョン情報欠損 → EXIT_CODE=1
  it("F6-1: 依存先にバージョンキーが欠損している場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd.md は x-st-version-path を宣言しているがキー自体がない
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // F6-2: x-st-dependencies キー自体が欠損 → EXIT_CODE=0
  it("F6-2: 対象ファイルに x-st-dependencies キーがなくても正常終了", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // F6-3: 依存先ファイルが不正 YAML（バイナリ相当）→ EXIT_CODE=1
  it("F6-3: 依存先ファイルが不正 YAML の場合はクラッシュせず EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // context 構築後に依存先ファイルを不正 YAML で上書き（バイナリ相当）
    const ctx = await initCommandContext(fixture.dir, false);
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      "---\nunclosed: [\n---\ncontent\n",
    );

    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // F6-4: 依存先 id が空文字 → EXIT_CODE=1
  it("F6-4: 依存先 id が空文字の場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: ""\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: ""\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // ── S1-1: 単一ファイル指定で ✅ と現在バージョンが出力される ──
  it("S1-1: 単一ファイル指定時に ✅ とバージョンが出力に含まれる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      const exitCode = await runStatus(filePath, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("✅");
      expect(output).toContain("1.0.0");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── S1-2: プロジェクト全体スキャン時に全ファイルが出力される ──
  it("S1-2: 引数なしで全対象ドキュメントの依存状況が出力される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const exitCode = await runStatus(undefined, {}, ctx);

      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // 全依存先の ID が出力に含まれること
      expect(output).toContain("prd-001");
      expect(output).toContain("api-001");
      expect(output).toContain("✅");
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── U2-1: メジャー更新時に ⚠️ 相当の警告が出力される ─────────
  it("U2-1: メジャーバージョン更新（1.0.0→2.0.0）時に更新警告が出力される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const exitCode = await runStatus(undefined, {}, ctx);

      expect(exitCode).toBe(2);
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // ⚠️ または 🔄 などの更新シンボルが含まれること
      expect(output).toMatch(/[⚠️🔄]/u);
    } finally {
      logSpy.mockRestore();
    }
  });

  // ── V3-1: パッチ更新はデフォルトで無視される ─────────────────
  it("V3-1: パッチ更新（1.0.0→1.0.1）はデフォルトで無視されて EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.1\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // ── V3-2: --strict 指定時はパッチ更新も検知される ────────────
  it("V3-2: --strict 指定時はパッチ更新（1.0.0→1.0.1）も EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.1\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, { strict: true }, ctx);

    expect(exitCode).toBe(2);
  });

  // ── E4-2: frontmatter 完全欠損のファイルを指定 ───────────────
  it("E4-2: frontmatter がないファイルを指定すると EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/plain.md": `# Plain markdown\nNo frontmatter here.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/plain.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // ── E4-3: 依存先が Working tree から削除（Git 履歴には存在） ──
  it("E4-3: 依存先ファイルが削除されている場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // prd.md を git rm で削除してコミット（Git 履歴には残る）
    await fixture.git.rm("doc/prd.md");
    await fixture.git.commit("remove prd.md");

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });
});
