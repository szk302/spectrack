import { ExitCode } from "../../output/exit-code.js";
import { buildDependencyGraph } from "../../dependency/dependency-graph.js";
import { renderGraph, type GraphFormat } from "../../output/graph-renderer.js";
import type { CommandContext } from "../runner.js";

export type GraphOptions = {
  readonly format?: string;
};

export async function runGraph(
  options: GraphOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  const format = (options.format ?? "mermaid") as GraphFormat;
  const graph = buildDependencyGraph(ctx.docs);

  // バージョンマップを構築
  const versions = new Map<string, string | null>();
  for (const doc of ctx.docs) {
    if (doc.frontMatter.id) {
      versions.set(doc.frontMatter.id, doc.currentVersion);
    }
  }

  const output = renderGraph(graph, versions, format);
  process.stdout.write(output);

  return ExitCode.SUCCESS;
}
