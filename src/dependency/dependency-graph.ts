import type { VersionedDocument } from "../types/document.js";

/** 依存グラフのエッジ */
export type DependencyEdge = {
  /** 依存元ドキュメントの ID */
  readonly fromId: string;
  /** 依存先ドキュメントの ID */
  readonly toId: string;
  /** 依存元が参照しているバージョン */
  readonly referenceVersion: string;
};

/** 依存グラフ */
export type DependencyGraph = {
  /** ノード: id → ドキュメント */
  readonly nodes: ReadonlyMap<string, VersionedDocument>;
  /** エッジリスト */
  readonly edges: readonly DependencyEdge[];
};

/**
 * VersionedDocument の配列から依存グラフを構築する
 */
export function buildDependencyGraph(
  docs: readonly VersionedDocument[],
): DependencyGraph {
  const nodes = new Map<string, VersionedDocument>();
  const edges: DependencyEdge[] = [];

  for (const doc of docs) {
    const id = doc.frontMatter.id;
    if (!id) continue;

    nodes.set(id, doc);

    for (const dep of doc.frontMatter.dependencies) {
      edges.push({
        fromId: id,
        toId: dep.id,
        referenceVersion: dep.version,
      });
    }
  }

  return { nodes, edges };
}

/**
 * 指定ドキュメントの依存先 ID リストを取得する
 */
export function getDependencies(
  graph: DependencyGraph,
  id: string,
): readonly DependencyEdge[] {
  return graph.edges.filter((e) => e.fromId === id);
}

/**
 * 指定ドキュメントを依存先とする依存元 ID リストを取得する（逆引き）
 */
export function getDependents(
  graph: DependencyGraph,
  id: string,
): readonly DependencyEdge[] {
  return graph.edges.filter((e) => e.toId === id);
}
