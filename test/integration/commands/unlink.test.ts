import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runUnlink } from "../../../src/cli/commands/unlink.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack unlink", () => {
  it("ファイルパスで依存関係を解除する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUnlink(filePath, { deps: "doc/prd.md" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("prd-001");
  });

  it("ID で依存関係を解除する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUnlink(filePath, { deps: "prd-001" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("prd-001");
  });

  it("複数の依存関係を一括解除する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\n  - id: api-001\n    version: 2.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUnlink(filePath, { deps: "prd-001,api-001" }, ctx);

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).not.toContain("prd-001");
    expect(content).not.toContain("api-001");
  });

  it("存在しないファイルはエラー", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/nonexistent.md");
    const exitCode = await runUnlink(filePath, { deps: "prd-001" }, ctx);

    expect(exitCode).toBe(1);
  });

  it("--dry-run では実際の書き込みを行わない", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runUnlink(
      filePath,
      { deps: "doc/prd.md", dryRun: true },
      ctx,
    );

    expect(exitCode).toBe(0);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe(originalContent);
  });

  it("該当する依存関係がない場合は成功", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const exitCode = await runUnlink(filePath, { deps: "nonexistent-id" }, ctx);

    expect(exitCode).toBe(0);
  });

  // M1-5: unlink 時の x-st-dependencies 欠損（null / キーなし）
  it("x-st-dependencies が存在しない場合でも安全に成功する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# UC\n`, // x-st-dependencies キーなし
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runUnlink(filePath, { deps: "prd-001" }, ctx);

    expect(exitCode).toBe(0);
    // ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });

  // F1-5: unlink 時の対象外拡張子の依存先指定
  it("対象外拡張子のファイルを依存解除対象に指定するとエラーになる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "logo.png": `fake binary content`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const filePath = join(fixture.dir, "doc/uc.md");
    const originalContent = readFileSync(filePath, "utf-8");
    const exitCode = await runUnlink(filePath, { deps: "logo.png" }, ctx);

    expect(exitCode).toBe(1);
    // 対象ファイルは変更されていない
    expect(readFileSync(filePath, "utf-8")).toBe(originalContent);
  });
});
