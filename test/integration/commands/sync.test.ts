import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runSync } from "../../../src/cli/commands/sync.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack sync", () => {
  // S1-1: バージョンの同期（単一）
  it("依存先バージョンを最新に同期する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("2.0.0");
  });

  // S1-2: バージョンの同期（複数）
  it("複数の依存先を一括で同期する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.1.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("1.1.0");
    expect(content).toContain("2.1.0");
  });

  // S1-3: ファイル移動（リネーム）への追従と path ヒント更新
  it("ファイル移動後に path ヒントが新パスに更新される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // ファイルを別パスへ移動（同一 ID のまま）
    mkdirSync(join(fixture.dir, "doc/domain"), { recursive: true });
    writeFileSync(
      join(fixture.dir, "doc/domain/prd-renamed.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "utf-8",
    );
    unlinkSync(join(fixture.dir, "doc/prd.md"));

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("doc/domain/prd-renamed.md");
    expect(content).not.toContain("doc/prd.md");
  });

  // S1-4: AST（コメント・インデント）の維持
  it("同期後も YAML コメントが保持される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0 # PRD への依存\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("# PRD への依存");
    expect(content).toContain("2.0.0");
  });

  // O2-1: パス指定での個別同期
  it("--only でファイルパスを指定して同期する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 3.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, { only: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("2.0.0");
    expect(content).not.toContain("3.0.0");
  });

  // O2-2: ID 指定での個別同期
  it("--only で特定の依存先 ID のみ同期する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 3.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, { only: "prd-001" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("2.0.0");
    expect(content).not.toContain("3.0.0");
  });

  // O2-3: 複数指定での個別同期（パスと ID 混在）
  it("--only にパスと ID をカンマ区切りで混在指定できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 3.0.0\n---\n# API\n`,
      "doc/spec.md": `---\nx-st-id: spec-001\nx-st-version-path: version\nversion: 4.0.0\n---\n# Spec\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\n  - id: spec-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    // パスと ID を混在指定
    const exitCode = await runSync(
      filePath,
      { only: "doc/prd.md,api-001" },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("2.0.0"); // prd-001 更新済み
    expect(content).toContain("3.0.0"); // api-001 更新済み
    expect(content).not.toContain("4.0.0"); // spec-001 は未更新
  });

  // O2-4: 存在しない・依存していないファイルの指定
  it("--only で依存していないファイルを指定すると警告して正常終了", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runSync(filePath, { only: "doc/nonexistent.md" }, ctx);

    expect(exitCode).toBe(0);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // I3-1: 変更がない場合の同期
  it("変更がない場合はファイルを書き換えない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // I3-2: 依存先がない場合（空リスト）
  it("依存関係がない場合は SUCCESS", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // I3-3: バージョンダウングレードへの追従
  it("依存先バージョンが下がっている場合も同期する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.5.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("1.5.0");
    expect(content).not.toContain("2.0.0");
  });

  // E4-1: 対象ファイルが未初期化
  it("フロントマターがないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `# UC（フロントマターなし）\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // E4-2: 依存先ファイルが削除済み（Git 履歴あり）
  it("依存先が削除されていて Git 履歴がある場合はエラー（パス推定付き）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // prd.md を削除してコミット
    unlinkSync(join(fixture.dir, "doc/prd.md"));
    await fixture.git.add(["-A"]);
    await fixture.git.commit("delete prd.md");

    // prd-001 が idRegistry にない状態でコンテキスト構築
    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // E4-3: 依存先ファイルが Git 履歴にもない
  it("依存先が Git 履歴にもない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: ghost-999\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // M5-1: x-st-dependencies キー欠損
  it("x-st-dependencies キーが欠損していても安全に終了", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  // M5-2: 依存先フロントマターのバージョン欠損
  it("依存先にバージョン情報がない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\n---\n# PRD（バージョンなし）\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // M5-3: 依存リスト内の不正な要素（文字列）
  it("依存リストに文字列要素が含まれる場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - prd-001\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // F6-1: 対象ファイルがバイナリ
  it("対象ファイルがバイナリの場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    // バイナリファイルを作成
    const filePath = join(fixture.dir, "fake.md");
    writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]));

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // F6-2: 依存先ファイルがバイナリ化
  it("依存先ファイルがバイナリ化されている場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // コンテキスト構築後に依存先をバイナリに上書き（idRegistry には残る）
    const ctx = await initCommandContext(fixture.dir, false);
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      "---\nunclosed: [\n---\ncontent\n",
      "utf-8",
    );

    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // D7-1: 通常の同期の Dry-Run
  it("--dry-run では実際の書き込みを行わない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runSync(filePath, { dryRun: true }, ctx);

    expect(exitCode).toBe(0);
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // D7-2: --only との組み合わせ Dry-Run
  it("--only と --dry-run を組み合わせると指定外は変更されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 3.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runSync(
      filePath,
      { only: "doc/prd.md", dryRun: true },
      ctx,
    );

    expect(exitCode).toBe(0);
    // dry-run なのでファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // 存在しないファイルはエラー
  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  // path ヒントが更新される（バージョン変化あり）
  it("同期後に path ヒントが更新される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("path: doc/prd.md");
  });

  // すでに最新のとき dry-run でも SUCCESS
  it("すでに最新のとき dry-run でも SUCCESS", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runSync(filePath, { dryRun: true }, ctx);

    expect(exitCode).toBe(0);
  });
});
