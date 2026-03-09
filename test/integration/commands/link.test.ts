import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runLink } from "../../../src/cli/commands/link.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack link", () => {
  it("依存先バージョンを自動取得してリンクする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("1.0.0");
  });

  it("バージョン明示指定でリンクする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md:1.5.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("1.5.0");
  });

  it("既存の依存関係にマージ（重複 ID は上書き）する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md:2.0.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    // 旧バージョン (1.0.0) が新バージョン (2.0.0) で上書きされている
    expect(content).toContain("2.0.0");
  });

  it("依存先ファイルが存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/nonexistent.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("リンク元ファイルが存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("--dry-run では実際の書き込みを行わない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(
      filePath,
      { deps: "doc/prd.md", dryRun: true },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe(originalContent);
  });

  it("フロントマターがないファイルへの link はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `# UC\n`, // フロントマターなし
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("x-st-id");
  });

  it("複数の依存先をカンマ区切りで指定してリンクする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(
      filePath,
      { deps: "doc/prd.md,doc/api.md" },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("api-001");
  });

  it("リンク後に path ヒントが書き込まれる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    // path ヒントが依存先ファイルの相対パスで書き込まれている
    expect(content).toContain("path: doc/prd.md");
  });

  it("x-st-id がない依存先はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  // E1-2: 依存先ファイルが未初期化（フロントマターなし）
  it("フロントマターがない依存先はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\n`, // フロントマターなし
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
    // 対象ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // M1-2: 依存元の x-st-id が空・欠損
  it("依存元に x-st-id がない場合はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`, // x-st-id なし
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  // I1-1: 既存の依存先を再リンク（同バージョン → ファイル変更なし）
  it("同バージョンで再リンクしてもファイルが変更されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md:1.0.0" }, ctx);

    expect(exitCode).toBe(0);
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // I1-3: 新規と既存が混在するリンク
  it("既存と新規が混在してもエラーにならず新規のみ追加される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(
      filePath,
      { deps: "doc/prd.md,doc/api.md" },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("api-001");
  });

  // B1-3: 自己参照の防止
  it("自分自身への依存はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "doc/uc.md" }, ctx);

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // M1-4: 依存先のバージョン情報欠損（x-st-version-path は指定されているがキーなし）
  it("依存先に x-st-version-path で指定されたキーがない場合はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\n---\n# PRD\n`, // version キーなし
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  // L1-3完全版: 複数依存の同時追加（自動バージョン + バージョン明示の混在）
  it("複数依存を自動バージョンとバージョン指定の混在でリンクする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(
      filePath,
      { deps: "doc/prd.md,doc/api.md:1.5.0" }, // prd は自動、api は明示
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("1.0.0"); // prd の自動取得バージョン
    expect(content).toContain("api-001");
    expect(content).toContain("1.5.0"); // api の明示バージョン
  });

  // D1-2: 混在状態の Dry-Run（既存依存 + 新規依存）
  it("混在状態の dry-run では新規依存のみが表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(
      filePath,
      { deps: "doc/prd.md,doc/api.md", dryRun: true },
      ctx,
    );

    expect(exitCode).toBe(0);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // F1-1: 対象外拡張子の指定（依存元）
  it("対象外拡張子のファイルをリンク元に指定するとエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "logo.png": `fake binary content`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "logo.png");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
  });

  // F1-2: 対象外拡張子の指定（依存先）
  it("対象外拡張子のファイルを依存先に指定するとエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "logo.png": `fake binary content`,
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "logo.png" }, ctx);

    expect(exitCode).toBe(1);
    // 対象ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // M1-6: x-st-dependencies が配列以外の型
  it("x-st-dependencies が配列でない場合はエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-dependencies: "invalid string"\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // B1-1: 絶対パスで依存先を指定しても正しく解決される
  it("絶対パスで依存先を指定してもリンクできる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const absDepPath = join(fixture.dir, "doc/prd.md"); // 絶対パスで指定
    const exitCode = await runLink(filePath, { deps: absDepPath }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("1.0.0");
  });

  // B1-2: サブディレクトリを起点とした相対パス解決
  it("サブディレクトリを cwd として起動した場合でも相対パスが正しく解決される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "docs/domain/b.md": `---\nx-st-id: b-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# B\n`,
      "docs/prd/a.md": `---\nx-st-id: a-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# A\n`,
    });

    // カレントディレクトリが docs/prd/ として実行（../domain/b.md を指定）
    const subdirCwd = join(fixture.dir, "docs", "prd");
    const ctx = await initCommandContext(subdirCwd, false);
    const filePath = join(subdirCwd, "a.md");
    const exitCode = await runLink(filePath, { deps: "../domain/b.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("b-001");
    expect(content).toContain("1.0.0");
  });

  // B1-4: マルチバイト・スペースを含むパスの解決
  it("マルチバイト文字やスペースを含むパスでもリンクできる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "docs/要件 定義.md": `---\nx-st-id: req-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# 要件定義\n`,
      "docs/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "docs/uc.md");
    const exitCode = await runLink(filePath, { deps: "docs/要件 定義.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("req-001");
  });

  // B1-5: YAMLコメントとインデントが維持される
  it("リンク後にYAMLコメントが維持される", async () => {
    const prdContent = `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`;
    const ucContentWithComment = `---\n# このファイルは重要なUCです\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`;

    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": prdContent,
      "doc/uc.md": ucContentWithComment,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runLink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    // コメントが維持されていること
    expect(content).toContain("# このファイルは重要なUCです");
    // 依存関係も正しく追加されていること
    expect(content).toContain("prd-001");
  });

  // F1-3: バイナリ偽装ファイル（依存元）
  it("不正なYAMLを持つファイルをリンク元にした場合は安全にエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    // 拡張子は .md だが不正な YAML を持つファイルを直接作成
    const fakeSource = join(fixture.dir, "fake.md");
    writeFileSync(fakeSource, "---\nbad: [unclosed\n---\n# content\n", "utf-8");

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runLink(fakeSource, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    expect(readFileSync(fakeSource, "utf-8")).toBe("---\nbad: [unclosed\n---\n# content\n");
  });

  // F1-4: バイナリ偽装ファイル（依存先）
  it("不正なYAMLを持つファイルを依存先にした場合は安全にエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\n---\n# UC\n`,
    });

    // 拡張子は .md だが不正な YAML を持つ依存先ファイルを直接作成
    const fakeDep = join(fixture.dir, "fake.md");
    writeFileSync(fakeDep, "---\nbad: [unclosed\n---\n# content\n", "utf-8");

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runLink(filePath, { deps: "fake.md" }, ctx);

    expect(exitCode).toBe(1);
    // 対象ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });
});
