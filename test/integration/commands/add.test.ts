import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createGitFixture, addAndCommit, type GitFixture } from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runAdd } from "../../../src/cli/commands/add.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack add", () => {
  it("フロントマターを追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `# PRD\n\nContent here.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runAdd(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-id:");
    expect(content).toContain("version: 0.0.0");
    expect(content).toContain("# PRD");
  });

  it("依存関係を指定して追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runAdd(filePath, { deps: "prd-001:1.0.0" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("x-st-dependencies:");
    expect(content).toContain("id: prd-001");
    expect(content).toContain("version: 1.0.0");
  });

  it("存在しないIDを指定するとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/uc.md": `# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runAdd(filePath, { deps: "nonexistent-001:1.0.0" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runAdd(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("{{context.file.dir}} がサブディレクトリ名に展開される（回帰テスト）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/domain/domain.md": `# Domain\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/domain/domain.md");
    const exitCode = await runAdd(filePath, {}, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    // {{context.file.dir}} は "domain" に展開され、リテラルのままにならない
    expect(content).not.toContain("{{context.file.dir}}");
    expect(content).toMatch(/x-st-id: domain-/);
  });
});
