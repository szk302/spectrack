import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runBump } from "../../../src/cli/commands/bump.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack bump", () => {
  // ── セクション 1: 基本動作（正常系）──────────────────────────────────────

  it("B1-1: メジャーバージョンを更新する (1.2.3 → 2.0.0)", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.2.3\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 2.0.0");
  });

  it("B1-2: マイナーバージョンを更新する (1.2.3 → 1.3.0)", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.2.3\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.3.0");
  });

  it("B1-3: パッチバージョンを更新する (1.2.3 → 1.2.4)", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.2.3\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { patch: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.2.4");
  });

  it("B1-4: 0.x.x のバージョンをマイナー更新する (0.1.2 → 0.2.0)", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 0.1.2\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 0.2.0");
  });

  it("B1-5: YAMLコメントを維持したままバージョンを更新する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0 # 初期版\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("1.1.0");
    expect(content).toContain("# 初期版");
  });

  // ── セクション 2: オプションの組み合わせ・競合 ──────────────────────────

  it("C2-1: 更新種別オプションを指定しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, {}, ctx);

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
  });

  it("C2-2: 更新種別オプションを複数指定した場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true, patch: true }, ctx);

    expect(exitCode).toBe(1);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
  });

  it("C2-3: --dry-run では実際の書き込みを行わない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true, dryRun: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
    expect(content).not.toContain("version: 2.0.0");
  });

  // ── セクション 3: バージョン仕様の境界値・特殊ルール ─────────────────────

  it("S3-1: 数値プレリリース (1.0.0-1) のパッチ更新は正常に行われる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0-1\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { patch: true }, ctx);

    expect(exitCode).toBe(0);
  });

  it("S3-2: 英字プレリリース (1.0.0-alpha) はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0-alpha\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(1);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0-alpha");
  });

  it("S3-3: SemVer非準拠バージョン (1.0) はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("S3-3: SemVer非準拠バージョン (v1.0.0) はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: v1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(1);
  });

  // ── セクション 4: ネストされたバージョンパスの解決 ───────────────────────

  it("P4-1: ネストされたバージョンパス (info.version) を更新する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: 1.0.0\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/api.yml");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.1.0");
  });

  it("P4-2: 存在しないパス階層を指定した場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: metadata.docs.version\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { patch: true }, ctx);

    expect(exitCode).toBe(1);
  });

  // ── セクション 5: 異常系・ファイル種別不整合 ────────────────────────────

  it("E5-1: フロントマターのない未初期化ファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis file has no frontmatter.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(1);
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("version:");
  });

  it("E5-2: 存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runBump(filePath, { patch: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("E5-3: サポート外の拡張子 (.png) はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "logo.png": `fake image content`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "logo.png");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("E5-4: バイナリ偽装ファイル (.md) は安全にエラー終了する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    // バイナリ内容（null バイトを含む）を直接書き込む
    const filePath = join(fixture.dir, "fake.md");
    writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]));

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(1);
    // ファイルが破壊されていないこと（バイナリのまま）
    const buf = readFileSync(filePath);
    expect(buf[0]).toBe(0x00);
  });

  // ── セクション 6: 不完全なフロントマター ────────────────────────────────

  it("M6-1: x-st-version-path キーが欠損している場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("M6-2: x-st-version-path が空文字の場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: ""\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { patch: true }, ctx);

    expect(exitCode).toBe(1);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
  });

  it("M6-3: バージョン値が空文字の場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: ""\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("M6-3: バージョン値が null の場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: null\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { major: true }, ctx);

    expect(exitCode).toBe(1);
  });

  it("M6-4: バージョン値が配列の場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: [1, 0, 0]\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runBump(filePath, { minor: true }, ctx);

    expect(exitCode).toBe(1);
  });
});
