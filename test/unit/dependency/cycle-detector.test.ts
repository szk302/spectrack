import { describe, it, expect } from "vitest";
import { detectCycles } from "../../../src/dependency/cycle-detector.js";
import type { DependencyGraph } from "../../../src/dependency/dependency-graph.js";
import type { VersionedDocument } from "../../../src/types/document.js";

function makeDoc(id: string): VersionedDocument {
  return {
    filePath: `/tmp/${id}.md`,
    relativePath: `${id}.md`,
    ext: "md",
    frontMatter: {
      id,
      versionPath: "version",
      dependencies: [],
      raw: { "x-st-id": id, version: "1.0.0" },
    },
    yamlDoc: {} as never,
    body: null,
    rawContent: "",
    currentVersion: "1.0.0",
  };
}

function makeGraph(
  nodes: string[],
  edges: [string, string][],
): DependencyGraph {
  const nodeMap = new Map<string, VersionedDocument>(
    nodes.map((id) => [id, makeDoc(id)]),
  );
  const edgeList = edges.map(([from, to]) => ({
    fromId: from,
    toId: to,
    referenceVersion: "1.0.0",
  }));
  return { nodes: nodeMap, edges: edgeList };
}

describe("detectCycles", () => {
  it("循環依存がない場合は空配列を返す", () => {
    const graph = makeGraph(["A", "B", "C"], [
      ["A", "B"],
      ["B", "C"],
    ]);
    expect(detectCycles(graph)).toHaveLength(0);
  });

  it("直接循環 (A → B → A) を検出する", () => {
    const graph = makeGraph(["A", "B"], [
      ["A", "B"],
      ["B", "A"],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("間接循環 (A → B → C → A) を検出する", () => {
    const graph = makeGraph(["A", "B", "C"], [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"],
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("自己参照 (A → A) を検出する", () => {
    const graph = makeGraph(["A"], [["A", "A"]]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("独立した複数のコンポーネントで循環なし", () => {
    const graph = makeGraph(["A", "B", "C", "D"], [
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(detectCycles(graph)).toHaveLength(0);
  });

  it("エッジのないグラフは循環なし", () => {
    const graph = makeGraph(["A", "B", "C"], []);
    expect(detectCycles(graph)).toHaveLength(0);
  });
});
