import { describe, it, expect, afterEach } from "vitest";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runVerify } from "../../../src/cli/commands/verify.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack verify", () => {
  it("問題なければ EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("循環依存がある場合は EXIT_CODE=2（警告）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  it("--allow-cycles で循環依存を許容する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({ allowCycles: true }, ctx);
    expect(exitCode).toBe(0);
  });

  it("存在しない依存先参照はエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent-id\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("x-st-id がないドキュメントがある場合は EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("バージョン形式が不正（SemVer違反）の場合は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: not-a-semver\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });

  it("プレリリースに英字を含むバージョンは EXIT_CODE=1", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0-alpha\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(1);
  });

  it("ドキュメントが0件の場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("依存関係なしのドキュメントのみの場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nversion: 2.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(0);
  });

  it("循環依存とバージョン警告が同時発生した場合は EXIT_CODE=2", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-b\n    version: 1.0.0\nversion: not-semver\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nx-st-dependencies:\n  - id: doc-a\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runVerify({}, ctx);
    expect(exitCode).toBe(2);
  });
});
