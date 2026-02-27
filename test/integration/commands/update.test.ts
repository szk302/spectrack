import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runUpdate } from "../../../src/cli/commands/update.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack update", () => {
  it("バージョンを更新する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runUpdate(filePath, { version: "1.1.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.1.0");
  });

  it("依存関係を追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 0.1.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { addDeps: "prd-001:1.0.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
  });

  it("依存関係を削除する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 0.1.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { removeDeps: "prd-001" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    // 依存関係が空配列になっている
    expect(content).toContain("x-st-dependencies: []");
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runUpdate(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("存在しないIDの依存追加はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 0.1.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { addDeps: "nonexistent:1.0.0" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("バージョンと依存追加を同時に行う", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 0.1.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(
      filePath,
      { version: "1.0.0", addDeps: "prd-001:1.0.0" },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
    expect(content).toContain("prd-001");
  });

  it("--add-deps でコロンなし（コミット済みバージョンを自動取得）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 0.1.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { addDeps: "prd-001" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("2.0.0");
  });

  it("--upgrade-deps で依存バージョンを最新に更新する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 0.1.0\n---\n# UC\n`,
    });

    await addAndCommit(
      fixture,
      { "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD v2\n` },
      "feat: major bump",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { upgradeDeps: true }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("prd-001");
    expect(content).toContain("2.0.0");
  });

  it("バージョンフィールドがないドキュメントにバージョンを設定する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies: []\n---\n# UC (no version)\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUpdate(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("version: 1.0.0");
  });

  it("ネストされたバージョンパスを更新する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\nx-st-dependencies: []\ninfo:\n  version: 1.0.0\n  title: API\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/api.yml");
    const exitCode = await runUpdate(filePath, { version: "2.0.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("2.0.0");
  });
});
