import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { runInit } from "../../../src/cli/commands/init.js";
import { SPECTRACK_CONFIG_FILE } from "../../../src/config/defaults.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack init", () => {
  it("設定ファイルを作成する", async () => {
    fixture = await createGitFixture({});

    const exitCode = await runInit({}, fixture.dir);

    expect(exitCode).toBe(0);
    expect(existsSync(join(fixture.dir, SPECTRACK_CONFIG_FILE))).toBe(true);
  });

  it("既存の設定ファイルがある場合はスキップ", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const originalContent = readFileSync(
      join(fixture.dir, SPECTRACK_CONFIG_FILE),
      "utf-8",
    );
    const exitCode = await runInit({}, fixture.dir);

    expect(exitCode).toBe(0);
    // ファイルは変更されていない
    const newContent = readFileSync(
      join(fixture.dir, SPECTRACK_CONFIG_FILE),
      "utf-8",
    );
    expect(newContent).toBe(originalContent);
  });

  it("--all でフロントマターを一括追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit({ all: true, yes: true }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id");
  });

  it("ファイル指定でフロントマターを追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
      "doc/api.md": `# API\nThis is an API spec.\n`,
    });

    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    // 指定ファイルにはフロントマターが追加されている
    const prdContent = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(prdContent).toContain("x-st-id");
    // 指定していないファイルは変更されていない
    const apiContent = readFileSync(join(fixture.dir, "doc/api.md"), "utf-8");
    expect(apiContent).not.toContain("x-st-id");
  });

  it("ファイル指定でも設定ファイルがない場合は自動生成する", async () => {
    fixture = await createGitFixture({
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    expect(existsSync(join(fixture.dir, SPECTRACK_CONFIG_FILE))).toBe(true);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id");
  });

  it("既に x-st-id があるファイルはスキップする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const exitCode = await runInit({ all: true, yes: true }, fixture.dir);

    expect(exitCode).toBe(0);
    // ID は変更されていない
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id: prd-001");
  });

  it("--dry-run ではフロントマターを書き込まない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit(
      { all: true, dryRun: true },
      fixture.dir,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    // dry-run なのでフロントマターは追加されていない
    expect(content).not.toContain("x-st-id");
  });

  it("ファイル指定で --dry-run ではフロントマターを書き込まない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runInit(
      { files: [filePath], dryRun: true },
      fixture.dir,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).not.toContain("x-st-id");
  });

  it("--dry-run は設定ファイルを作成しない", async () => {
    fixture = await createGitFixture({
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
      // spectrack.yml は存在しない
    });

    const exitCode = await runInit({ all: true, dryRun: true }, fixture.dir);

    expect(exitCode).toBe(0);
    // --dry-run なので設定ファイルが作成されていない
    expect(existsSync(join(fixture.dir, SPECTRACK_CONFIG_FILE))).toBe(false);
    // フロントマターも追加されていない
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).not.toContain("x-st-id");
  });

  it("存在しないファイルを指定した場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(1);
  });

  it("Git リポジトリでない場合でも設定ファイルを作成できる", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-"));
    try {
      const exitCode = await runInit({}, tmpDir);
      expect(exitCode).toBe(0);
      expect(existsSync(join(tmpDir, SPECTRACK_CONFIG_FILE))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--all で確認プロンプトを拒否するとキャンセルされる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit(
      { all: true },
      fixture.dir,
      async () => false,
    );

    expect(exitCode).toBe(0);
    // キャンセルされたのでフロントマターは追加されていない
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).not.toContain("x-st-id");
  });

  it("--all --yes で確認プロンプトをスキップしてフロントマターを追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit({ all: true, yes: true }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id");
  });

  // ── 2-2: 複数ファイルの初期化 ────────────────────────────────────────────────

  it("2-2: 複数ファイルを同時に指定してフロントマターを付与する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `# A\n`,
      "doc/b.yml": `title: B\n`,
    });

    const exitCode = await runInit(
      { files: [join(fixture.dir, "doc/a.md"), join(fixture.dir, "doc/b.yml")] },
      fixture.dir,
    );

    expect(exitCode).toBe(0);
    expect(readFileSync(join(fixture.dir, "doc/a.md"), "utf-8")).toContain("x-st-id");
    expect(readFileSync(join(fixture.dir, "doc/b.yml"), "utf-8")).toContain("x-st-id");
  });

  // ── 2-4: 空ファイルの初期化 ──────────────────────────────────────────────────

  it("2-4: 空ファイルの先頭にフロントマターを挿入する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/empty.md": ``,
    });

    const filePath = join(fixture.dir, "doc/empty.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
  });

  // ── 2-5: 既存フロントマターの維持 ────────────────────────────────────────────

  it("2-5: 既存フロントマターのコメント・キーを維持して x-st-* を追記する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/exist.md": `---\n# custom comment\ntitle: My Doc\nauthor: Jane\n---\n# Content\n`,
    });

    const filePath = join(fixture.dir, "doc/exist.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
    expect(content).toContain("title: My Doc");
    expect(content).toContain("author: Jane");
    expect(content).toContain("# custom comment");
    expect(content).toContain("# Content");
  });

  it("2-5: .yml ファイルの既存キーを維持して x-st-* を追記する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/api.yml": `info:\n  title: My API\n  version: 3.0.0\n`,
    });

    const filePath = join(fixture.dir, "doc/api.yml");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
    // 既存キーが上書きされていない
    expect(content).toContain("title: My API");
    expect(content).toContain("3.0.0");
  });

  // ── 2-7: 対象外拡張子 ────────────────────────────────────────────────────────

  it("2-7: 対象外拡張子を指定するとエラーになりファイルが変更されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const pngPath = join(fixture.dir, "logo.png");
    writeFileSync(pngPath, "PNG_CONTENT", "utf-8");

    const exitCode = await runInit({ files: [pngPath] }, fixture.dir);

    expect(exitCode).toBe(1);
    expect(readFileSync(pngPath, "utf-8")).toBe("PNG_CONTENT");
  });

  it("2-7: 拡張子なしファイルを指定するとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const noExtPath = join(fixture.dir, "Makefile");
    writeFileSync(noExtPath, "all:\n\techo done\n", "utf-8");

    const exitCode = await runInit({ files: [noExtPath] }, fixture.dir);

    expect(exitCode).toBe(1);
  });

  // ── 2-8: バイナリファイル ─────────────────────────────────────────────────────

  it("2-8: バイナリファイル (.md 偽装) を指定するとエラーになりファイルが破壊されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    // ヌルバイトを含むバイナリデータを .md ファイルとして作成
    const fakeMdPath = join(fixture.dir, "fake.md");
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a, 0x0a]);
    writeFileSync(fakeMdPath, binaryData);

    const exitCode = await runInit({ files: [fakeMdPath] }, fixture.dir);

    expect(exitCode).toBe(1);
    // ファイルはバイナリのまま変更されていない
    const after = readFileSync(fakeMdPath);
    expect(after).toEqual(binaryData);
  });

  // ── 2-9: 不正テキストの偽装ファイル ──────────────────────────────────────────

  it("2-9: YAML として無効なテキストの .yml ファイルはエラーになりファイルが変更されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // タブインデントは YAML 仕様で禁止されており確実にパースエラーになる
      "bad.yml": `key:\n\tindented: value`,
    });

    const filePath = join(fixture.dir, "bad.yml");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(1);
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // ── 3-3: .spectrackignore の適用確認 ─────────────────────────────────────────

  it("3-3: .spectrackignore で除外されたファイルはフロントマターが付与されない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nREADME.md\nnode_modules/\n`,
      "README.md": `# README\n`,
      "doc/spec.md": `# Spec\n`,
    });

    const exitCode = await runInit({ all: true, yes: true }, fixture.dir);

    expect(exitCode).toBe(0);
    // 除外ファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "README.md"), "utf-8")).not.toContain("x-st-id");
    // 非除外ファイルは初期化されている
    expect(readFileSync(join(fixture.dir, "doc/spec.md"), "utf-8")).toContain("x-st-id");
  });

  // ── 3-4: 対象ファイル 0 件時 ─────────────────────────────────────────────────

  it("3-4: 対象ファイルが存在しない場合は確認プロンプトなしで正常終了する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // spectrack.yml を無視して他に対象ファイルなし
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
    });

    // confirmFn が呼ばれないことを確認するためのスパイ
    let promptCalled = false;
    const exitCode = await runInit(
      { all: true },
      fixture.dir,
      async (_count) => {
        promptCalled = true;
        return false;
      },
    );

    expect(exitCode).toBe(0);
    expect(promptCalled).toBe(false);
  });

  // ── 3-5: 混在状態でのカウント精度 ───────────────────────────────────────────

  it("3-5: 確認プロンプトは未初期化ファイルの件数のみカウントする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/init1.md": `---\nx-st-id: init1\nx-st-version-path: version\nversion: 1.0.0\n---\n# Init1\n`,
      "doc/init2.md": `---\nx-st-id: init2\nx-st-version-path: version\nversion: 1.0.0\n---\n# Init2\n`,
      "doc/new1.md": `# New 1\n`,
      "doc/new2.md": `# New 2\n`,
      "doc/new3.md": `# New 3\n`,
    });

    let capturedCount = -1;
    const exitCode = await runInit(
      { all: true },
      fixture.dir,
      async (count) => {
        capturedCount = count;
        return true;
      },
    );

    expect(exitCode).toBe(0);
    // 未初期化は 3 件のみ
    expect(capturedCount).toBe(3);
    // 初期化済みファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "doc/init1.md"), "utf-8")).toContain("x-st-id: init1");
    // 未初期化ファイルは初期化されている
    expect(readFileSync(join(fixture.dir, "doc/new1.md"), "utf-8")).toContain("x-st-id");
  });

  // ── 3-6: 全て初期化済み ──────────────────────────────────────────────────────

  it("3-6: 全ファイルが初期化済みの場合は確認プロンプトなしで正常終了する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/already.md": `---\nx-st-id: already-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Already\n`,
    });

    let promptCalled = false;
    const exitCode = await runInit(
      { all: true },
      fixture.dir,
      async (_count) => {
        promptCalled = true;
        return false;
      },
    );

    expect(exitCode).toBe(0);
    expect(promptCalled).toBe(false);
    // ファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "doc/already.md"), "utf-8")).toContain("x-st-id: already-001");
  });

  // ── 4-2: --yes を --all なしで指定するとエラー ───────────────────────────────

  it("4-2: ファイル指定に --yes を使うとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `# A\n`,
    });

    const exitCode = await runInit(
      { files: [join(fixture.dir, "doc/a.md")], yes: true },
      fixture.dir,
    );

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "doc/a.md"), "utf-8")).not.toContain("x-st-id");
  });

  it("4-2: --yes を --all なしで指定するとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const exitCode = await runInit({ yes: true }, fixture.dir);

    expect(exitCode).toBe(1);
  });

  // ── 5-3: 混在状態での一括 Dry-Run ───────────────────────────────────────────

  it("5-3: 混在状態の --all --dry-run は初期化済みファイルを変更しない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/initialized.md": `---\nx-st-id: existing-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Init\n`,
      "doc/new.md": `# New\n`,
    });

    const exitCode = await runInit({ all: true, dryRun: true }, fixture.dir);

    expect(exitCode).toBe(0);
    // 初期化済みファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "doc/initialized.md"), "utf-8"))
      .toContain("x-st-id: existing-001");
    // 未初期化ファイルも dry-run なので変更されていない
    expect(readFileSync(join(fixture.dir, "doc/new.md"), "utf-8")).not.toContain("x-st-id");
  });

  // ── B-1: ルート直下ファイルの初期化 ─────────────────────────────────────────

  it("B-1: プロジェクトルート直下のファイルを初期化できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "root.md": `# Root Level Doc\n`,
    });

    const filePath = join(fixture.dir, "root.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
    // YAML として有効な内容であること（パース可能）
    const { parse } = await import("yaml");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(fmMatch).not.toBeNull();
    expect(() => parse(fmMatch![1])).not.toThrow();
  });

  // ── B-2: 特殊文字・スペースを含むパス ────────────────────────────────────────

  it("B-2: スペースやマルチバイト文字を含むパスのファイルを初期化できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "docs/要件 定義.md": `# 要件定義\n`,
    });

    const filePath = join(fixture.dir, "docs/要件 定義.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
    // フロントマターが YAML として有効であること
    const { parse } = await import("yaml");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(fmMatch).not.toBeNull();
    expect(() => parse(fmMatch![1])).not.toThrow();
  });

  // ── T-1: カスタム設定テンプレートの適用 ─────────────────────────────────────

  it("T-1: カスタム frontMatterTemplate が適用される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": [
        `frontMatterKeyPrefix: x-st-`,
        `frontMatterTemplate:`,
        `  md:`,
        `    x-st-id: "custom-{{nanoid}}"`,
        `    x-st-version-path: "spec.version"`,
        `    x-st-custom: "my-value"`,
        `    spec:`,
        `      version: "2.0.0"`,
      ].join("\n") + "\n",
      "doc/spec.md": `# Spec\n`,
    });

    const filePath = join(fixture.dir, "doc/spec.md");
    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id");
    expect(content).toContain("x-st-custom: my-value");
    expect(content).toContain("x-st-version-path: spec.version");
    // カスタムバージョンフィールドが含まれている
    expect(content).toContain("2.0.0");
  });

  // ── T-2: 拡張子の大文字小文字を許容 ─────────────────────────────────────────

  it("T-2: 大文字の拡張子 (.MD, .YAML) を --all で対象として認識する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/a.MD": `# A\n`,
      "doc/b.YAML": `title: B\n`,
    });

    const exitCode = await runInit({ all: true, yes: true }, fixture.dir);

    expect(exitCode).toBe(0);
    expect(readFileSync(join(fixture.dir, "doc/a.MD"), "utf-8")).toContain("x-st-id");
    expect(readFileSync(join(fixture.dir, "doc/b.YAML"), "utf-8")).toContain("x-st-id");
  });

  // ── T-3: 読み取り専用ファイル ────────────────────────────────────────────────

  it("T-3: 読み取り専用ファイルへの書き込み失敗は安全にエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/readonly.md": `# Readonly\n`,
    });

    const filePath = join(fixture.dir, "doc/readonly.md");
    chmodSync(filePath, 0o444); // 読み取り専用

    const exitCode = await runInit({ files: [filePath] }, fixture.dir);

    // 権限エラーで失敗
    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    chmodSync(filePath, 0o644); // クリーンアップのために戻す
    expect(readFileSync(filePath, "utf-8")).toBe("# Readonly\n");
  });

  // ── C-1: 競合する引数 ────────────────────────────────────────────────────────

  it("C-1: <file> 指定と --all を同時に指定するとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `# A\n`,
    });

    const filePath = join(fixture.dir, "doc/a.md");
    const exitCode = await runInit(
      { files: [filePath], all: true },
      fixture.dir,
    );

    expect(exitCode).toBe(1);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).not.toContain("x-st-id");
  });

  // ── C-2: --dry-run と -y の組み合わせ ────────────────────────────────────────

  it("C-2: --all --yes --dry-run は確認プロンプトなしで差分のみ表示しファイルを変更しない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      ".spectrackignore": `spectrack.yml\nnode_modules/\n`,
      "doc/a.md": `# A\n`,
    });

    let promptCalled = false;
    const exitCode = await runInit(
      { all: true, yes: true, dryRun: true },
      fixture.dir,
      async (_count) => {
        promptCalled = true;
        return false;
      },
    );

    expect(exitCode).toBe(0);
    expect(promptCalled).toBe(false);
    // dry-run なのでファイルは変更されていない
    expect(readFileSync(join(fixture.dir, "doc/a.md"), "utf-8")).not.toContain("x-st-id");
  });
});
