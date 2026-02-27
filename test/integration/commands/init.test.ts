import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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

    const exitCode = await runInit({ addFrontmatter: false }, fixture.dir);

    expect(exitCode).toBe(0);
    expect(existsSync(join(fixture.dir, SPECTRACK_CONFIG_FILE))).toBe(true);
  });

  it("既存の設定ファイルがある場合はスキップ", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const originalContent = readFileSync(
      join(fixture.dir, SPECTRACK_CONFIG_FILE),
      "utf-8",
    );
    const exitCode = await runInit({ addFrontmatter: false }, fixture.dir);

    expect(exitCode).toBe(0);
    // ファイルは変更されていない
    const newContent = readFileSync(
      join(fixture.dir, SPECTRACK_CONFIG_FILE),
      "utf-8",
    );
    expect(newContent).toBe(originalContent);
  });

  it("--add-frontmatter でフロントマターを追加する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit({ addFrontmatter: true }, fixture.dir);

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id");
  });

  it("既に x-st-id があるファイルはスキップする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const exitCode = await runInit({ addFrontmatter: true }, fixture.dir);

    expect(exitCode).toBe(0);
    // ID は変更されていない
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    expect(content).toContain("x-st-id: prd-001");
  });

  it("--dry-run ではフロントマターを書き込まない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `# PRD\nThis is a product requirements document.\n`,
    });

    const exitCode = await runInit(
      { addFrontmatter: true, dryRun: true },
      fixture.dir,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(join(fixture.dir, "doc/prd.md"), "utf-8");
    // dry-run なのでフロントマターは追加されていない
    expect(content).not.toContain("x-st-id");
  });

  it("Git リポジトリでない場合でも設定ファイルを作成できる", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const tmpDir = mkdtempSync(join(tmpdir(), "spectrack-no-git-"));
    try {
      const exitCode = await runInit({ addFrontmatter: false }, tmpDir);
      expect(exitCode).toBe(0);
      expect(existsSync(join(tmpDir, SPECTRACK_CONFIG_FILE))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
