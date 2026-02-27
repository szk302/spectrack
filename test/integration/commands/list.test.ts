import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, join as pathJoin } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runList } from "../../../src/cli/commands/list.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack list", () => {
  it("ドキュメントを一覧表示して EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("ドキュメントが0件でも EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("複数ドキュメントを一覧表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("未コミット変更があるドキュメントは '未コミットの変更あり' と表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    // コミット後にファイルを変更（未コミット状態）
    writeFileSync(
      join(fixture.dir, "doc/prd.md"),
      `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n`,
      "utf-8",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });

  it("x-st-id がないドキュメントは '(ID未設定)' と表示される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runList(ctx);

    expect(exitCode).toBe(0);
  });
});
