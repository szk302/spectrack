import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { simpleGit } from "simple-git";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runVerify } from "../../../src/cli/commands/verify.js";
import { loadConfig } from "../../../src/config/loader.js";
import { loadIgnore } from "../../../src/scanner/ignore-parser.js";
import { scanFiles } from "../../../src/scanner/file-scanner.js";
import { parseFile } from "../../../src/frontmatter/parser.js";
import { resolveVersion } from "../../../src/version/version-resolver.js";
import { buildIdRegistry } from "../../../src/scanner/id-registry.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack verify", () => {
  it("問題なければ EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("循環依存がある場合は EXIT_CODE=2（警告）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  it("--allow-cycles で循環依存を許容する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({ allowCycles: true }, ctx);
    expect(exitCode).toBe(0);
  });

  it("存在しない依存先参照はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent-id\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("x-st-id がないドキュメントがある場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("バージョン形式が不正（SemVer違反）の場合は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: not-a-semver\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  it("プレリリースに英字を含むバージョンは EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0-alpha\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("ドキュメントが0件の場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("依存関係なしのドキュメントのみの場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("循環依存とバージョン警告が同時発生した場合は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: not-semver\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  // ── 追加テストケース ──────────────────────────────────────────

  it("V1-3: .spectrackignore で除外されたファイルにエラーがあっても EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `ignored/\n`,
      // 有効なドキュメント
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      // ignored/ 以下はエラーがあっても除外される
      "ignored/bad.md": `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n`, // x-st-id 重複だが除外される
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("V1-4: Git未初期化ディレクトリでも EXIT_CODE=0（Working Tree のみで検証）", async () => {
    // git init なしのディレクトリを手動構築
    const dir = mkdtempSync(join(tmpdir(), "spectrack-nongit-"));
    try {
      mkdirSync(join(dir, "doc"), { recursive: true });
      writeFileSync(join(dir, "spectrack.yml"), `frontMatterKeyPrefix: x-st-\n`);
      writeFileSync(
        join(dir, "doc/prd.md"),
        `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      );

      // ctx を手動で構築（git クライアントは dummy）
      const config = loadConfig(dir, false);
      const ig = loadIgnore(dir);
      const filePaths = scanFiles(dir, ig, dir);
      const docs = [];
      const parseErrors: string[] = [];
      for (const fp of filePaths) {
        try {
          const parsed = parseFile(fp, dir);
          const currentVersion = resolveVersion(parsed);
          docs.push({ ...parsed, currentVersion });
        } catch {
          // ignore
        }
      }
      const idRegistry = buildIdRegistry(docs, dir);
      const ctx = {
        config,
        docs,
        idRegistry,
        git: simpleGit(dir), // git コマンドは verify では使用されない
        cwd: dir,
        parseErrors,
      };

      const exitCode = await runVerify({}, ctx);
      expect(exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C2-2: 3ファイル以上の循環依存（a→b→c→a）は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-c\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/c.md": `---\nx-st-id: doc-c\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  it("C2-3: 単純循環と3ファイル循環が混在 + --allow-cycles → EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // 単純循環: x ↔ y
      "doc/x.md": `---\nx-st-id: doc-x\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-y\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/y.md": `---\nx-st-id: doc-y\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-x\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      // 3ファイル循環: a → b → c → a
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-c\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/c.md": `---\nx-st-id: doc-c\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({ allowCycles: true }, ctx);
    expect(exitCode).toBe(0);
  });

  it("C2-4: 自己参照（自身の ID に依存）は EXIT_CODE=2 以上", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBeGreaterThanOrEqual(2);
  });

  it("E3-1: x-st-id が重複しているドキュメントは EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: dup-id\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: dup-id\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("E3-3: x-st-id はあるが versionPath が指す値が欠損している場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // version キーが存在しない
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("E3-4: フロントマターが構文エラーのファイルは EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // インデントが壊れた不正 YAML
      "doc/broken.md": `---\nx-st-id: ok\n  bad: [indent\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("E3-5: バイナリファイルが .md 拡張子で混入している場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // バイナリデータを含むファイルを追加
    const binaryPath = join(fixture.dir, "doc", "binary.md");
    writeFileSync(binaryPath, Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]));

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("W4-2: バージョン値が数値型の場合は EXIT_CODE=1 または 2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // YAML では version: 100 は数値として扱われる
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 100\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBeGreaterThanOrEqual(1);
  });

  it("A5-1: ID重複・リンク切れ・SemVer不正が混在しても全不整合をまとめて検出し EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // ID重複
      "doc/a.md": `---\nx-st-id: dup-id\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: dup-id\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      // リンク切れ
      "doc/c.md": `---\nx-st-id: doc-c\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      // SemVer不正
      "doc/d.md": `---\nx-st-id: doc-d\nx-st-version-path: version\nversion: bad-ver\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });
});
