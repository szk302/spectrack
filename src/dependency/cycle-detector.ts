import type { DependencyGraph } from "./dependency-graph.js";

export type Cycle = readonly string[];

/**
 * 依存グラフ内の循環依存を検出する
 * DFS (Depth First Search) を使用
 *
 * @returns 循環依存のリスト（各要素は循環を構成する ID の配列）
 */
export function detectCycles(graph: DependencyGraph): Cycle[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: Cycle[] = [];

  const allIds = new Set<string>();
  for (const edge of graph.edges) {
    allIds.add(edge.fromId);
    allIds.add(edge.toId);
  }
  for (const id of graph.nodes.keys()) {
    allIds.add(id);
  }

  function dfs(id: string, path: string[]): void {
    if (inStack.has(id)) {
      // 循環を検出した
      const cycleStart = path.indexOf(id);
      if (cycleStart !== -1) {
        const cycle = [...path.slice(cycleStart), id];
        // 同じ循環を重複追加しないようにチェック
        const cycleKey = normalizeCycle(cycle).join(" → ");
        if (!cycles.some((c) => normalizeCycle([...c]).join(" → ") === cycleKey)) {
          cycles.push(cycle);
        }
      }
      return;
    }

    if (visited.has(id)) {
      return;
    }

    inStack.add(id);
    path.push(id);

    const deps = graph.edges.filter((e) => e.fromId === id);
    for (const dep of deps) {
      dfs(dep.toId, path);
    }

    path.pop();
    inStack.delete(id);
    visited.add(id);
  }

  for (const id of allIds) {
    if (!visited.has(id)) {
      dfs(id, []);
    }
  }

  return cycles;
}

/**
 * 循環を正規化する（最小要素から始まる表現に統一）
 */
function normalizeCycle(cycle: string[]): string[] {
  // 最後の要素（ = 最初と同じ）を除いてローテーション
  const loop = cycle.slice(0, -1);
  if (loop.length === 0) return cycle;

  const minIdx = loop.reduce(
    (minI, val, i) => (val < loop[minI]! ? i : minI),
    0,
  );

  return [...loop.slice(minIdx), ...loop.slice(0, minIdx), loop[minIdx]!];
}

/**
 * 循環を人間が読める形式にフォーマットする
 */
export function formatCycle(cycle: Cycle): string {
  return cycle.join(" ← ");
}
