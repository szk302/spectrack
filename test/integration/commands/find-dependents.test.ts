import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runFindDependents } from "../../../src/cli/commands/find-dependents.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack find-dependents", () => {
  it("依存されているドキュメントを表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runFindDependents(filePath, ctx);
    expect(exitCode).toBe(0);
  });

  it("依存されていないドキュメントの場合は通知", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runFindDependents(filePath, ctx);
    expect(exitCode).toBe(0);
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runFindDependents(filePath, ctx);
    expect(exitCode).toBe(1);
  });

  it("x-st-id が未設定のファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/no-id.md": `# No ID\nThis file has no ID.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/no-id.md");
    const exitCode = await runFindDependents(filePath, ctx);
    expect(exitCode).toBe(1);
  });
});
