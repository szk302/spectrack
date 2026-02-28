import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runStatus } from "../../../src/cli/commands/status.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack status", () => {
  it("全ドキュメント: 依存先が最新の場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存先が更新されていたら EXIT_CODE=2（警告）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は 2.0.0、uc は prd-001@1.0.0 を参照
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 2.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(2);
  });

  it("特定ファイルを対象に自身の依存状況を確認する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存関係のあるドキュメントがない場合は SUCCESS", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("x-st-id がないファイルを対象にするとエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("依存されている側のファイルを指定すると依存元の状況を表示する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は依存されている側（自身に deps なし）
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      // uc は prd に依存している
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    // prd.md（依存される側）を指定 → uc.md（依存元）の依存状況が表示される
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runStatus(filePath, {}, ctx);

    // uc.md の prd-001 依存は最新なので SUCCESS
    expect(exitCode).toBe(0);
  });

  it("存在しない依存先参照は EXIT_CODE=1（エラー）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runStatus(undefined, {}, ctx);

    expect(exitCode).toBe(1);
  });

  it("--strict フラグでパッチ更新も検出する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      // prd は 1.0.1（パッチ更新）、uc は 1.0.0 を参照
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.1\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    // strict なしではパッチ更新は無視 → SUCCESS
    const exitCodeNormal = await runStatus(undefined, {}, ctx);
    expect(exitCodeNormal).toBe(0);

    // strict ありではパッチ更新も検出 → WARNING
    const exitCodeStrict = await runStatus(undefined, { strict: true }, ctx);
    expect(exitCodeStrict).toBe(2);
  });
});
