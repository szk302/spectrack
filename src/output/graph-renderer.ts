import type { DependencyGraph } from "../dependency/dependency-graph.js";

export type GraphFormat = "mermaid" | "dot" | "json";

/**
 * 依存グラフを指定フォーマットで文字列に変換する
 */
export function renderGraph(
  graph: DependencyGraph,
  versions: Map<string, string | null>,
  format: GraphFormat = "mermaid",
): string {
  switch (format) {
    case "mermaid":
      return renderMermaid(graph, versions);
    case "dot":
      return renderDot(graph, versions);
    case "json":
      return renderJson(graph, versions);
    default:
      return renderMermaid(graph, versions);
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function renderMermaid(
  graph: DependencyGraph,
  versions: Map<string, string | null>,
): string {
  const lines: string[] = ["graph TD"];

  for (const [id, doc] of graph.nodes) {
    const name = doc.relativePath.replace(/\//g, "_").replace(/\./g, "_");
    const version = versions.get(id) ?? "?";
    const safeId = sanitizeId(name);
    lines.push(`    ${safeId}["✅ ${doc.relativePath.split("/").pop() ?? id}<br/>${version}"]`);
  }

  for (const edge of graph.edges) {
    const fromDoc = graph.nodes.get(edge.fromId);
    const toDoc = graph.nodes.get(edge.toId);
    if (!fromDoc || !toDoc) continue;

    const fromName = sanitizeId(
      fromDoc.relativePath.replace(/\//g, "_").replace(/\./g, "_"),
    );
    const toName = sanitizeId(
      toDoc.relativePath.replace(/\//g, "_").replace(/\./g, "_"),
    );
    lines.push(`    ${fromName} --> ${toName}`);
  }

  return lines.join("\n") + "\n";
}

function renderDot(
  graph: DependencyGraph,
  versions: Map<string, string | null>,
): string {
  const lines: string[] = ["digraph spectrack {"];

  for (const [id] of graph.nodes) {
    const version = versions.get(id) ?? "?";
    lines.push(`  "${id}" [label="${id}\\n${version}"];`);
  }

  for (const edge of graph.edges) {
    lines.push(`  "${edge.fromId}" -> "${edge.toId}";`);
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

function renderJson(
  graph: DependencyGraph,
  versions: Map<string, string | null>,
): string {
  const nodes = Array.from(graph.nodes.entries()).map(([id, doc]) => ({
    id,
    path: doc.relativePath,
    version: versions.get(id) ?? null,
  }));

  const edges = graph.edges.map((e) => ({
    from: e.fromId,
    to: e.toId,
    referenceVersion: e.referenceVersion,
  }));

  return JSON.stringify({ nodes, edges }, null, 2) + "\n";
}
