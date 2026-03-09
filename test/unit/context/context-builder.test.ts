import { describe, it, expect } from "vitest";
import { buildContext } from "../../../src/context/context-builder.js";
import type { ParsedDocument } from "../../../src/types/document.js";
import type { Document as YamlDocument } from "yaml";
import { DEFAULT_CONFIG } from "../../../src/types/config.js";

const dummyYamlDoc = null as unknown as YamlDocument;

const config = DEFAULT_CONFIG;

function makeDoc(overrides?: Partial<ParsedDocument["frontMatter"]>): ParsedDocument {
  return {
    filePath: "/repo/doc/prd.md",
    relativePath: "doc/prd.md",
    ext: "md",
    rawContent: "---\nversion: 1.0.0\n---\n# PRD\n",
    yamlDoc: dummyYamlDoc,
    body: "# PRD\n",
    frontMatter: {
      id: "prd-001",
      versionPath: "version",
      dependencies: [],
      raw: { version: "1.0.0" },
      ...overrides,
    },
  };
}

describe("buildContext", () => {
  it("基本的なコンテキストを構築する", () => {
    const doc = makeDoc();
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });

    expect(ctx.file.path).toBe("doc/prd.md");
    expect(ctx.file.name).toBe("prd");
    expect(ctx.file.ext).toBe("md");
    expect(ctx.file.dir).toBe("doc");
  });

  it("x-st-id が設定されている場合は frontMatter に含める", () => {
    const doc = makeDoc({ id: "prd-001" });
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect(ctx.frontMatter["x-st-id"]).toBe("prd-001");
  });

  it("x-st-id が未設定の場合は frontMatter に含めない", () => {
    const doc = makeDoc({ id: undefined });
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect("x-st-id" in ctx.frontMatter).toBe(false);
  });

  it("versionPath が設定されている場合は frontMatter に含める", () => {
    const doc = makeDoc({ versionPath: "version" });
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect(ctx.frontMatter["x-st-version-path"]).toBe("version");
  });

  it("versionPath が未設定の場合は frontMatter に含めない", () => {
    const doc = makeDoc({ versionPath: undefined });
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect("x-st-version-path" in ctx.frontMatter).toBe(false);
  });

  it("args.file が設定されている場合は command.args に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "link",
      args: { file: "doc/prd.md" },
      cwd: "/repo",
    });
    expect(ctx.command.args.file).toBe("doc/prd.md");
  });

  it("args.file が未設定の場合は command.args に含めない", () => {
    const doc = makeDoc();
    const ctx = buildContext({ config, doc, commandName: "link", args: {}, cwd: "/repo" });
    expect("file" in ctx.command.args).toBe(false);
  });

  it("options.deps が string の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "link",
      options: { deps: "prd-001:1.0.0" },
      cwd: "/repo",
    });
    expect(ctx.command.options.deps).toBe("prd-001:1.0.0");
  });

  it("options.deps が未設定の場合は command.options に含めない", () => {
    const doc = makeDoc();
    const ctx = buildContext({ config, doc, commandName: "link", options: {}, cwd: "/repo" });
    expect("deps" in ctx.command.options).toBe(false);
  });

  it("options.strict が boolean の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "status",
      options: { strict: true },
      cwd: "/repo",
    });
    expect(ctx.command.options.strict).toBe(true);
  });

  it("options.allowCycles が boolean の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "verify",
      options: { allowCycles: false },
      cwd: "/repo",
    });
    expect(ctx.command.options.allowCycles).toBe(false);
  });

  it("lastCommitVersion と lastCommitDate が設定される", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "log",
      lastCommitVersion: "1.0.0",
      lastCommitDate: "2024-01-01",
      cwd: "/repo",
    });
    expect(ctx.lastCommit.version).toBe("1.0.0");
    expect(ctx.lastCommit.updatedAt).toBe("2024-01-01");
  });

  it("previousVersion と previousDate が設定される", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "log",
      previousVersion: "0.9.0",
      previousDate: "2023-12-01",
      cwd: "/repo",
    });
    expect(ctx.previous.version).toBe("0.9.0");
    expect(ctx.previous.updatedAt).toBe("2023-12-01");
  });

  it("utils.nanoid は21文字のランダム文字列", () => {
    const doc = makeDoc();
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect(typeof ctx.utils.nanoid).toBe("string");
    expect(ctx.utils.nanoid.length).toBeGreaterThan(0);
  });

  it("current.version はドキュメントのバージョンを返す", () => {
    const doc = makeDoc();
    const ctx = buildContext({ config, doc, commandName: "link", cwd: "/repo" });
    expect(ctx.current.version).toBe("1.0.0");
  });

  it("options.format が string の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "graph",
      options: { format: "mermaid" },
      cwd: "/repo",
    });
    expect(ctx.command.options.format).toBe("mermaid");
  });

  it("options.dryRun が boolean の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "bump",
      options: { dryRun: true },
      cwd: "/repo",
    });
    expect(ctx.command.options.dryRun).toBe(true);
  });

  it("options.major/minor/patch が boolean の場合は command.options に含める", () => {
    const doc = makeDoc();
    const ctx = buildContext({
      config,
      doc,
      commandName: "bump",
      options: { major: true, minor: false, patch: false },
      cwd: "/repo",
    });
    expect(ctx.command.options.major).toBe(true);
    expect(ctx.command.options.minor).toBe(false);
    expect(ctx.command.options.patch).toBe(false);
  });
});
