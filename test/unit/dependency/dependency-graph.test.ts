import { describe, it, expect } from "vitest";
import {
  buildDependencyGraph,
  getDependencies,
  getDependents,
} from "../../../src/dependency/dependency-graph.js";
import type { VersionedDocument } from "../../../src/types/document.js";
import type { Document as YamlDocument } from "yaml";

const dummyYamlDoc = null as unknown as YamlDocument;

function makeDoc(id: string, deps: { id: string; version: string }[] = []): VersionedDocument {
  return {
    filePath: `/repo/doc/${id}.md`,
    relativePath: `doc/${id}.md`,
    ext: "md",
    rawContent: "",
    yamlDoc: dummyYamlDoc,
    body: "",
    frontMatter: {
      id,
      versionPath: "version",
      dependencies: deps,
      raw: { "x-st-id": id, version: "1.0.0" },
    },
    currentVersion: "1.0.0",
  };
}

describe("buildDependencyGraph", () => {
  it("空のドキュメントリストから空グラフを生成する", () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("依存関係のないドキュメントからノードのみ生成する", () => {
    const docs = [makeDoc("prd-001"), makeDoc("uc-001")];
    const graph = buildDependencyGraph(docs);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("依存関係がある場合はエッジを生成する", () => {
    const docs = [
      makeDoc("prd-001"),
      makeDoc("uc-001", [{ id: "prd-001", version: "1.0.0" }]),
    ];
    const graph = buildDependencyGraph(docs);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({
      fromId: "uc-001",
      toId: "prd-001",
      referenceVersion: "1.0.0",
    });
  });

  it("x-st-id がないドキュメントはスキップする", () => {
    const docWithoutId: VersionedDocument = {
      filePath: "/repo/doc/readme.md",
      relativePath: "doc/readme.md",
      ext: "md",
      rawContent: "",
      yamlDoc: dummyYamlDoc,
      body: "",
      frontMatter: {
        id: undefined,
        versionPath: "version",
        dependencies: [],
        raw: {},
      },
      currentVersion: null,
    };
    const graph = buildDependencyGraph([docWithoutId]);
    expect(graph.nodes.size).toBe(0);
  });

  it("複数の依存がある場合も正しくエッジを生成する", () => {
    const docs = [
      makeDoc("a"),
      makeDoc("b"),
      makeDoc("c", [
        { id: "a", version: "1.0.0" },
        { id: "b", version: "2.0.0" },
      ]),
    ];
    const graph = buildDependencyGraph(docs);
    expect(graph.edges).toHaveLength(2);
  });
});

describe("getDependencies", () => {
  it("指定ドキュメントの依存先を返す", () => {
    const docs = [
      makeDoc("prd-001"),
      makeDoc("uc-001", [{ id: "prd-001", version: "1.0.0" }]),
    ];
    const graph = buildDependencyGraph(docs);
    const deps = getDependencies(graph, "uc-001");
    expect(deps).toHaveLength(1);
    expect(deps[0]?.toId).toBe("prd-001");
  });

  it("依存先がない場合は空配列を返す", () => {
    const docs = [makeDoc("prd-001")];
    const graph = buildDependencyGraph(docs);
    const deps = getDependencies(graph, "prd-001");
    expect(deps).toHaveLength(0);
  });
});

describe("getDependents", () => {
  it("指定ドキュメントに依存する依存元を返す", () => {
    const docs = [
      makeDoc("prd-001"),
      makeDoc("uc-001", [{ id: "prd-001", version: "1.0.0" }]),
    ];
    const graph = buildDependencyGraph(docs);
    const dependents = getDependents(graph, "prd-001");
    expect(dependents).toHaveLength(1);
    expect(dependents[0]?.fromId).toBe("uc-001");
  });

  it("依存元がない場合は空配列を返す", () => {
    const docs = [makeDoc("prd-001"), makeDoc("uc-001")];
    const graph = buildDependencyGraph(docs);
    const dependents = getDependents(graph, "prd-001");
    expect(dependents).toHaveLength(0);
  });
});
