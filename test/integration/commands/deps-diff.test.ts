import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runDepsDiff } from "../../../src/cli/commands/deps-diff.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack deps-diff", () => {
  it("依存先が更新されている場合は差分を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal content.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nOriginal content.\nNew feature added.\n`,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const ctx = await initCommandContext(fixture.dir, false);
      const filePath = join(fixture.dir, "doc/uc.md");
      const exitCode = await runDepsDiff(filePath, {}, ctx);

      expect(exitCode).toBe(0);

      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("prd-001");
      expect(output).toContain("1.0.0");
      expect(output).toContain("1.1.0");
      expect(output).toContain("━");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("依存先が同じバージョンの場合はスキップする", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存関係がないドキュメントはメッセージを表示して成功する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("ファイルが存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("x-st-id がないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存先が IDレジストリに存在しない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: ghost-999\n    path: doc/ghost.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("参照バージョンのコミットが見つからない場合はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 9.9.9\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("複数の依存先がある場合は更新ありのものだけ差分を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/api.md": `---\nx-st-id: api-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# API\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\n  - id: api-001\n    path: doc/api.md\n    version: 2.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nUpdated.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("--full オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nLine1.\nLine2.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nLine1.\nLine2.\nLine3 added.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, { full: true }, ctx);

    expect(exitCode).toBe(0);
  });

  it("--context=1 オプションで差分を表示できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\nOriginal.\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    path: doc/prd.md\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    await addAndCommit(fixture, {
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\nOriginal.\nAdded line.\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runDepsDiff(filePath, { context: 1 }, ctx);

    expect(exitCode).toBe(0);
  });
});
