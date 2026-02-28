import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runGraph } from "../../../src/cli/commands/graph.js";

let fixture: GitFixture | null = null;
let stdoutOutput = "";

beforeEach(() => {
  stdoutOutput = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdoutOutput += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack graph", () => {
  it("mermaid フォーマット（デフォルト）で EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({}, ctx);

    expect(exitCode).toBe(0);
    expect(stdoutOutput).toContain("graph TD");
  });

  it("dot フォーマットで EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({ format: "dot" }, ctx);

    expect(exitCode).toBe(0);
    expect(stdoutOutput).toContain("digraph");
  });

  it("json フォーマットで有効なJSONを出力する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({ format: "json" }, ctx);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed).toHaveProperty("nodes");
    expect(parsed).toHaveProperty("edges");
  });

  it("依存関係があるドキュメントのエッジが出力される", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({ format: "json" }, ctx);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.edges.length).toBeGreaterThan(0);
  });

  it("ドキュメントが0件でも EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存関係なしのドキュメントのみの場合はエッジなし", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/a.md": `---\nx-st-id: doc-a\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
      "doc/b.md": `---\nx-st-id: doc-b\nx-st-version-path: version\nversion: 1.0.0\n---\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runGraph({ format: "json" }, ctx);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.nodes.length).toBe(2);
    expect(parsed.edges.length).toBe(0);
  });
});
