import { describe, it, expect } from "vitest";
import { renderGraph } from "../../../src/output/graph-renderer.js";
import type { DependencyGraph } from "../../../src/dependency/dependency-graph.js";
import type { VersionedDocument } from "../../../src/types/document.js";

function makeGraph(
  nodes: [string, string][],
  edges: { fromId: string; toId: string; referenceVersion: string }[],
): DependencyGraph {
  return {
    nodes: new Map(
      nodes.map(([id, relativePath]) => [
        id,
        { id, relativePath, filePath: `/repo/${relativePath}` } as unknown as VersionedDocument,
      ]),
    ),
    edges,
  };
}

describe("renderGraph - mermaid", () => {
  it("空グラフは graph TD のみ", () => {
    const graph = makeGraph([], []);
    const result = renderGraph(graph, new Map(), "mermaid");
    expect(result.trim()).toBe("graph TD");
  });

  it("ノードとエッジを正しく出力する", () => {
    const graph = makeGraph(
      [
        ["prd-001", "doc/prd.md"],
        ["uc-001", "doc/uc.md"],
      ],
      [{ fromId: "uc-001", toId: "prd-001", referenceVersion: "1.0.0" }],
    );
    const versions = new Map<string, string | null>([
      ["prd-001", "1.0.0"],
      ["uc-001", "2.0.0"],
    ]);
    const result = renderGraph(graph, versions, "mermaid");
    expect(result).toContain("graph TD");
    expect(result).toContain("prd.md");
    expect(result).toContain("uc.md");
    expect(result).toContain("-->");
  });

  it("バージョンが null の場合は ? を表示", () => {
    const graph = makeGraph([["prd-001", "doc/prd.md"]], []);
    const result = renderGraph(graph, new Map([["prd-001", null]]), "mermaid");
    expect(result).toContain("?");
  });

  it("デフォルトフォーマットは mermaid", () => {
    const graph = makeGraph([], []);
    const result = renderGraph(graph, new Map());
    expect(result).toContain("graph TD");
  });
});

describe("renderGraph - dot", () => {
  it("digraph を出力する", () => {
    const graph = makeGraph(
      [["prd-001", "doc/prd.md"]],
      [],
    );
    const result = renderGraph(graph, new Map([["prd-001", "1.0.0"]]), "dot");
    expect(result).toContain("digraph spectrack");
    expect(result).toContain('"prd-001"');
    expect(result).toContain("1.0.0");
  });

  it("エッジを正しく出力する", () => {
    const graph = makeGraph(
      [["prd-001", "doc/prd.md"], ["uc-001", "doc/uc.md"]],
      [{ fromId: "uc-001", toId: "prd-001", referenceVersion: "1.0.0" }],
    );
    const result = renderGraph(graph, new Map(), "dot");
    expect(result).toContain('"uc-001" -> "prd-001"');
  });
});

describe("renderGraph - json", () => {
  it("JSON 形式で nodes と edges を出力する", () => {
    const graph = makeGraph(
      [["prd-001", "doc/prd.md"]],
      [],
    );
    const result = renderGraph(graph, new Map([["prd-001", "1.0.0"]]), "json");
    const parsed = JSON.parse(result) as { nodes: unknown[]; edges: unknown[] };
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(0);
  });

  it("エッジの referenceVersion を含む", () => {
    const graph = makeGraph(
      [["prd-001", "doc/prd.md"], ["uc-001", "doc/uc.md"]],
      [{ fromId: "uc-001", toId: "prd-001", referenceVersion: "1.0.0" }],
    );
    const result = renderGraph(graph, new Map(), "json");
    const parsed = JSON.parse(result) as {
      nodes: unknown[];
      edges: Array<{ from: string; to: string; referenceVersion: string }>;
    };
    expect(parsed.edges[0]?.referenceVersion).toBe("1.0.0");
  });
});
