import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runDiff } from "../../../src/cli/commands/diff.js";

let fixture: GitFixture | null = null;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack diff", () => {
  it("指定バージョンとの差分を表示して EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n\nInitial content.\n`,
    });

    // バージョンを 1.1.0 に更新してコミット
    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD\n\nUpdated content.\n`,
      },
      "feat: bump prd to 1.1.0",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(0);
  });

  it("存在しないバージョンを指定すると EXIT_CODE=1（エラー）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "9.9.9" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("存在しないファイルを指定すると EXIT_CODE=1（エラー）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("複数バージョンのコミット履歴から正しいバージョンを特定する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD v1\n`,
    });

    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD v1.1\n`,
      },
      "feat: bump to 1.1.0",
    );

    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD v2\n`,
      },
      "feat: bump to 2.0.0",
    );

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");

    // 中間バージョン 1.1.0 との差分も取得できる
    const exitCode = await runDiff(filePath, { version: "1.1.0" }, ctx);
    expect(exitCode).toBe(0);
  });

  it("存在しないバージョン指定時にGit履歴の利用可能バージョンをヒント表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 0.0.2\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runDiff(filePath, { version: "0.0.1" }, ctx);

    expect(exitCode).toBe(1);
    // 利用可能なバージョンがヒントとして表示されること
    const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map((args) => args.join(" "))
      .join("\n");
    expect(errorCalls).toContain("0.0.2");
    expect(errorCalls).toContain("💡");
  });

  it("現在のバージョンと同じバージョンを指定してもエラーにならない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");

    // 現在のバージョンと同じ 1.0.0 を指定（差分なし）
    const exitCode = await runDiff(filePath, { version: "1.0.0" }, ctx);
    expect(exitCode).toBe(0);
  });
});
