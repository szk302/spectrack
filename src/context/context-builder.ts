import { basename, dirname, relative } from "node:path";
import { nanoid } from "nanoid";
import type { Config } from "../types/config.js";
import type { Context } from "../types/context.js";
import type { ParsedDocument } from "../types/document.js";
import { resolveVersion } from "../version/version-resolver.js";

export type CommandName =
  | "add"
  | "update"
  | "init"
  | "check-deps"
  | "show-deps"
  | "find-dependents"
  | "verify"
  | "list-versions"
  | "graph"
  | "diff";

type BuildContextOptions = {
  readonly config: Config;
  readonly doc: ParsedDocument;
  readonly commandName: CommandName;
  readonly args?: Record<string, string>;
  readonly options?: Record<string, unknown>;
  readonly lastCommitVersion?: string | null;
  readonly lastCommitDate?: string | null;
  readonly previousVersion?: string | null;
  readonly previousDate?: string | null;
  readonly cwd: string;
};

/**
 * コマンド実行時のコンテキストオブジェクトを構築する (spec §4)
 */
export function buildContext(opts: BuildContextOptions): Context {
  const {
    config,
    doc,
    commandName,
    args = {},
    options = {},
    lastCommitVersion = null,
    lastCommitDate = null,
    previousVersion = null,
    previousDate = null,
    cwd,
  } = opts;

  const relativePath = relative(cwd, doc.filePath);
  const ext = doc.ext;
  const nameWithExt = basename(doc.filePath);
  const name = nameWithExt.replace(/\.[^.]+$/, "");
  const parentDir = dirname(doc.filePath);
  const dir = basename(parentDir);

  const currentVersion = resolveVersion(doc);

  return {
    config,
    file: {
      path: relativePath,
      name,
      ext,
      dir,
    },
    frontMatter: {
      ...(doc.frontMatter.id !== undefined && { "x-st-id": doc.frontMatter.id }),
      ...(doc.frontMatter.versionPath !== undefined && { "x-st-version-path": doc.frontMatter.versionPath }),
      "x-st-dependencies": doc.frontMatter.dependencies,
      ...doc.frontMatter.raw,
    },
    current: {
      version: currentVersion,
    },
    lastCommit: {
      version: lastCommitVersion,
      updatedAt: lastCommitDate,
    },
    previous: {
      version: previousVersion,
      updatedAt: previousDate,
    },
    command: {
      name: commandName,
      args: {
        ...(args["file"] !== undefined && { file: args["file"] }),
      },
      options: {
        ...(typeof options["deps"] === "string" && { deps: options["deps"] }),
        ...(typeof options["version"] === "string" && { version: options["version"] }),
        ...(typeof options["strict"] === "boolean" && { strict: options["strict"] }),
        ...(typeof options["upgradeDeps"] === "boolean" && { upgradeDeps: options["upgradeDeps"] }),
        ...(typeof options["allowCycles"] === "boolean" && { allowCycles: options["allowCycles"] }),
        ...(typeof options["format"] === "string" && { format: options["format"] }),
      },
    },
    macro: {
      nanoid: nanoid(),
    },
  };
}
